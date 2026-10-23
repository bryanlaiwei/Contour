import { Activity, ChevronDown, KeyRound, Laptop, Settings2, Trash2, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { macHelperOpenCommand } from "@apm/shared";
import {
  addHelperFolder,
  api,
  errorMessage,
  pairLocalHelper,
  readHelperOverview,
  removeHelperFolder,
  removeHelperPairing,
  resetHelperLogRoot,
  scanHelper,
  setHelperLogRoot,
  type HelperFolder,
  type HelperOverview,
  type HelperProjectStatus,
  type HelperStatus,
  type ModelProviderId,
  type ModelSetup,
  type ProjectSettings,
  type SupplierModel,
} from "../api";
import { agentLabel, formatDateTime, timeAgo } from "../format";
import { cx, useNow } from "../helpers";
import { releaseChoosesModelKey, releaseSharesProjects } from "../release";
import { ConfirmDialog } from "../panel/Dialogs";
import { MacHelperDownload } from "./MacHelperDownload";
import { GithubMark } from "../ui/GithubMark";
import { useToast } from "../ui/toast-context";
import { AgentBadge, Avatar, Button, ErrorNote, Field, IconButton, Spinner, TimeAgo, inputClass } from "../ui/ui";

export type SettingsTab = "general" | "members" | "helper" | "model" | "health";

const tabs: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: "general", label: "General", icon: <Settings2 className="size-4" /> },
  { id: "members", label: "Members", icon: <Users className="size-4" /> },
  { id: "helper", label: "Local helper", icon: <Laptop className="size-4" /> },
  { id: "model", label: "Model", icon: <KeyRound className="size-4" /> },
  { id: "health", label: "Health", icon: <Activity className="size-4" /> },
];

const visibleTabs = tabs.filter((entry) => {
  if (entry.id === "members") {
    return releaseSharesProjects;
  }
  if (entry.id === "model") {
    return releaseChoosesModelKey;
  }
  return true;
});

export function SettingsDialog({
  token,
  projectId,
  tab,
  onTab,
  onClose,
  onProjectDeleted,
  onLeft,
}: {
  token: string;
  projectId: string;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
  onProjectDeleted: () => void;
  onLeft: () => void;
}) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSettings(await api.settings(token, projectId));
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason, "Could not load settings."));
    }
  }, [token, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-settings])')) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/25 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-settings
        onMouseDown={(event) => event.stopPropagation()}
        className="animate-in flex h-[min(760px,88vh)] w-full min-w-0 max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200 sm:flex-row"
      >
        <nav className="flex w-full shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/60 p-2.5 sm:w-48 sm:flex-col sm:flex-nowrap sm:items-stretch sm:gap-0.5 sm:border-r sm:border-b-0 sm:p-3">
          <p className="hidden px-2.5 pt-1 pb-3 text-sm font-semibold text-zinc-900 sm:block">Settings</p>
          {visibleTabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onTab(entry.id)}
              className={cx(
                "flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                tab === entry.id ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900",
              )}
            >
              {entry.icon}
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-100 px-4 sm:px-6">
            <h2 className="text-base font-semibold text-zinc-900">{visibleTabs.find((entry) => entry.id === tab)?.label}</h2>
            <IconButton label="Close settings" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            {!settings && !error ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : null}
            {settings ? (
              <>
                {tab === "general" ? <GeneralTab token={token} settings={settings} onDeleted={onProjectDeleted} /> : null}
                {releaseSharesProjects && tab === "members" ? <MembersTab token={token} settings={settings} reload={reload} onLeft={onLeft} /> : null}
                {tab === "helper" ? <HelperTab token={token} settings={settings} reload={reload} /> : null}
                {releaseChoosesModelKey && tab === "model" ? <ModelTab token={token} reload={reload} /> : null}
                {tab === "health" ? <HealthTab settings={settings} /> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 border-b border-zinc-100 py-3.5 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="min-w-0 text-right text-sm break-words text-zinc-900">{children}</span>
    </div>
  );
}

function GeneralTab({ token, settings, onDeleted }: { token: string; settings: ProjectSettings; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const repo = `${settings.project.owner}/${settings.project.name}`;
  return (
    <div className="space-y-8">
      <div>
        <Row label="Repository">
          <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-600">
            <GithubMark className="size-4" />
            {repo}
          </a>
        </Row>
        <Row label="Tracking since">{formatDateTime(settings.project.trackingStartedAt)}</Row>
      </div>
      <p className="text-sm leading-relaxed text-zinc-500">
        Only activity after tracking started is collected: new pull request and Actions updates, and agent sessions created after that time in the folders
        you choose on each computer.
      </p>
      {settings.role === "owner" ? (
        <div className="rounded-xl p-4 ring-1 ring-rose-200">
          <h3 className="text-sm font-semibold text-rose-700">Delete project</h3>
          <p className="mt-1 text-sm text-zinc-600">Removes the map, its evidence and history, and everyone’s access. Connected helpers stop uploading.</p>
          <Button variant="danger" size="sm" className="mt-3" icon={<Trash2 className="size-4" />} onClick={() => setConfirming(true)}>
            Delete project
          </Button>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          open
          onClose={() => setConfirming(false)}
          title="Delete this project?"
          description="This cannot be undone. The GitHub repository itself is not touched."
          confirmLabel="Delete project"
          danger
          requireText={repo}
          onConfirm={async () => {
            await api.deleteProject(token, settings.project.id);
            onDeleted();
          }}
        />
      ) : null}
    </div>
  );
}

function MembersTab({ token, settings, reload, onLeft }: { token: string; settings: ProjectSettings; reload: () => Promise<void>; onLeft: () => void }) {
  const toast = useToast();
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectSettings["members"][number] | null>(null);
  const owner = settings.role === "owner";

  async function invite(event: FormEvent) {
    event.preventDefault();
    const name = login.trim().replace(/^@/, "");
    if (!name) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.invite(token, settings.project.id, name);
      setLogin("");
      await reload();
      toast(`Added @${name}`);
    } catch (reason) {
      setError(errorMessage(reason, "Could not send the invitation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      {owner ? (
        <form onSubmit={(event) => void invite(event)} className="space-y-2">
          <label className="block text-sm font-medium text-zinc-800" htmlFor="invite-login">
            Invite a teammate
          </label>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-48">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">@</span>
              <input
                id="invite-login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="github-username"
                autoComplete="off"
                className={cx(inputClass, "pl-7")}
              />
            </div>
            <Button type="submit" variant="primary" icon={<UserPlus className="size-4" />} loading={busy} disabled={login.trim() === ""}>
              Invite
            </Button>
          </div>
          <p className="text-xs text-zinc-500">They need to have signed in here with that GitHub account. The project then shows up in their project menu.</p>
          <ErrorNote>{error}</ErrorNote>
        </form>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">People</h3>
        <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
          {settings.members.map((member) => (
            <li key={member.userId} className="flex flex-col items-start gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3">
              {member.githubLogin ? <Avatar login={member.githubLogin} src={member.avatarUrl} size={32} /> : <span className="size-8 rounded-full bg-zinc-200" />}
              <div className="min-w-0 grow basis-40">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {member.name ?? (member.githubLogin ? `@${member.githubLogin}` : "Unknown member")}
                  {member.you ? <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {member.githubLogin && member.name ? `@${member.githubLogin} · ` : ""}joined <TimeAgo iso={member.joinedAt} />
                </p>
              </div>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  member.role === "owner" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600",
                )}
              >
                {member.role === "owner" ? "Owner" : "Member"}
              </span>
              {(owner && !member.you) || (member.you && member.role !== "owner") ? (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(member)}>
                  {member.you ? "Leave" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {settings.invitations.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Waiting to accept</h3>
          <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
            {settings.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-col items-start gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <Avatar login={invitation.githubLogin} size={28} />
                <div className="min-w-0 grow basis-40">
                  <p className="truncate text-sm font-medium text-zinc-900">@{invitation.githubLogin}</p>
                  <p className="truncate text-xs text-zinc-500">
                    Invited {invitation.invitedBy ? `by @${invitation.invitedBy} ` : ""}
                    <TimeAgo iso={invitation.createdAt} />
                  </p>
                </div>
                {owner ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void api
                        .revokeInvitation(token, settings.project.id, invitation.id)
                        .then(reload)
                        .then(() => toast("Invitation revoked"))
                        .catch((reason: unknown) => toast(errorMessage(reason, "Could not revoke the invitation."), "error"))
                    }
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {removing ? (
        <ConfirmDialog
          open
          onClose={() => setRemoving(null)}
          title={removing.you ? "Leave this project?" : `Remove ${removing.githubLogin ? `@${removing.githubLogin}` : "this member"}?`}
          description={
            removing.you
              ? "You lose access to the map. Helpers you connected stop uploading."
              : "They lose access to the map, and helpers they connected stop uploading. Their past activity stays on the map."
          }
          confirmLabel={removing.you ? "Leave project" : "Remove"}
          danger
          onConfirm={async () => {
            await api.removeMember(token, settings.project.id, removing.userId);
            if (removing.you) {
              onLeft();
              return;
            }
            await reload();
            toast("Member removed");
          }}
        />
      ) : null}
    </div>
  );
}

function HelperTab({ token, settings, reload }: { token: string; settings: ProjectSettings; reload: () => Promise<void> }) {
  const toast = useToast();
  const [overview, setOverview] = useState<HelperOverview | null | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(10_000);

  const refresh = useCallback(async () => {
    const next = await readHelperOverview();
    setOverview(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      void readHelperOverview().then((next) => {
        if (!cancelled) {
          setOverview(next);
        }
      });
    check();
    const timer = window.setInterval(check, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function run(action: () => Promise<void>, success: string, fallback: string): Promise<boolean> {
    setError(null);
    try {
      await action();
      await refresh();
      toast(success);
      return true;
    } catch (reason) {
      setError(errorMessage(reason, fallback));
      return false;
    }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    let code: string;
    try {
      code = (await api.pairingCode(token, settings.project.id)).code;
    } catch (reason) {
      setError(errorMessage(reason, "Could not create a pairing code."));
      setConnecting(false);
      return;
    }
    try {
      await pairLocalHelper(code);
      await refresh();
      await reload();
      toast("Helper connected. Add the folder where you work on this project.");
    } catch (reason) {
      setError(
        reason instanceof TypeError ? "The helper is not running on this computer." : errorMessage(reason, "Pairing failed."),
      );
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectHere() {
    setDisconnecting(true);
    const ok = await run(() => removeHelperPairing(settings.project.id), "This computer stopped collecting for this project.", "Could not disconnect this computer.");
    if (ok) {
      await reload();
    }
    setDisconnecting(false);
  }

  async function addFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const path = String(new FormData(form).get("path") ?? "").trim();
    setAdding(true);
    if (await run(() => addHelperFolder(settings.project.id, path), "Folder added.", "Could not add that folder.")) {
      form.reset();
    }
    setAdding(false);
  }

  const running = overview !== null && overview !== undefined;
  const status = overview?.status ?? null;
  // Pairing rows change as soon as this computer disconnects. The status snapshot can lag until the next scan.
  const pairedHere = running && overview.pairings.some((entry) => entry.projectId === settings.project.id);
  const here = pairedHere ? status?.projects.find((entry) => entry.projectId === settings.project.id) : undefined;
  const others = running ? overview.pairings.filter((entry) => entry.projectId !== settings.project.id).length : 0;
  const folders = running ? overview.folders.filter((folder) => folder.enabled && folder.projectId === settings.project.id) : [];
  const connected = pairedHere && here?.needsPairing !== true;
  const folderCount = folders.length;
  const tone = !running ? "bg-zinc-300" : connected && folderCount > 0 ? "bg-emerald-500" : "bg-amber-400";

  return (
    <div className="space-y-7">
      <div className="space-y-1 text-sm leading-relaxed text-zinc-600">
        <p>macOS 26 can hide the menu bar icon. Allow Contour in System Settings → Menu Bar.</p>
        <p>Safari 26 cannot reach the helper. Connect from Chrome or another browser.</p>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="rounded-xl p-4 ring-1 ring-zinc-200">
        <div className="flex items-start gap-3">
          <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", tone)} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900">This computer</p>
            <p className="mt-0.5 text-sm text-zinc-500">
                {overview === undefined
                  ? "Checking for the helper…"
                  : !running
                    ? "The helper is not running on this computer."
                    : !pairedHere
                      ? `Running, but not connected to this project yet.${others > 0 ? ` It keeps collecting for ${others} other project${others === 1 ? "" : "s"}.` : ""}`
                      : here?.needsPairing
                        ? "The server no longer accepts this computer for this project. Reconnect it."
                        : folderCount === 0
                          ? "Connected. Add the folder where you work on this project so sessions are collected."
                          : `${folderCount} folder${folderCount === 1 ? "" : "s"} selected · last upload ${timeAgo(here?.lastUploadAt ?? null, now)}${(here?.queued ?? 0) > 0 ? ` · ${here?.queued} waiting` : ""}`}
            </p>
            {here?.lastError && !here.needsPairing ? <p className="mt-1 text-xs break-words text-rose-600">{here.lastError}</p> : null}
            {overview !== undefined && !connected ? (
              <div className="mt-3">
                <MacHelperDownload command={macHelperOpenCommand} />
              </div>
            ) : null}
            <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button size="sm" variant={connected ? "secondary" : "primary"} loading={connecting} onClick={() => void connect()}>
                {pairedHere ? "Reconnect" : "Connect this computer"}
              </Button>
              {pairedHere ? (
                <Button size="sm" variant="ghost" className="-ml-2.5 sm:ml-0" loading={disconnecting} onClick={() => void disconnectHere()}>
                  Disconnect this computer
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {connected ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Folders</h3>
          <p className="mb-2 text-sm text-zinc-500">Sessions are collected only when their working folder is inside one of these.</p>
          {folders.length > 0 ? (
            <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
              {folders.map((folder) => (
                <HelperFolderRow
                  key={folder.id}
                  folder={folder}
                  removing={removingId === folder.id}
                  onRemove={() => {
                    setRemovingId(folder.id);
                    return run(() => removeHelperFolder(folder.id), "Folder removed.", "Could not remove that folder.").finally(() => setRemovingId(null));
                  }}
                />
              ))}
            </ul>
          ) : null}
          <form className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center" onSubmit={(event) => void addFolder(event)}>
            <input
              name="path"
              required
              spellCheck={false}
              placeholder="/path/to/your/clone"
              aria-label="Folder for this project"
              autoFocus={folderCount === 0}
              className={cx(inputClass, "min-w-0 font-mono text-xs sm:flex-1")}
            />
            <Button type="submit" variant={folderCount === 0 ? "primary" : "secondary"} className="self-end sm:self-auto" loading={adding}>
              Add folder
            </Button>
          </form>
          {here && here.paused.length > 0 ? <PausedSessions project={here} /> : null}
        </div>
      ) : null}

      {running && overview ? (
        <CollectionSection
          overview={overview}
          status={status}
          scanning={scanning}
          onScan={() => {
            setScanning(true);
            void run(scanHelper, "Scan finished.", "Scan failed.").finally(() => setScanning(false));
          }}
          onSetLogRoot={(id, path) => run(() => setHelperLogRoot(id, path), "Session folder updated.", "Could not update that folder.")}
          onResetLogRoot={(id) => run(() => resetHelperLogRoot(id), "Using the default session folder.", "Could not restore the default folder.")}
        />
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Connected helpers</h3>
        {settings.devices.length === 0 ? (
          <p className="text-sm text-zinc-500">No helpers are connected. GitHub activity still appears without one.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
            {settings.devices.map((device) => (
              <li key={device.id} className="flex flex-col items-start gap-1 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                  <Laptop className="mt-0.5 size-5 shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words text-zinc-900">
                      {device.label}
                      {device.pairedBy ? <span className="font-normal text-zinc-500"> · @{device.pairedBy}</span> : null}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {device.lastSeenAt ? `Last seen ${timeAgo(device.lastSeenAt, now)}` : "Not seen since connecting"} · connected {timeAgo(device.createdAt, now)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FolderPath({ path }: { path: string }) {
  const segments = path.split("/");
  return (
    <p title={path} className="min-w-0 font-mono text-xs leading-5 text-zinc-700 sm:flex-1 sm:truncate">
      {segments.map((segment, index) => (
        <span key={`${index}-${segment}`}>
          {index > 0 ? "/" : ""}
          {segment}
          {index < segments.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </p>
  );
}

function HelperFolderRow({ folder, removing, onRemove }: { folder: HelperFolder; removing: boolean; onRemove: () => Promise<boolean> }) {
  return (
    <li className="flex flex-col items-start gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <FolderPath path={folder.canonicalPath} />
      <Button size="sm" variant="ghost" className="self-end sm:self-auto" loading={removing} onClick={() => void onRemove()}>
        Remove
      </Button>
    </li>
  );
}

function PausedSessions({ project }: { project: HelperProjectStatus }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-600">Paused sessions. Their log file was replaced or shortened.</p>
      <ul className="mt-2 space-y-1.5">
        {project.paused.map((item) => (
          <li key={`${item.provider}:${item.sessionId}`} className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-zinc-700">
            <AgentBadge source={item.provider} size={18} />
            <span className="min-w-0 font-mono text-xs break-all">{item.sessionId}</span>
            <span className="text-xs text-zinc-500">{item.reason ?? "paused"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollectionSection({
  overview,
  status,
  scanning,
  onScan,
  onSetLogRoot,
  onResetLogRoot,
}: {
  overview: HelperOverview;
  status: HelperStatus | null;
  scanning: boolean;
  onScan: () => void;
  onSetLogRoot: (id: string, path: string) => Promise<boolean>;
  onResetLogRoot: (id: string) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function save(id: string, path: string) {
    setSavingId(id);
    if (await onSetLogRoot(id, path)) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
    setSavingId(null);
  }

  async function reset(id: string) {
    setSavingId(id);
    if (await onResetLogRoot(id)) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
    setSavingId(null);
  }
  const rows: Array<[string, string]> = status
    ? [
        ["Last upload", status.lastUploadAt ? formatDateTime(status.lastUploadAt) : "Not yet"],
        ["Waiting to upload", String(status.queued)],
        ["Uploaded since start", String(status.uploaded)],
        ["Dropped since start", String(status.dropped)],
      ]
    : [];
  if (status?.nextUploadAt) {
    rows.push(["Next upload attempt", formatDateTime(status.nextUploadAt)]);
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Agent logs</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
          Where each agent writes its sessions. Each path starts as the default. Counts are for every project on this computer.
        </p>
      </div>
      {overview.logRoots.length === 0 ? (
        <p className="text-sm text-zinc-500">No agent log directories were found on this computer.</p>
      ) : (
        <ul className="space-y-3">
          {overview.logRoots.map((root) => {
            const value = drafts[root.id] ?? root.path;
            const dirty = value.trim() !== root.path;
            return (
              <li key={root.id} className="rounded-xl p-3 ring-1 ring-zinc-200">
                <div className="mb-2 flex items-center gap-2">
                  <AgentBadge source={root.id} size={22} />
                  <p className="text-sm font-medium text-zinc-900">{agentLabel(root.id)}</p>
                  <span className="text-xs text-zinc-400">{root.custom ? "Custom" : "Default"}</span>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <input
                    value={value}
                    spellCheck={false}
                    aria-label={`${agentLabel(root.id)} session folder`}
                    onChange={(event) => setDrafts((current) => ({ ...current, [root.id]: event.target.value }))}
                    className={cx(inputClass, "min-w-0 font-mono text-xs sm:flex-1")}
                  />
                  <Button
                    type="button"
                    variant={dirty ? "primary" : "secondary"}
                    className="self-end sm:self-auto"
                    disabled={!dirty || value.trim() === ""}
                    loading={savingId === root.id}
                    onClick={() => void save(root.id, value.trim())}
                  >
                    Save
                  </Button>
                </div>
                {root.custom ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                    disabled={savingId === root.id}
                    onClick={() => void reset(root.id)}
                  >
                    Use default
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {status ? (
        <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-zinc-200">
          <dl className="divide-y divide-zinc-100">
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-3.5 py-1.5">
              <dt className="mr-auto text-sm text-zinc-500">Last scan</dt>
              <dd className="contents">
                <span className="text-sm whitespace-nowrap text-zinc-900 tabular-nums">{status.lastScanAt ? formatDateTime(status.lastScanAt) : "Not yet"}</span>
                <Button size="sm" variant="ghost" className="-mr-2" loading={scanning} onClick={onScan}>
                  Scan now
                </Button>
              </dd>
            </div>
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-0.5 px-3.5 py-2.5">
                <dt className="mr-auto text-sm text-zinc-500">{label}</dt>
                <dd className="text-sm whitespace-nowrap text-zinc-900 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function HealthItem({ tone, title, children }: { tone: "good" | "warn" | "bad" | "idle"; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-4 ring-1 ring-zinc-200">
      <span
        className={cx(
          "mt-1.5 size-2.5 shrink-0 rounded-full",
          tone === "good" && "bg-emerald-500",
          tone === "warn" && "bg-amber-400",
          tone === "bad" && "bg-rose-500",
          tone === "idle" && "bg-zinc-300",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        <div className="mt-0.5 space-y-0.5 text-sm text-zinc-500">{children}</div>
      </div>
    </div>
  );
}

function providerLabel(provider: "openai" | "anthropic" | "gemini" | null): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
    case null:
      return "saved";
    default: {
      const unhandled: never = provider;
      return unhandled;
    }
  }
}

function modelSourceLine(model: ProjectSettings["health"]["analysis"]["model"]): string {
  switch (model.source) {
    case "owner":
    case "server":
      return "Using the server OpenAI key.";
    case "none":
      return "No server OpenAI key is set, so new work is not grouped yet.";
    default: {
      const unhandled: never = model.source;
      return unhandled;
    }
  }
}

function HealthTab({ settings }: { settings: ProjectSettings }) {
  const now = useNow(10_000);
  const { github, local, analysis } = settings.health;
  const waitingMinutes = analysis.waitingSince ? (now - Date.parse(analysis.waitingSince)) / 60_000 : 0;
  const analysisTone = analysis.lastFailure || waitingMinutes > 5 ? "warn" : analysis.waiting > 0 ? "good" : analysis.lastAnalyzedAt ? "good" : "idle";
  return (
    <div className="space-y-3">
      <HealthItem tone={github.failedDeliveries > 0 ? "warn" : github.lastDeliveryAt ? "good" : "idle"} title="GitHub">
        <p>{github.lastDeliveryAt ? `Last webhook received ${timeAgo(github.lastDeliveryAt, now)}.` : "No webhooks received yet."}</p>
        {github.waitingDeliveries > 0 ? <p>{github.waitingDeliveries} deliveries are waiting to be processed.</p> : null}
        {github.failedDeliveries > 0 ? <p className="text-amber-700">{github.failedDeliveries} deliveries failed after several attempts.</p> : null}
      </HealthItem>
      <HealthItem tone={local.lastSessionEventAt ? "good" : "idle"} title="Agent sessions">
        <p>{local.lastSessionEventAt ? `Last session activity received ${timeAgo(local.lastSessionEventAt, now)}.` : "No session activity received yet."}</p>
      </HealthItem>
      <HealthItem tone={analysisTone} title="AI analysis">
        {analysis.waiting > 0 ? (
          <p>
            {analysis.waiting} update{analysis.waiting === 1 ? "" : "s"} waiting since {timeAgo(analysis.waitingSince, now)}.
            {waitingMinutes > 5 ? " The worker may not be running, or OPENAI_API_KEY is not set." : ""}
          </p>
        ) : (
          <p>Nothing is waiting.</p>
        )}
        <p>{analysis.lastAnalyzedAt ? `Last analyzed ${timeAgo(analysis.lastAnalyzedAt, now)}.` : "Nothing has been analyzed yet."}</p>
        <p>{modelSourceLine(analysis.model)}</p>
        {analysis.lastFailure ? (
          <p className="text-amber-700">
            Last attempt failed {timeAgo(analysis.lastFailure.at, now)}: {analysis.lastFailure.error}
          </p>
        ) : null}
        {analysis.gaveUp > 0 ? <p className="text-amber-700">{analysis.gaveUp} updates could not be analyzed after several attempts.</p> : null}
      </HealthItem>
    </div>
  );
}

function ModelTab({ token, reload }: { token: string; reload: () => Promise<void> }) {
  const toast = useToast();
  const [setup, setSetup] = useState<ModelSetup | null>(null);
  const [provider, setProvider] = useState<ModelProviderId>("openai");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<SupplierModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .modelSetup(token)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setSetup(value);
        setProvider(value.credential?.provider ?? "openai");
        setModel(value.credential?.model ?? "");
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(errorMessage(reason, "Could not load the model key."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!setup) {
      return;
    }
    const typed = apiKey.trim();
    const useSaved = typed === "" && setup.credential?.provider === provider;
    if (typed.length < 12 && !useSaved) {
      setModels([]);
      setModelsLoading(false);
      setModelsError(null);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    const handle = window.setTimeout(() => {
      void api
        .supplierModels(token, { provider, apiKey: typed })
        .then((value) => {
          if (cancelled) {
            return;
          }
          const saved = setup.credential?.provider === provider ? setup.credential.model : null;
          const next = saved && !value.models.some((item) => item.id === saved) ? [{ id: saved, label: saved }, ...value.models] : value.models;
          setModels(next);
          setModel((current) => {
            if (next.some((item) => item.id === current)) {
              return current;
            }
            if (saved && next.some((item) => item.id === saved)) {
              return saved;
            }
            const preferred = setup.providers.find((entry) => entry.id === provider)?.defaultModel;
            if (preferred && next.some((item) => item.id === preferred)) {
              return preferred;
            }
            return next[0]?.id ?? "";
          });
          setModelsError(null);
        })
        .catch((reason: unknown) => {
          if (cancelled) {
            return;
          }
          setModels([]);
          setModelsError(errorMessage(reason, "Could not load models."));
        })
        .finally(() => {
          if (!cancelled) {
            setModelsLoading(false);
          }
        });
    }, typed === "" ? 0 : 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [apiKey, provider, setup, token]);

  const selected = setup?.providers.find((entry) => entry.id === provider);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveModelCredential(token, { provider, apiKey, model });
      setSetup((current) => (current ? { ...current, credential: saved } : current));
      setApiKey("");
      setShowKey(false);
      setModel(saved.model);
      await reload();
      toast("Model key saved");
    } catch (reason) {
      setError(errorMessage(reason, "Could not save the model key."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteModelCredential(token);
      setSetup((current) => (current ? { ...current, credential: null } : current));
      setApiKey("");
      setModel("");
      setModels([]);
      await reload();
      toast("Model key removed");
    } catch (reason) {
      setError(errorMessage(reason, "Could not remove the model key."));
    } finally {
      setBusy(false);
    }
  }

  if (!setup && !error) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-zinc-500">
        Grouping work into the map uses a model key you provide. OpenAI, Anthropic, and Gemini are supported. The key is stored encrypted, and only its last
        four characters are shown again. Repositories you own are analyzed with your key. When several owners have saved one, the key saved most recently is
        used.
        {setup?.serverFallback
          ? " If no owner has saved a key, analysis uses the server OpenAI key."
          : " If no owner has saved a key, analysis waits until one is added."}
      </p>
      {setup?.credential ? (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-xl p-4 ring-1 ring-zinc-200">
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-sm font-medium text-zinc-900">
              {providerLabel(setup.credential.provider)}
              <span className="font-normal text-zinc-500"> · key ending in {setup.credential.hint}</span>
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Model {setup.credential.model} · updated <TimeAgo iso={setup.credential.updatedAt} />
            </p>
          </div>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
            Remove
          </Button>
        </div>
      ) : null}
      {setup ? (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <Field label="Supplier" hint={selected?.keyHint}>
            <div className="relative">
              <select
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as ModelProviderId);
                  setModel("");
                  setModels([]);
                }}
                className={cx(inputClass, "appearance-none pr-9")}
              >
                {setup.providers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </Field>
          <Field
            label="Model"
            hint={
              modelsLoading
                ? "Loading models from this supplier."
                : models.length > 0
                  ? "Models from this supplier that can generate text."
                  : "Paste an API key to load this supplier's models."
            }
          >
            <div className="relative">
              <select
                value={models.some((item) => item.id === model) ? model : ""}
                onChange={(event) => setModel(event.target.value)}
                disabled={modelsLoading || models.length === 0}
                className={cx(inputClass, "appearance-none pr-9 disabled:bg-zinc-50 disabled:text-zinc-500")}
              >
                {models.length === 0 ? (
                  <option value="">{modelsLoading ? "Loading models…" : "Paste an API key to load models"}</option>
                ) : (
                  models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label === item.id ? item.id : `${item.label} (${item.id})`}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </Field>
          <Field label="API key" hint={setup.credential ? `Paste a new key to replace the one ending in ${setup.credential.hint}.` : "Paste the key from the supplier."}>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={cx(inputClass, "pr-16")}
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          <ErrorNote>{modelsError}</ErrorNote>
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" variant="primary" loading={busy} disabled={apiKey.trim() === "" || model === "" || modelsLoading}>
            Save key
          </Button>
        </form>
      ) : (
        <ErrorNote>{error}</ErrorNote>
      )}
    </div>
  );
}
