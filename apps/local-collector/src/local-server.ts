// HTTP API on this computer that the web app uses to pair, choose folders, and see helper status.
// It accepts connections only from this machine. The pages themselves live in the web app.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { realpathSync, statSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { sep } from "node:path";
import { agents } from "./agents.js";
import type { LogRoots } from "./collection-pass.js";
import { applyLogRootOverrides, type CollectorStatus } from "./collector-loop.js";
import type { SessionAgentId } from "./contract/adapter.js";
import type { LogAccess } from "./log-access.js";
import { LocalDb, type PairingRecord } from "./local-db.js";

const defaultPort = 47321;

export type LocalServerOptions = {
  db: LocalDb;
  port?: number;
  webOrigin?: string;
  fetchImpl?: typeof fetch;
  logRoots?: LogRoots;
  /** Defaults before a person chooses a different folder. The effective `logRoots` object is updated in place. */
  defaultLogRoots?: LogRoots;
  onLogRootsChanged?: () => void;
  status?: () => CollectorStatus;
  scanNow?: () => Promise<unknown>;
  /** When set, only this website may call the helper. Local development also allows the Vite origin. */
  strictWebOrigin?: boolean;
  logAccess?: () => LogAccess[];
  pause?: () => void;
  resume?: () => void;
};

export async function startLocalServer(options: LocalServerOptions): Promise<Server> {
  const webOrigin = options.webOrigin ?? "http://127.0.0.1:5173";
  const strictWebOrigin = options.strictWebOrigin === true;
  const fetchImpl = options.fetchImpl ?? fetch;

  const server = createServer(async (req, res) => {
    const port = (server.address() as AddressInfo).port;
    if (!isLoopback(req) || !hostAllowed(req, port)) {
      send(res, 403, { error: "The helper only accepts connections from this computer." });
      return;
    }
    if (!originAllowed(req, webOrigin, port, strictWebOrigin)) {
      send(res, 403, { error: "This origin is not allowed to talk to the helper." });
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(req, webOrigin, port, strictWebOrigin));
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        send(
          res,
          200,
          {
            pairings: options.db.pairings().map((pairing) => ({
              projectId: pairing.projectId,
              projectName: pairing.projectName,
              trackingStartedAt: pairing.trackingStartedAt,
              apiUrl: pairing.apiUrl,
            })),
            folders: options.db.folders().map((folder) => ({
              id: folder.id,
              projectId: folder.projectId,
              canonicalPath: folder.canonicalPath,
              enabled: folder.enabled,
            })),
            logRoots: logRootList(options),
            logAccess: options.logAccess?.() ?? [],
            status: options.status?.() ?? null,
          },
          req,
          webOrigin,
        );
        return;
      }
      if (req.method === "POST" && url.pathname === "/pair") {
        const body = await readJson(req);
        const code = typeof body.code === "string" ? body.code.trim() : "";
        const apiUrl = typeof body.apiUrl === "string" && body.apiUrl.trim() !== "" ? body.apiUrl.trim() : "http://127.0.0.1:4000";
        if (code === "") {
          send(res, 400, { error: "A pairing code is required." }, req, webOrigin);
          return;
        }
        const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/helper/pair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !isPairPayload(payload)) {
          const message =
            typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Pairing failed.";
          send(res, 401, { error: message }, req, webOrigin);
          return;
        }
        const replaced = options.db.savePairing({
          projectId: payload.projectId,
          projectName: typeof payload.projectName === "string" ? payload.projectName : null,
          trackingStartedAt: payload.trackingStartedAt,
          apiUrl,
          deviceToken: payload.token,
          deviceId: payload.deviceId,
        });
        if (replaced && replaced.deviceToken !== payload.token) {
          void revokeToken(fetchImpl, replaced);
        }
        void options.scanNow?.();
        send(res, 201, { paired: true, projectId: payload.projectId }, req, webOrigin);
        return;
      }
      if (req.method === "GET" && url.pathname === "/status") {
        send(res, 200, { status: options.status?.() ?? null }, req, webOrigin);
        return;
      }
      if (req.method === "POST" && (url.pathname === "/control/pause" || url.pathname === "/control/resume")) {
        if (typeof req.headers.origin === "string") {
          send(res, 403, { error: "Pause and resume are only available from the menu bar on this computer." }, req, webOrigin);
          return;
        }
        if (url.pathname === "/control/pause") {
          options.pause?.();
        } else {
          options.resume?.();
        }
        send(res, 200, { status: options.status?.() ?? null }, req, webOrigin);
        return;
      }
      if (!fromWebApp(req, webOrigin, port, strictWebOrigin)) {
        send(res, 401, { error: "Open the helper from the web app on this computer." }, req, webOrigin);
        return;
      }
      if (req.method === "POST" && url.pathname === "/scan") {
        await options.scanNow?.();
        send(res, 200, { status: options.status?.() ?? null }, req, webOrigin);
        return;
      }
      if (req.method === "POST" && url.pathname === "/folders") {
        const body = await readJson(req);
        const folderPath = typeof body.path === "string" ? body.path.trim() : "";
        const pairings = options.db.pairings();
        const requested = typeof body.projectId === "string" ? body.projectId : null;
        const pairing = requested ? pairings.find((entry) => entry.projectId === requested) : pairings.length === 1 ? pairings[0] : undefined;
        if (!pairing) {
          const error =
            pairings.length === 0
              ? "Pair the helper before selecting folders."
              : requested
                ? "This computer is not connected to that project. Connect it from the project's Settings first."
                : "Choose which project this folder is for.";
          send(res, pairings.length === 0 || requested ? 409 : 400, { error }, req, webOrigin);
          return;
        }
        let canonical: string;
        try {
          canonical = realpathSync(folderPath);
        } catch {
          send(res, 400, { error: "That folder does not exist." }, req, webOrigin);
          return;
        }
        const clash = options.db
          .folders()
          .find((folder) => folder.enabled && folder.projectId !== pairing.projectId && overlaps(folder.canonicalPath, canonical));
        if (clash) {
          const owner = pairings.find((entry) => entry.projectId === clash.projectId);
          const name = owner?.projectName ?? "another project";
          send(
            res,
            409,
            { error: `That folder overlaps ${clash.canonicalPath}, which collects for ${name}. A session can only go to one project.` },
            req,
            webOrigin,
          );
          return;
        }
        const saved = options.db.addFolder(pairing.projectId, canonical, new Date().toISOString());
        void options.scanNow?.();
        send(res, 201, { folder: saved }, req, webOrigin);
        return;
      }
      if (req.method === "POST" && url.pathname.startsWith("/folders/") && url.pathname.endsWith("/disable")) {
        const id = decodeURIComponent(url.pathname.slice("/folders/".length, -"/disable".length));
        const folder = options.db.folders().find((entry) => entry.id === id);
        options.db.setFolderEnabled(id, false);
        if (folder) {
          options.db.dropUnselected(folder.projectId, options.db.enabledRoots(folder.projectId));
        }
        send(res, 204, null, req, webOrigin);
        return;
      }
      if (req.method === "POST" && (url.pathname === "/log-roots" || url.pathname === "/log-roots/reset")) {
        const body = await readJson(req);
        const id = typeof body.id === "string" ? body.id : "";
        if (!isAgentId(id)) {
          send(res, 400, { error: "Choose Codex, Claude Code, or Cursor." }, req, webOrigin);
          return;
        }
        if (url.pathname === "/log-roots/reset") {
          options.db.setLogRootOverride(id, null);
        } else {
          const folderPath = typeof body.path === "string" ? body.path.trim() : "";
          if (folderPath === "") {
            send(res, 400, { error: "A folder path is required." }, req, webOrigin);
            return;
          }
          let canonical: string;
          try {
            canonical = realpathSync(folderPath);
          } catch {
            send(res, 400, { error: "That folder does not exist." }, req, webOrigin);
            return;
          }
          if (!statSync(canonical).isDirectory()) {
            send(res, 400, { error: "That path is not a folder." }, req, webOrigin);
            return;
          }
          options.db.setLogRootOverride(id, canonical);
        }
        options.onLogRootsChanged?.();
        void options.scanNow?.();
        send(res, 200, { logRoots: logRootList(options) }, req, webOrigin);
        return;
      }
      if (req.method === "POST" && url.pathname.startsWith("/pairings/") && url.pathname.endsWith("/remove")) {
        const projectId = decodeURIComponent(url.pathname.slice("/pairings/".length, -"/remove".length));
        const removed = options.db.removePairing(projectId);
        if (!removed) {
          send(res, 404, { error: "This computer is not connected to that project." }, req, webOrigin);
          return;
        }
        void revokeToken(fetchImpl, removed);
        send(res, 204, null, req, webOrigin);
        return;
      }
      send(res, 404, { error: "Not found." }, req, webOrigin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Helper request failed.";
      send(res, 500, { error: message }, req, webOrigin);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? defaultPort, "127.0.0.1", () => resolve());
  });
  return server;
}

/** Tells the API to stop accepting a token this helper no longer uses. Best effort: the server may be offline. */
async function revokeToken(fetchImpl: typeof fetch, pairing: PairingRecord): Promise<void> {
  try {
    await fetchImpl(`${pairing.apiUrl.replace(/\/$/, "")}/helper/token`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${pairing.deviceToken}` },
    });
  } catch {
    // The server shows the device as unused; an owner can still disconnect it from Settings.
  }
}

/** True when one folder is the other or sits inside it. */
function overlaps(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}${sep}`) || b.startsWith(`${a}${sep}`);
}

function isPairPayload(
  value: unknown,
): value is { token: string; deviceId: string; projectId: string; trackingStartedAt: string; projectName?: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.token === "string" &&
    typeof record.deviceId === "string" &&
    typeof record.projectId === "string" &&
    typeof record.trackingStartedAt === "string"
  );
}

function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/** Rejects requests whose Host is not this computer, so a rebound DNS name cannot reach the helper. */
function hostAllowed(req: IncomingMessage, port: number): boolean {
  const host = (req.headers.host ?? "").toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}` || host === `[::1]:${port}`;
}

function isAgentId(value: string): value is SessionAgentId {
  return agents.some((agent) => agent.id === value);
}

function effectiveLogRoots(options: LocalServerOptions): LogRoots {
  const defaults = options.defaultLogRoots ?? options.logRoots ?? {};
  if (!options.defaultLogRoots) {
    return { ...defaults };
  }
  const overrides: LogRoots = {};
  for (const agent of agents) {
    const path = options.db.logRootOverride(agent.id);
    if (path) {
      overrides[agent.id] = path;
    }
  }
  const effective: LogRoots = {};
  applyLogRootOverrides(effective, defaults, overrides);
  return effective;
}

function logRootList(options: LocalServerOptions): Array<{ id: string; path: string; defaultPath: string; custom: boolean }> {
  const defaults = options.defaultLogRoots ?? options.logRoots ?? {};
  const effective = effectiveLogRoots(options);
  return agents.flatMap((agent) => {
    const path = effective[agent.id];
    const defaultPath = defaults[agent.id] ?? path;
    if (!path || !defaultPath) {
      return [];
    }
    return [{ id: agent.id, path, defaultPath, custom: options.db.logRootOverride(agent.id) !== null }];
  });
}

/** Folder changes come from the web app, which sends its origin. Other callers do not. */
function fromWebApp(req: IncomingMessage, webOrigin: string, port: number, strictWebOrigin: boolean): boolean {
  return typeof req.headers.origin === "string" && originAllowed(req, webOrigin, port, strictWebOrigin);
}

function originAllowed(req: IncomingMessage, webOrigin: string, port: number, strictWebOrigin: boolean): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  if (strictWebOrigin) {
    return origin === webOrigin;
  }
  const self = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    webOrigin,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5175",
    "http://localhost:5175",
  ]);
  return self.has(origin);
}

function corsHeaders(req: IncomingMessage, webOrigin: string, port: number, strictWebOrigin: boolean): Record<string, string> {
  const origin = req.headers.origin;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (origin && originAllowed(req, webOrigin, port, strictWebOrigin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const parsed: unknown = JSON.parse(text);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  req?: IncomingMessage,
  webOrigin?: string,
  strictWebOrigin = false,
): void {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req && webOrigin) {
    Object.assign(headers, corsHeaders(req, webOrigin, req.socket.localPort ?? 0, strictWebOrigin));
  }
  if (status === 204) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}
