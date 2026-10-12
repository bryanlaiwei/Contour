import { useState, type ReactNode } from "react";
import { agentLabel, productName } from "../format";
import { GithubMark, LogoMark } from "./GithubMark";
import { MacHelperDownload } from "./MacHelperDownload";
import { AgentBadge, Button, ErrorNote, StateBar, StateChip } from "./ui";

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
            Pull requests, CI, and sessions from Codex, Claude Code, and Cursor, grouped into features. Nobody has to update a board.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Setup
          </h2>
          <ol className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
            <li className="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <StepIndex>1</StepIndex>
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
            <li className="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <StepIndex>2</StepIndex>
              <h3 className="mt-3 text-base font-semibold text-zinc-900">Install the local helper</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                Paste this in Terminal on your Mac. Allow folder access, then connect this computer in Settings.
              </p>
              <div className="mt-auto pt-5">
                <MacHelperDownload />
              </div>
            </li>
          </ol>
        </section>

        <section className="mt-14 pb-12" aria-labelledby="guide-heading">
          <h2 id="guide-heading" className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            On the map
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            <GuideCard title="Features" detail="Related work stays on one card, with a status you can read at a glance.">
              <FeaturePreview />
            </GuideCard>
            <GuideCard title="Coding agents" detail="Sessions from Codex, Claude Code, and Cursor show up beside the code.">
              <AgentPreview />
            </GuideCard>
            <GuideCard title="The detail" detail="Open a feature for the pull request, CI, and the session that started it.">
              <DetailPreview />
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
    <li className="flex min-w-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="flex min-h-44 items-center rounded-xl bg-[#f7f7f8] p-3 ring-1 ring-zinc-200/70">
        <div className="w-full">{children}</div>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">{detail}</p>
    </li>
  );
}

function FeaturePreview() {
  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundImage: "radial-gradient(#d4d4d8 1px, transparent 1px)", backgroundSize: "14px 14px" }}
      aria-hidden
    >
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900">Billing</p>
          <span className="flex -space-x-1">
            <AgentBadge source="claude_code" size={16} />
            <AgentBadge source="cursor" size={16} />
          </span>
        </div>
        <div className="mt-3">
          <StateBar counts={{ in_progress: 1, in_review: 1 }} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">1 in progress · 1 in review</p>
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

function DetailPreview() {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-200" aria-hidden>
      <StateChip state="in_review" />
      <p className="mt-3 text-sm font-medium text-zinc-900">Add receipt export</p>
      <p className="mt-1 text-xs text-zinc-500">Pull request #128 · CI passed</p>
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
        <AgentBadge source="claude_code" size={18} />
        <span className="text-xs text-zinc-600">Claude Code session</span>
      </div>
    </div>
  );
}
