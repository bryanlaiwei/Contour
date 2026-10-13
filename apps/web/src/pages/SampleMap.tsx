import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EvidenceDetail, FeatureDetail, Graph, GraphFeature, HistoryEntry, PullRequestDetail, WorkItemDetail, WorkItemState, WorkflowRun } from "../api";
import { cx } from "../helpers";
import { freeSpot, tidyLayout, type XY } from "../map/layout";
import { MapCanvas } from "../map/MapCanvas";
import { FeaturePanel } from "../panel/FeaturePanel";
import { PanelShell } from "../panel/PanelShell";
import { WorkItemPanel } from "../panel/WorkItemPanel";
import { GithubMark } from "../ui/GithubMark";
import { useToast } from "../ui/toast-context";

const at = "2026-10-08T15:00:00.000Z";

type Demo = {
  graph: Graph;
  features: Record<string, FeatureDetail>;
  items: Record<string, WorkItemDetail>;
};

type Selection = { kind: "feature" | "work_item"; id: string } | null;

function run(id: string, conclusion: "success" | "failure"): WorkflowRun {
  return {
    artifactId: id,
    runId: Number(id.replace(/\D/g, "")) || 1,
    url: "https://github.com/example/store/actions",
    status: "completed",
    conclusion,
    attempt: 1,
    attempts: [{ attempt: 1, status: "completed", conclusion, updatedAt: at }],
    jobs: [{ jobId: 1, name: "test", status: "completed", conclusion, attempt: 1, updatedAt: at }],
  };
}

function pull(number: number, title: string, mode: "merged" | "open" | "draft", conclusion: "success" | "failure" | null): PullRequestDetail {
  return {
    artifactId: `pr-${number}`,
    number,
    title,
    url: `https://github.com/example/store/pull/${number}`,
    state: mode === "merged" ? "closed" : "open",
    draft: mode === "draft",
    merged: mode === "merged",
    author: null,
    reviews: [],
    basis: "observed",
    runs: conclusion ? [run(`run-${number}`, conclusion)] : [],
  };
}

function session(id: string, agent: string, asked: string, answer: string): EvidenceDetail {
  return {
    id,
    kind: "session_excerpt",
    source: agent,
    sessionId: id,
    excerpt: `User (Wed 9:12 AM): ${asked}\n\nAgent (Wed 9:14 AM): ${answer}`,
    observedAt: at,
    basis: "observed",
  };
}

function history(revision: number, change: string, before: unknown, after: unknown, basis: HistoryEntry["basis"]): HistoryEntry {
  return { revision, change, before, after, basis, evidenceIds: [], actor: null, at };
}

function item(input: {
  id: string;
  featureId: string;
  featureTitle: string;
  title: string;
  summary: string;
  state: WorkItemState;
  agent: string;
  pullRequest: PullRequestDetail | null;
  asked: string;
  answer: string;
  blocked?: string;
  dependsOn?: { id: string; workItemId: string; title: string };
}): WorkItemDetail {
  return {
    id: input.id,
    feature: { id: input.featureId, title: input.featureTitle },
    title: { value: input.title, basis: "observed" },
    summary: { value: input.summary, basis: "observed" },
    state: { value: input.state, basis: "observed" },
    blocked: input.blocked ? { reason: input.blocked } : null,
    contributors: { agents: [input.agent], people: [] },
    pullRequests: input.pullRequest ? [input.pullRequest] : [],
    evidence: [session(`${input.id}-session`, input.agent, input.asked, input.answer)],
    relationships: input.dependsOn
      ? [{ id: input.dependsOn.id, direction: "depends_on", workItemId: input.dependsOn.workItemId, title: input.dependsOn.title, basis: "observed", evidenceIds: [] }]
      : [],
    history: [
      history(1, "created", null, {}, "observed"),
      history(2, "state", { state: "planned" }, { state: input.state }, "observed"),
      ...(input.pullRequest
        ? [history(3, "pull_request_updated", { number: input.pullRequest.number, state: "open", draft: true, merged: false }, { number: input.pullRequest.number, state: input.pullRequest.state, draft: input.pullRequest.draft, merged: input.pullRequest.merged, title: input.pullRequest.title }, "observed")]
        : []),
    ],
    updatedAt: at,
  };
}

function feature(id: string, title: string, summary: string, agent: string, workItems: WorkItemDetail[]): FeatureDetail {
  return {
    id,
    title: { value: title, basis: "observed" },
    summary: { value: summary, basis: "observed" },
    workItems: workItems.map((entry) => ({
      id: entry.id,
      title: entry.title.value,
      summary: entry.summary.value,
      state: entry.state.value,
      stateBasis: entry.state.basis,
      blocked: entry.blocked !== null,
    })),
    contributors: { agents: [agent], people: [] },
    history: [history(1, "created", null, { title }, "observed")],
  };
}

function graphFeature(detail: FeatureDetail, workItems: WorkItemDetail[]): GraphFeature {
  const counts: GraphFeature["counts"] = {};
  for (const entry of workItems) {
    counts[entry.state.value] = (counts[entry.state.value] ?? 0) + 1;
  }
  return {
    id: detail.id,
    title: detail.title.value,
    summary: detail.summary.value,
    counts,
    contributors: detail.contributors,
    lastActivityAt: at,
    workItems: workItems.map((entry) => ({
      id: entry.id,
      title: entry.title.value,
      state: entry.state.value,
      stateBasis: entry.state.basis,
      blocked: entry.blocked !== null,
      pullRequests: entry.pullRequests.map((pullRequest) => pullRequest.number),
      lastActivityAt: entry.updatedAt,
    })),
  };
}

function buildDemo(): Demo {
  const rank = item({
    id: "rank",
    featureId: "search",
    featureTitle: "Search results",
    title: "Rank results by relevance",
    summary: "Order results by how well they match the query.",
    state: "merged",
    agent: "cursor",
    pullRequest: pull(128, "Rank results by relevance", "merged", "success"),
    asked: "Rank the results by how well they match the query.",
    answer: "Sorted them by match score, and kept the previous order when a score is missing.",
  });
  const highlight = item({
    id: "highlight",
    featureId: "search",
    featureTitle: "Search results",
    title: "Highlight matching words",
    summary: "Mark the words from the query in each result.",
    state: "merged",
    agent: "cursor",
    pullRequest: pull(132, "Highlight matching words", "merged", "success"),
    asked: "Highlight the words from the query inside each result.",
    answer: "Wrapped the matching words so they show in bold.",
  });
  const saved = item({
    id: "saved-filter",
    featureId: "filters",
    featureTitle: "Saved filters",
    title: "Remember the last filter",
    summary: "Restore the filter when someone comes back.",
    state: "in_review",
    agent: "claude_code",
    pullRequest: pull(141, "Remember the last filter", "open", "failure"),
    asked: "Remember the last filter when someone comes back.",
    answer: "Stored the filter with the account and restored it on the next visit.",
    blocked: "Search results are not finished.",
    dependsOn: { id: "filter-waits", workItemId: "rank", title: "Rank results by relevance" },
  });
  const weekly = item({
    id: "weekly",
    featureId: "digest",
    featureTitle: "Email digest",
    title: "Send a weekly digest",
    summary: "Email a short list of new items once a week.",
    state: "in_progress",
    agent: "codex",
    pullRequest: pull(96, "Send a weekly digest", "draft", null),
    asked: "Send a short email once a week with the new items.",
    answer: "Drafted the weekly email and left the send time unset.",
  });
  const search = feature("search", "Search results", "How results are ordered and marked.", "cursor", [rank, highlight]);
  const filters = feature("filters", "Saved filters", "Filters people can come back to.", "claude_code", [saved]);
  const digest = feature("digest", "Email digest", "A weekly note about new items.", "codex", [weekly]);
  const items = { rank, highlight, "saved-filter": saved, weekly };
  return {
    features: { search, filters, digest },
    items,
    graph: {
      revision: 1,
      pendingAnalysis: 0,
      pendingSince: null,
      features: [graphFeature(search, [rank, highlight]), graphFeature(filters, [saved]), graphFeature(digest, [weekly])],
      relationships: [{ id: "filter-waits", kind: "depends_on", from: "saved-filter", to: "rank", basis: "observed" }],
    },
  };
}

function buildNotes(): Demo {
  const write = item({
    id: "write",
    featureId: "notebook",
    featureTitle: "Notebook",
    title: "Write a note",
    summary: "Save a note with a title and a body.",
    state: "merged",
    agent: "cursor",
    pullRequest: pull(12, "Write a note", "merged", "success"),
    asked: "Let me write a note and come back to it later.",
    answer: "Saved the title and the body, and opened the note again after a refresh.",
  });
  const share = item({
    id: "share",
    featureId: "sharing",
    featureTitle: "Sharing",
    title: "Share a notebook",
    summary: "Let someone else read a notebook.",
    state: "in_review",
    agent: "claude_code",
    pullRequest: pull(19, "Share a notebook", "open", "failure"),
    asked: "Let me share a notebook with another person.",
    answer: "Added a link that opens the notebook as read-only.",
    blocked: "The notebook is not ready to share.",
    dependsOn: { id: "share-waits", workItemId: "write", title: "Write a note" },
  });
  const remind = item({
    id: "remind",
    featureId: "reminders",
    featureTitle: "Reminders",
    title: "Remind me tomorrow",
    summary: "Send a reminder the next day.",
    state: "in_progress",
    agent: "codex",
    pullRequest: pull(23, "Remind me tomorrow", "draft", null),
    asked: "Remind me about a note tomorrow morning.",
    answer: "Drafted the reminder and left the time unset.",
  });
  const notebook = feature("notebook", "Notebook", "Notes a person can write and reopen.", "cursor", [write]);
  const sharing = feature("sharing", "Sharing", "Who else can read a notebook.", "claude_code", [share]);
  const reminders = feature("reminders", "Reminders", "A nudge about a note.", "codex", [remind]);
  return {
    features: { notebook, sharing, reminders },
    items: { write, share, remind },
    graph: {
      revision: 1,
      pendingAnalysis: 0,
      pendingSince: null,
      features: [graphFeature(notebook, [write]), graphFeature(sharing, [share]), graphFeature(reminders, [remind])],
      relationships: [{ id: "share-waits", kind: "depends_on", from: "share", to: "write", basis: "observed" }],
    },
  };
}

function withRevision(demo: Demo): Demo {
  return { ...demo, graph: { ...demo.graph, revision: demo.graph.revision + 1 } };
}

function refreshFeatures(demo: Demo): Demo {
  const features = { ...demo.features };
  for (const featureId of Object.keys(features)) {
    const detail = features[featureId];
    if (!detail) {
      continue;
    }
    const workItems = Object.values(demo.items).filter((entry) => entry.feature.id === featureId);
    features[featureId] = {
      ...detail,
      workItems: workItems.map((entry) => ({
        id: entry.id,
        title: entry.title.value,
        summary: entry.summary.value,
        state: entry.state.value,
        stateBasis: entry.state.basis,
        blocked: entry.blocked !== null,
      })),
      title: detail.title,
    };
  }
  const graphFeatures = demo.graph.features
    .filter((entry) => features[entry.id])
    .map((entry) => {
      const detail = features[entry.id];
      const workItems = Object.values(demo.items).filter((itemEntry) => itemEntry.feature.id === entry.id);
      return detail ? graphFeature({ ...detail, title: { ...detail.title, value: entry.title } }, workItems) : entry;
    });
  return { ...demo, features, graph: { ...demo.graph, features: graphFeatures } };
}

const storePositions = new Map<string, XY>([
  ["search", { x: 16, y: 170 }],
  ["filters", { x: 420, y: 24 }],
  ["digest", { x: 420, y: 310 }],
]);

const notesPositions = new Map<string, XY>([
  ["notebook", { x: 16, y: 170 }],
  ["sharing", { x: 420, y: 24 }],
  ["reminders", { x: 420, y: 310 }],
]);

const sampleProjects = [
  { id: "store", owner: "example", name: "store", positions: storePositions },
  { id: "notes", owner: "example", name: "notes", positions: notesPositions },
] as const;

type SampleProjectId = (typeof sampleProjects)[number]["id"];

export function SampleMap() {
  const toast = useToast();
  const [projectId, setProjectId] = useState<SampleProjectId>("store");
  const [boards, setBoards] = useState(() => ({
    store: { demo: buildDemo(), positions: storePositions },
    notes: { demo: buildNotes(), positions: notesPositions },
  }));
  const demo = boards[projectId].demo;
  const positions = boards[projectId].positions;
  const project = sampleProjects.find((entry) => entry.id === projectId) ?? sampleProjects[0];
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selection, setSelection] = useState<Selection>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);

  const featureOfWorkItem = useMemo(() => {
    const map = new Map<string, string>();
    for (const featureEntry of demo.graph.features) {
      for (const workItem of featureEntry.workItems) {
        map.set(workItem.id, featureEntry.id);
      }
    }
    return map;
  }, [demo.graph.features]);

  const selectFeature = useCallback((id: string) => setSelection({ kind: "feature", id }), []);
  const selectWorkItem = useCallback((id: string) => setSelection({ kind: "work_item", id }), []);
  const closePanel = useCallback(() => setSelection(null), []);

  const selectedItemFeature = selection?.kind === "work_item" ? featureOfWorkItem.get(selection.id) : undefined;
  useEffect(() => {
    if (selectedItemFeature) {
      setExpanded((current) => (current.has(selectedItemFeature) ? current : new Set([...current, selectedItemFeature])));
    }
  }, [selectedItemFeature]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[role="dialog"]')) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actions = useMemo(
    () => ({
      selectFeature,
      selectWorkItem,
      toggle: (featureId: string) =>
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(featureId)) {
            next.delete(featureId);
          } else {
            next.add(featureId);
          }
          return next;
        }),
    }),
    [selectFeature, selectWorkItem],
  );

  const selectedFeatureId = selection?.kind === "feature" ? selection.id : selection ? (featureOfWorkItem.get(selection.id) ?? null) : null;
  const selectedFeatureTitle = demo.graph.features.find((featureEntry) => featureEntry.id === selectedFeatureId)?.title;
  const selectedFeature = selectedFeatureId ? demo.features[selectedFeatureId] : undefined;
  const selectedItem = selection?.kind === "work_item" ? demo.items[selection.id] : undefined;

  const edit = useCallback((change: (current: Demo) => Demo) => {
    setBoards((current) => ({
      ...current,
      [projectId]: { ...current[projectId], demo: withRevision(refreshFeatures(change(current[projectId].demo))) },
    }));
  }, [projectId]);

  return (
    <div className="relative h-[32rem] overflow-hidden rounded-t-2xl bg-[#f5f5f7]">
      <MapCanvas
        key={projectId}
        projectId={`sample-map-${projectId}`}
        viewerLogin={null}
        graph={demo.graph}
        positions={positions}
        expanded={expanded}
        selectedFeatureId={selectedFeatureId}
        selectedWorkItemId={selection?.kind === "work_item" ? selection.id : null}
        panelOpen={selection !== null}
        legendLabel="Legend"
        fitViewMaxZoom={0.83}
        restoreViewport={false}
        actions={actions}
        onMoveFeature={(featureId, drop) => {
          setBoards((current) => {
            const next = new Map(current[projectId].positions);
            next.set(featureId, freeSpot(featureId, drop, next));
            return { ...current, [projectId]: { ...current[projectId], positions: next } };
          });
        }}
        onTidy={async () => {
          const placed = await tidyLayout(demo.graph.features, demo.graph.relationships);
          setBoards((current) => ({ ...current, [projectId]: { ...current[projectId], positions: placed } }));
          toast("Map rearranged");
        }}
        onBackgroundClick={closePanel}
        empty={null}
      />
      <div className="nopan nodrag nowheel absolute top-4 left-4 z-10 w-max max-w-[min(18rem,calc(100%-5.5rem))]">
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <button
            type="button"
            aria-expanded={projectsOpen}
            aria-label="Switch project"
            onClick={() => setProjectsOpen((open) => !open)}
            className="flex w-full min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700"
          >
            <GithubMark className="size-3.5 shrink-0 text-zinc-500" />
            <span className="truncate">
              {project.owner}/{project.name}
            </span>
            <ChevronDown className={cx("size-3.5 shrink-0 text-zinc-400 transition-transform", projectsOpen && "rotate-180")} />
          </button>
          {projectsOpen ? (
            <ul className="space-y-0.5 px-1 pb-1">
              {sampleProjects.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectId(entry.id);
                      setSelection(null);
                      setExpanded(new Set());
                      setProjectsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    <Check className={cx("size-3.5 shrink-0", entry.id === projectId ? "text-zinc-900" : "invisible")} />
                    <span className="truncate">
                      {entry.owner}/{entry.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {selection && selectedFeature ? (
        <PanelShell
          onClose={closePanel}
          header={
            selection.kind === "work_item" && selectedFeatureTitle && selectedFeatureId ? (
              <button type="button" onClick={() => selectFeature(selectedFeatureId)} className="truncate hover:text-zinc-900">
                ← {selectedFeatureTitle}
              </button>
            ) : (
              "Feature details"
            )
          }
        >
          {selection.kind === "feature" ? (
            <FeaturePanel
              key={selection.id}
              token=""
              projectId="homepage-demo"
              featureId={selection.id}
              graph={demo.graph}
              onSelectWorkItem={selectWorkItem}
              onSelectFeature={selectFeature}
              onChanged={async () => undefined}
              onGone={closePanel}
              viewerLogin={null}
              local={{
                feature: selectedFeature,
                rename: async (title) => {
                  edit((current) => ({
                    ...current,
                    features: {
                      ...current.features,
                      [selection.id]: { ...current.features[selection.id], title: { value: title, basis: "human" } },
                    },
                    graph: {
                      ...current.graph,
                      features: current.graph.features.map((entry) => (entry.id === selection.id ? { ...entry, title } : entry)),
                    },
                    items: Object.fromEntries(
                      Object.entries(current.items).map(([id, entry]) => [id, entry.feature.id === selection.id ? { ...entry, feature: { ...entry.feature, title } } : entry]),
                    ),
                  }));
                },
                merge: async (survivingId) => {
                  edit((current) => {
                    const retired = selection.id;
                    const items = Object.fromEntries(
                      Object.entries(current.items).map(([id, entry]) => [
                        id,
                        entry.feature.id === retired ? { ...entry, feature: { id: survivingId, title: current.features[survivingId]?.title.value ?? entry.feature.title } } : entry,
                      ]),
                    );
                    const features = { ...current.features };
                    delete features[retired];
                    return {
                      ...current,
                      items,
                      features,
                      graph: {
                        ...current.graph,
                        features: current.graph.features.filter((entry) => entry.id !== retired),
                        relationships: current.graph.relationships.filter((entry) => {
                          const fromFeature = Object.values(items).find((itemEntry) => itemEntry.id === entry.from)?.feature.id;
                          const toFeature = Object.values(items).find((itemEntry) => itemEntry.id === entry.to)?.feature.id;
                          return fromFeature !== toFeature;
                        }),
                      },
                    };
                  });
                  selectFeature(survivingId);
                },
              }}
            />
          ) : selectedItem ? (
            <WorkItemPanel
              key={selection.id}
              token=""
              projectId="homepage-demo"
              workItemId={selection.id}
              graph={demo.graph}
              onSelectWorkItem={selectWorkItem}
              onSelectFeature={selectFeature}
              onChanged={async () => undefined}
              onGone={closePanel}
              viewerLogin={null}
              local={{
                item: selectedItem,
                rename: async (title) => {
                  const id = selection.id;
                  edit((current) => ({
                    ...current,
                    items: Object.fromEntries(
                      Object.entries(current.items).map(([otherId, entry]) => [
                        otherId,
                        {
                          ...(otherId === id ? { ...entry, title: { value: title, basis: "human" as const } } : entry),
                          relationships: entry.relationships.map((relationship) => (relationship.workItemId === id ? { ...relationship, title } : relationship)),
                        },
                      ]),
                    ),
                  }));
                },
                move: async (featureId) => {
                  const id = selection.id;
                  const title = demo.features[featureId]?.title.value ?? "feature";
                  edit((current) => ({
                    ...current,
                    items: { ...current.items, [id]: { ...current.items[id], feature: { id: featureId, title } } },
                  }));
                },
                merge: async (survivingId) => {
                  const retiredId = selection.id;
                  edit((current) => {
                    const retired = current.items[retiredId];
                    const survivor = current.items[survivingId];
                    if (!retired || !survivor) {
                      return current;
                    }
                    const items = { ...current.items };
                    delete items[retiredId];
                    items[survivingId] = {
                      ...survivor,
                      pullRequests: [...survivor.pullRequests, ...retired.pullRequests],
                      evidence: [...survivor.evidence, ...retired.evidence],
                      relationships: [...survivor.relationships, ...retired.relationships.filter((relationship) => relationship.workItemId !== survivingId)],
                    };
                    for (const entry of Object.values(items)) {
                      entry.relationships = entry.relationships
                        .filter((relationship) => relationship.workItemId !== retiredId)
                        .map((relationship) => relationship);
                    }
                    return {
                      ...current,
                      items,
                      graph: {
                        ...current.graph,
                        relationships: current.graph.relationships
                          .map((relationship) => ({
                            ...relationship,
                            from: relationship.from === retiredId ? survivingId : relationship.from,
                            to: relationship.to === retiredId ? survivingId : relationship.to,
                          }))
                          .filter((relationship) => relationship.from !== relationship.to),
                      },
                    };
                  });
                },
                split: async (input) => {
                  const id = selection.id;
                  const createdId = `${id}-split`;
                  edit((current) => {
                    const source = current.items[id];
                    if (!source) {
                      return current;
                    }
                    const movedPulls = source.pullRequests.filter((entry) => input.artifactIds.includes(entry.artifactId));
                    const movedEvidence = source.evidence.filter((entry) => input.evidenceIds.includes(entry.id));
                    const created = item({
                      id: createdId,
                      featureId: source.feature.id,
                      featureTitle: source.feature.title,
                      title: input.title,
                      summary: "",
                      state: "planned",
                      agent: source.contributors.agents[0] ?? "cursor",
                      pullRequest: movedPulls[0] ?? null,
                      asked: "Continue this as its own piece of work.",
                      answer: "Split it out from the original item.",
                    });
                    created.pullRequests = movedPulls;
                    created.evidence = movedEvidence.length > 0 ? movedEvidence : created.evidence;
                    return {
                      ...current,
                      items: {
                        ...current.items,
                        [id]: {
                          ...source,
                          pullRequests: source.pullRequests.filter((entry) => !input.artifactIds.includes(entry.artifactId)),
                          evidence: source.evidence.filter((entry) => !input.evidenceIds.includes(entry.id)),
                        },
                        [createdId]: created,
                      },
                    };
                  });
                  return createdId;
                },
                dismiss: async (relationshipId) => {
                  const id = selection.id;
                  edit((current) => ({
                    ...current,
                    items: {
                      ...current.items,
                      [id]: {
                        ...current.items[id],
                        blocked: null,
                        relationships: current.items[id].relationships.filter((relationship) => relationship.id !== relationshipId),
                      },
                    },
                    graph: {
                      ...current.graph,
                      relationships: current.graph.relationships.filter((relationship) => relationship.id !== relationshipId),
                    },
                  }));
                },
              }}
            />
          ) : null}
        </PanelShell>
      ) : null}
    </div>
  );
}
