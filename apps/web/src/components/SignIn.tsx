import { ArrowRight, CircleCheck, GitPullRequest, MessagesSquare } from "lucide-react";
import { useState, type ReactNode } from "react";
import { agentLabel, productName } from "../format";
import { GithubMark, LogoMark } from "./GithubMark";
import { MacHelperDownload } from "./MacHelperDownload";
import { AgentBadge, Button, ErrorNote, StateBar } from "./ui";

const guideAgents = ["codex", "claude_code", "cursor"] as const;

export function SignIn({ onSignIn }: { onSignIn: () => Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative h-full overflow-x-hidden overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ backgroundImage: "radial-gradient(#d4d4d8 1.2px, transparent 1.2px)", backgroundSize: "22px 22px" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center gap-2.5">
          <LogoMark className="size-8" />
          <span className="text-sm font-semibold tracking-tight text-zinc-900">{productName}</span>
        </header>

        <section className="mt-14 max-w-2xl sm:mt-20">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl">A live map of the work.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600">
            Pull requests, CI, and coding-agent sessions become one map of progress, automatically.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Setup
          </h2>
          <ol className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
            <li className="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <StepIndex>1</StepIndex>
              <h3 className="mt-3 text-base font-semibold text-zinc-900">Install the local helper</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                Paste this in Terminal on your Mac. Allow folder access, then connect this computer in Settings.
              </p>
              <div className="mt-auto pt-5">
                <MacHelperDownload />
              </div>
            </li>
            <li className="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <StepIndex>2</StepIndex>
              <h3 className="mt-3 text-base font-semibold text-zinc-900">Continue with GitHub</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">Sign in with an account that can see the repository.</p>
              <div className="mt-auto pt-5">
                <Button
                  variant="primary"
                  className="h-11 w-full bg-zinc-900 text-[15px] hover:bg-zinc-800"
                  icon={<GithubMark className="size-5" />}
                  loading={busy}
                  onClick={() => {
                    setBusy(true);
                    void onSignIn().then((message) => {
                      setError(message);
                      setBusy(false);
                    });
                  }}
                >
                  Continue with GitHub
                </Button>
                {error ? (
                  <div className="mt-3">
                    <ErrorNote>{error}</ErrorNote>
                  </div>
                ) : null}
              </div>
            </li>
          </ol>
        </section>

        <section className="mt-14 pb-12" aria-labelledby="guide-heading">
          <h2 id="guide-heading" className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            On the map
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            <GuideCard title="Coding agents" detail="Codex, Claude Code, and Cursor sessions show up with the work.">
              <AgentPreview />
            </GuideCard>
            <GuideCard title="Progress" detail="Each feature shows how far the work has gotten.">
              <ProgressPreview />
            </GuideCard>
            <GuideCard title="Relationships" detail="One feature can wait on another.">
              <RelationshipPreview />
            </GuideCard>
            <GuideCard title="The record" detail="Open a feature for the pull request, the CI result, and the session.">
              <RecordPreview />
            </GuideCard>
          </ul>
        </section>
      </div>
    </div>
  );
}

function StepIndex({ children }: { children: string }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{children}</span>
  );
}

function GuideCard({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <li className="flex h-full min-w-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="flex min-h-44 flex-1 items-center rounded-xl bg-[#f7f7f8] p-3 ring-1 ring-zinc-200/70">
        <div className="w-full">{children}</div>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">{detail}</p>
    </li>
  );
}

function ProgressPreview() {
  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundImage: "radial-gradient(#d4d4d8 1px, transparent 1px)", backgroundSize: "14px 14px" }}
      aria-hidden
    >
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
        <p className="text-sm font-semibold text-zinc-900">Billing</p>
        <div className="mt-3">
          <StateBar counts={{ in_progress: 1, in_review: 1 }} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">1 in progress · 1 in review</p>
      </div>
    </div>
  );
}

function RelationshipPreview() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <MiniFeature title="Billing" counts={{ in_review: 1 }} />
      <div className="flex shrink-0 flex-col items-center gap-1 text-zinc-400">
        <span className="text-[10px] font-medium tracking-wide uppercase">waits for</span>
        <ArrowRight className="size-3.5" />
      </div>
      <MiniFeature title="Auth" counts={{ merged: 1 }} />
    </div>
  );
}

function MiniFeature({ title, counts }: { title: string; counts: Parameters<typeof StateBar>[0]["counts"] }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-zinc-200">
      <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
      <div className="mt-2">
        <StateBar counts={counts} />
      </div>
    </div>
  );
}

function AgentPreview() {
  return (
    <ul className="space-y-2" aria-hidden>
      {guideAgents.map((source) => (
        <li key={source} className="flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2 ring-1 ring-zinc-200">
          <AgentBadge source={source} size={22} />
          <span className="text-sm font-medium text-zinc-800">{agentLabel(source)}</span>
        </li>
      ))}
    </ul>
  );
}

const recordRows = [
  { label: "Pull request", detail: "Open, draft, or merged", icon: <GitPullRequest className="size-4" /> },
  { label: "CI", detail: "Passed or failed", icon: <CircleCheck className="size-4" /> },
  { label: "Session", detail: "What was asked, and what the agent did", icon: <MessagesSquare className="size-4" /> },
] as const;

function RecordPreview() {
  return (
    <ul className="space-y-2" aria-hidden>
      {recordRows.map((row) => (
        <li key={row.label} className="flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2 ring-1 ring-zinc-200">
          <span className="inline-flex size-7 shrink-0 items-center justify-center text-zinc-500">{row.icon}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-900">{row.label}</span>
            <span className="block text-xs text-zinc-500">{row.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
