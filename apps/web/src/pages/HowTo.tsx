import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

const setupSteps = [
  {
    title: "Install the helper",
    body: "Paste the command on the main page into Terminal and allow folder access.",
  },
  {
    title: "Sign in and connect the repository",
    body: "Use a GitHub account that can write to it, and enter it as owner/name. Install the GitHub App if asked. You become the owner. GitHub activity shows up before the helper is connected.",
  },
  {
    title: "Connect this computer",
    body: "Open Settings → Local helper, click Connect this computer, and add the folder you work in. Only sessions inside that folder are collected.",
  },
] as const;

export function HowTo() {
  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-6 pb-16 sm:px-8 sm:py-8">
        <a href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-4" aria-hidden />
          Main page
        </a>

        <header className="mt-8 max-w-2xl sm:mt-10">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl">How to use Contour</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Contour maps one GitHub repository. Pull requests, Actions runs, and sessions from Codex, Claude Code, and Cursor become cards. The map keeps updating after you close the site.
          </p>
        </header>

        <section className="mt-14" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="text-sm font-medium text-zinc-500">
            Set it up
          </h2>
          <p className="mt-2 text-sm text-zinc-600">This release runs on a Mac.</p>
          <ol className="mt-4 space-y-4">
            {setupSteps.map((step, index) => (
              <li key={step.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
                <StepIndex>{String(index + 1)}</StepIndex>
                <h3 className="mt-3 text-base font-semibold text-zinc-900">{step.title}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-600">
                  {step.title === "Sign in and connect the repository" ? <RepositoryStep /> : step.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-white p-5 text-sm leading-relaxed text-zinc-600 shadow-sm ring-1 ring-zinc-200">
            On macOS 26 the menu bar icon can stay hidden. Turn on Contour in System Settings → Menu Bar → Allow in the Menu Bar. Safari 26 cannot reach the helper, even after you allow local network access. Connect from Chrome or another browser. You do not need the icon for that.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="text-sm font-medium text-zinc-500">
            Projects
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">Each repository is its own project. Switch from the project menu at the top of the map.</p>
          <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
            <Card title="New project">
              Choose New project in that menu. Install the GitHub App if needed, enter <Code>owner/name</Code>, and connect. Tracking starts then. Older pull requests, Actions runs, and sessions are not imported. An existing pull request shows up after its next update.
            </Card>
            <Card title="Delete project">
              Owners only. Settings → General → Delete project, then type the repository name. This removes the map, its history, and everyone’s access. Helpers stop uploading. The GitHub repository is not deleted.
            </Card>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="people-heading">
          <h2 id="people-heading" className="text-sm font-medium text-zinc-500">
            People and access
          </h2>
          <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
            <Card title="Owners">Invite and remove people, revoke a pending invite, delete the project, and disconnect any helper.</Card>
            <Card title="Members">
              They can use the map, change cards, and connect their own helper. They cannot invite, remove others, or delete the project. They can leave.
            </Card>
          </div>
          <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
            <AccessRow title="Invite">
              Settings → Members. Enter their GitHub username and click Invite. They must have signed in to Contour with that account once. The project then appears in their project menu. Pending invites stay under Waiting to accept, and the owner can revoke them.
            </AccessRow>
            <AccessRow title="Remove">Click Remove next to their name. They lose the map, and their helpers stop uploading. Past activity stays.</AccessRow>
            <AccessRow title="Leave">Click Leave next to your name. The only owner cannot leave. Delete the project instead.</AccessRow>
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="map-heading">
          <h2 id="map-heading" className="text-sm font-medium text-zinc-500">
            Read the map
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card title="What a card means">A card is a feature. A draft pull request is in progress, an open one is in review, and work is merged only when the pull requests say so.</Card>
            <Card title="Open a card">Open a card for its work items, then a work item for pull requests, CI, session excerpts, and history. Lines between cards are relationships.</Card>
            <Card title="Change the map">Drag cards, rename a title, or merge features and work items. Any member can do this.</Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function RepositoryStep() {
  return (
    <>
      Use a GitHub account that can write to it, and enter it as <Code>owner/name</Code>. Install the GitHub App if asked. You become the owner. GitHub activity shows up before the helper is connected.
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">{children}</p>
    </div>
  );
}

function AccessRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="px-5 py-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">{children}</p>
    </li>
  );
}

function StepIndex({ children }: { children: string }) {
  return <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{children}</span>;
}

function Code({ children }: { children: string }) {
  return <code className="font-mono text-[13px] text-zinc-800">{children}</code>;
}
