import { useState } from "react";
import { GithubMark } from "../ui/GithubMark";
import { Button, ErrorNote } from "../ui/ui";
import { MacHelperDownload } from "./MacHelperDownload";
import { SampleMap } from "./SampleMap";

const mapNotes = [
  { title: "Coding agents", detail: "Work done by Codex, Claude Code, and Cursor shows up on the map." },
  { title: "Progress", detail: "Each card demonstrates how far along a feature is." },
  { title: "Relationships", detail: "Relationships between features show up on the map." },
  { title: "Details", detail: "Open a card to see information about the pull requests, the CI results, and key parts of the sessions." },
  { title: "Projects", detail: "Create, delete, or swap projects as you wish." },
] as const;

export function SignIn({ onSignIn }: { onSignIn: () => Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <section className="mt-6 max-w-2xl sm:mt-10">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl">A live map of the work.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600">
            Built from pull requests, Actions runs, and coding agent sessions.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="text-sm font-medium text-zinc-500">
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
          <h2 id="guide-heading" className="text-sm font-medium text-zinc-500">
            On the map
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
            <SampleMap />
            <ul className="grid grid-cols-1 gap-x-10 gap-y-6 border-t border-zinc-100 p-5 sm:grid-cols-2">
              {mapNotes.map((note) => (
                <li key={note.title}>
                  <h3 className="text-sm font-semibold text-zinc-900">{note.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{note.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function StepIndex({ children }: { children: string }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{children}</span>
  );
}

