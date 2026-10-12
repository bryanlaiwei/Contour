import {
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { ChevronDown, LayoutGrid, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Graph, WorkItemState } from "../../api";
import { stateMeta } from "../../format";
import { cx } from "../helpers";
import { IconButton } from "../ui";
import { MapActionsContext, type MapActions } from "./actions";
import { FeatureNode, type FeatureFlowNode } from "./FeatureNode";
import { cardWidth, collapsedHeight, displayPositions, featureEdges, type XY } from "./layout";

const panelSpace = 464;

type DependencyEdge = Edge<{ label: string; count: number }, "dependency">;

function DependencyEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<DependencyEdge>) {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: hovered ? "#6366f1" : "#a1a1aa", strokeWidth: hovered ? 2 : 1.5 }} />
      <path d={path} fill="none" stroke="transparent" strokeWidth={18} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
      {data && (hovered || data.count > 1) ? (
        <EdgeLabelRenderer>
          <div
            className={cx(
              "pointer-events-none absolute rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm ring-1",
              hovered ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-zinc-600 ring-zinc-200",
            )}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {hovered ? `${data.label}${data.count > 1 ? ` (${data.count})` : ""}` : data.count}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const legendDetail: Record<WorkItemState, string> = {
  planned: "Asked for in a session, but not started yet.",
  in_progress: "Work is underway, or only a draft pull request is open.",
  in_review: "A pull request is open and ready for review.",
  merged: "A pull request was merged, and none are still open.",
  closed: "Its pull requests were closed without merging.",
  unknown: "Not enough activity to tell yet.",
};

const nodeTypes = { feature: FeatureNode };
const edgeTypes = { dependency: DependencyEdgeView };

type MapCanvasProps = {
  projectId: string;
  viewerLogin: string | null;
  graph: Graph;
  positions: ReadonlyMap<string, XY>;
  expanded: ReadonlySet<string>;
  selectedFeatureId: string | null;
  selectedWorkItemId: string | null;
  panelOpen: boolean;
  actions: MapActions;
  onMoveFeature: (featureId: string, position: XY) => void;
  onTidy: () => Promise<void>;
  onBackgroundClick: () => void;
  empty: ReactNode;
};

export function MapCanvas(props: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function viewportKey(projectId: string): string {
  return `apm:viewport:${projectId}`;
}

function savedViewport(projectId: string): Viewport | null {
  try {
    const raw = window.localStorage.getItem(viewportKey(projectId));
    const parsed = raw ? (JSON.parse(raw) as Viewport) : null;
    return parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y) && Number.isFinite(parsed.zoom) ? parsed : null;
  } catch {
    return null;
  }
}

function MapCanvasInner({
  projectId,
  viewerLogin,
  graph,
  positions,
  expanded,
  selectedFeatureId,
  selectedWorkItemId,
  panelOpen,
  actions,
  onMoveFeature,
  onTidy,
  onBackgroundClick,
  empty,
}: MapCanvasProps) {
  const flow = useReactFlow();
  const [initialViewport] = useState(() => savedViewport(projectId));
  const hadNodes = useRef(graph.features.length > 0);
  const container = useRef<HTMLDivElement>(null);
  const selectedExpanded = selectedFeatureId !== null && expanded.has(selectedFeatureId);
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    if (!selectedFeatureId || !panelOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const node = flow.getInternalNode(selectedFeatureId);
      const bounds = container.current?.getBoundingClientRect();
      if (!node || !bounds || bounds.width < panelSpace + cardWidth) {
        return;
      }
      const { x, y, zoom } = flow.getViewport();
      const width = (node.measured.width ?? cardWidth) * zoom;
      const height = Math.min((node.measured.height ?? collapsedHeight) * zoom, bounds.height - 32);
      const left = node.internals.positionAbsolute.x * zoom + x;
      const top = node.internals.positionAbsolute.y * zoom + y;
      const visibleRight = bounds.width - panelSpace;
      let dx = 0;
      let dy = 0;
      if (left + width > visibleRight) {
        dx = visibleRight - (left + width);
      }
      if (left + dx < 16) {
        dx = 16 - left;
      }
      if (top < 16) {
        dy = 16 - top;
      } else if (top + height > bounds.height - 16) {
        dy = bounds.height - 16 - (top + height);
      }
      if (dx !== 0 || dy !== 0) {
        void flow.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 250 });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedFeatureId, selectedExpanded, panelOpen, flow]);

  const derived = useMemo<FeatureFlowNode[]>(() => {
    const shown = displayPositions(graph.features, positions, expanded);
    return graph.features.flatMap((feature) => {
      const position = shown.get(feature.id);
      if (!position) {
        return [];
      }
      const node: FeatureFlowNode = {
        id: feature.id,
        type: "feature",
        position,
        data: {
          feature,
          viewerLogin,
          expanded: expanded.has(feature.id),
          selected: feature.id === selectedFeatureId,
          selectedWorkItemId,
        },
        zIndex: feature.id === selectedFeatureId ? 10 : expanded.has(feature.id) ? 5 : 1,
      };
      return [node];
    });
  }, [graph.features, viewerLogin, positions, expanded, selectedFeatureId, selectedWorkItemId]);

  const [nodes, setNodes] = useState<FeatureFlowNode[]>(derived);
  useEffect(() => setNodes(derived), [derived]);

  const edges = useMemo<DependencyEdge[]>(
    () =>
      featureEdges(graph.features, graph.relationships).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "dependency",
        data: { label: edge.label, count: edge.count },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#a1a1aa" },
      })),
    [graph.features, graph.relationships],
  );

  useEffect(() => {
    if (!hadNodes.current && nodes.length > 0) {
      hadNodes.current = true;
      window.requestAnimationFrame(() => void flow.fitView({ padding: 0.25, maxZoom: 1, duration: 300 }));
    }
  }, [nodes.length, flow]);

  return (
    <MapActionsContext.Provider value={actions}>
      <div ref={container} className="relative h-full w-full">
        <ReactFlow<FeatureFlowNode, DependencyEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={(changes: NodeChange<FeatureFlowNode>[]) => setNodes((current) => applyNodeChanges(changes, current))}
          onNodeDragStop={(_event, node) => onMoveFeature(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) })}
          onPaneClick={onBackgroundClick}
          onMoveEnd={(_event, viewport) => window.localStorage.setItem(viewportKey(projectId), JSON.stringify(viewport))}
          elementsSelectable={false}
          nodesConnectable={false}
          selectNodesOnDrag={false}
          zoomOnDoubleClick={false}
          snapToGrid
          snapGrid={[8, 8]}
          minZoom={0.2}
          maxZoom={1.75}
          {...(initialViewport ? { defaultViewport: initialViewport } : { fitView: true, fitViewOptions: { padding: 0.25, maxZoom: 1 } })}
          proOptions={{ hideAttribution: false }}
          className="bg-[#f7f7f8]"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d4d4d8" />
          <Panel position="top-right" style={{ marginTop: 16, marginRight: panelOpen ? 468 : 16 }}>
            <div className="w-max max-w-72 rounded-xl bg-white/95 shadow-sm ring-1 ring-zinc-200 backdrop-blur">
              <button
                type="button"
                aria-expanded={legendOpen}
                onClick={() => setLegendOpen((open) => !open)}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700"
              >
                <span>Status</span>
                <ChevronDown className={cx("size-3.5 text-zinc-400 transition-transform", legendOpen && "rotate-180")} />
              </button>
              {legendOpen ? (
                <ul className="space-y-2 px-2.5 pb-2.5">
                  {(Object.keys(legendDetail) as WorkItemState[]).map((state) => (
                    <li key={state} className="flex items-start gap-2 text-xs text-zinc-600">
                      <span className={cx("mt-1 size-2 shrink-0 rounded-full", stateMeta[state].dot)} />
                      <span>
                        <span className="font-medium text-zinc-800">{stateMeta[state].label}.</span> {legendDetail[state]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Panel>
          <Panel position="bottom-left" className="!m-4">
            <div className="flex items-center gap-0.5 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
              <IconButton label="Zoom in" onClick={() => void flow.zoomIn({ duration: 150 })}>
                <Plus className="size-4" />
              </IconButton>
              <IconButton label="Zoom out" onClick={() => void flow.zoomOut({ duration: 150 })}>
                <Minus className="size-4" />
              </IconButton>
              <IconButton label="Fit map to screen" onClick={() => void flow.fitView({ padding: 0.25, maxZoom: 1, duration: 300 })}>
                <Maximize className="size-4" />
              </IconButton>
              <span className="mx-0.5 h-5 w-px bg-zinc-200" />
              <IconButton
                label="Tidy up layout"
                onClick={() => void onTidy().then(() => window.setTimeout(() => void flow.fitView({ padding: 0.25, maxZoom: 1, duration: 300 }), 50))}
                disabled={graph.features.length < 2}
              >
                <LayoutGrid className="size-4" />
              </IconButton>
            </div>
          </Panel>
        </ReactFlow>
        {graph.features.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="pointer-events-auto">{empty}</div>
          </div>
        ) : null}
      </div>
    </MapActionsContext.Provider>
  );
}
