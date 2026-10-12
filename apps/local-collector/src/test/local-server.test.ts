import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CollectorLoop, applyLogRootOverrides } from "../collector-loop.js";
import { LocalDb } from "../local-db.js";
import { startLocalServer } from "../local-server.js";

const projectId = "33333333-3333-4333-8333-333333333333";
const trackingStartedAt = "2026-09-24T12:00:00.000Z";
const temps: string[] = [];

afterEach(() => {
  for (const root of temps.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "apm-loop-")));
  temps.push(root);
  return root;
}

describe("local helper api", () => {
  async function startHelper(root: string) {
    const db = new LocalDb(join(root, "collector.sqlite"));
    let scans = 0;
    const loop = new CollectorLoop({ db, logRoots: { codex: join(root, "codex") } });
    const server = await startLocalServer({
      db,
      port: 0,
      webOrigin: "http://127.0.0.1:5173",
      logRoots: { codex: join(root, "codex") },
      status: () => loop.status(),
      scanNow: async () => {
        scans += 1;
        return loop.tick();
      },
      pause: () => loop.pause(),
      resume: () => loop.resume(),
      fetchImpl: async () =>
        new Response(JSON.stringify({ token: "apm_device", deviceId: "device-web", projectId, trackingStartedAt }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const port = (server.address() as AddressInfo).port;
    return { db, server, loop, base: `http://127.0.0.1:${port}`, port, scans: () => scans };
  }

  it("pairs from the web app, then lets a person on this computer choose folders", async () => {
    const root = tempRoot();
    const helper = await startHelper(root);

    const preflight = await fetch(`${helper.base}/pair`, {
      method: "OPTIONS",
      headers: { Origin: "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST" },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    const pair = await fetch(`${helper.base}/pair`, {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "web-code", apiUrl: "http://127.0.0.1:4000" }),
    });
    expect(pair.status).toBe(201);
    expect(pair.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(helper.db.pairing(projectId)?.deviceId).toBe("device-web");

    const outside = await fetch(`${helper.base}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: root }),
    });
    expect(outside.status).toBe(401);

    const visit = await fetch(helper.base, { headers: { Origin: "http://127.0.0.1:5173" } });
    const overview = (await visit.json()) as { pairings: Array<{ projectId: string }>; logRoots: Array<{ path: string }> };
    expect(visit.headers.get("content-type")).toContain("application/json");
    expect(overview.pairings.map((entry) => entry.projectId)).toEqual([projectId]);
    expect(overview.logRoots.map((rootEntry) => rootEntry.path)).toContain(join(root, "codex"));

    const added = await fetch(`${helper.base}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:5173" },
      body: JSON.stringify({ path: root }),
    });
    expect(added.status).toBe(201);
    expect(helper.db.folders().map((folder) => folder.canonicalPath)).toEqual([root]);
    expect(helper.scans()).toBeGreaterThanOrEqual(2);

    const status = (await (await fetch(`${helper.base}/status`)).json()) as { status: { paired: boolean } };
    expect(status.status.paired).toBe(true);
    helper.server.close();
    helper.db.close();
  });

  it("replaces one agent session folder and can return to the default", async () => {
    const root = tempRoot();
    const custom = join(root, "custom-codex");
    mkdirSync(custom);
    const db = new LocalDb(join(root, "collector.sqlite"));
    const defaults = { codex: join(root, "default-codex") };
    const logRoots = { ...defaults };
    const server = await startLocalServer({
      db,
      port: 0,
      webOrigin: "http://127.0.0.1:5173",
      logRoots,
      defaultLogRoots: defaults,
      onLogRootsChanged: () => {
        const saved = db.logRootOverride("codex");
        applyLogRootOverrides(logRoots, defaults, saved ? { codex: saved } : {});
      },
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const headers = { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" };
    const updated = await fetch(`${base}/log-roots`, { method: "POST", headers, body: JSON.stringify({ id: "codex", path: custom }) });
    expect(updated.status).toBe(200);
    expect(logRoots.codex).toBe(custom);
    const listed = (await updated.json()) as { logRoots: Array<{ id: string; path: string; custom: boolean; defaultPath: string }> };
    expect(listed.logRoots.find((entry) => entry.id === "codex")).toMatchObject({ path: custom, custom: true, defaultPath: defaults.codex });
    const missing = await fetch(`${base}/log-roots`, { method: "POST", headers, body: JSON.stringify({ id: "codex", path: join(root, "missing") }) });
    expect(missing.status).toBe(400);
    const reset = await fetch(`${base}/log-roots/reset`, { method: "POST", headers, body: JSON.stringify({ id: "codex" }) });
    expect(reset.status).toBe(200);
    expect(logRoots.codex).toBe(defaults.codex);
    server.close();
    db.close();
  });

  it("refuses a request that names another host, so a rebound DNS name cannot reach it", async () => {
    const helper = await startHelper(tempRoot());
    const status = await new Promise<number>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port: helper.port, path: "/", headers: { Host: `attacker.example:${helper.port}` } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(403);
    helper.server.close();
    helper.db.close();
  });

  it("lets the menu bar pause collection and refuses the same call from a website", async () => {
    const helper = await startHelper(tempRoot());
    try {
      const paused = await fetch(`${helper.base}/control/pause`, { method: "POST" });
      expect(paused.status).toBe(200);
      expect(((await paused.json()) as { status: { collecting: boolean } }).status.collecting).toBe(false);
      const fromSite = await fetch(`${helper.base}/control/resume`, {
        method: "POST",
        headers: { Origin: "http://127.0.0.1:5173" },
      });
      expect(fromSite.status).toBe(403);
      const resumed = await fetch(`${helper.base}/control/resume`, { method: "POST" });
      expect(((await resumed.json()) as { status: { collecting: boolean } }).status.collecting).toBe(true);
    } finally {
      await helper.loop.whenIdle();
      helper.loop.stop();
      helper.server.close();
      helper.db.close();
    }
  });
});

function openDb(root: string): LocalDb {
  return new LocalDb(join(root, "collector.sqlite"));
}

describe("local helper", () => {
  it("pairs from the web app and rejects another origin", async () => {
    const root = tempRoot();
    const db = openDb(root);
    let paired = false;
    const server = await startLocalServer({
      db,
      port: 0,
      webOrigin: "http://127.0.0.1:5173",
      fetchImpl: async () => {
        paired = true;
        return new Response(
          JSON.stringify({
            token: "apm_test",
            deviceId: "device-1",
            projectId,
            trackingStartedAt,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("helper did not bind");
    }
    const base = `http://127.0.0.1:${address.port}`;
    const page = await fetch(base);
    const overview = (await page.json()) as { pairings: unknown[] };
    expect(overview.pairings).toEqual([]);
    const denied = await fetch(`${base}/pair`, {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "abc" }),
    });
    expect(denied.status).toBe(403);
    expect(paired).toBe(false);
    const accepted = await fetch(`${base}/pair`, {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "abc", apiUrl: "http://127.0.0.1:4000" }),
    });
    expect(accepted.status).toBe(201);

    const strictDb = openDb(tempRoot());
    const strict = await startLocalServer({
      db: strictDb,
      port: 0,
      webOrigin: "https://automatic-project-map-staging.vercel.app",
      strictWebOrigin: true,
      fetchImpl: async () => new Response("{}", { status: 500 }),
    });
    const strictPort = (strict.address() as AddressInfo).port;
    const localDev = await fetch(`http://127.0.0.1:${strictPort}/pair`, {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "nope" }),
    });
    expect(localDev.status).toBe(403);
    const staging = await fetch(`http://127.0.0.1:${strictPort}/`, {
      headers: { Origin: "https://automatic-project-map-staging.vercel.app" },
    });
    expect(staging.status).toBe(200);
    expect(staging.headers.get("access-control-allow-origin")).toBe("https://automatic-project-map-staging.vercel.app");
    strict.close();
    strictDb.close();
    expect(db.pairing(projectId)?.deviceToken).toBe("apm_test");
    server.close();
    db.close();
  });

  it("stays paired with every project, keeps each project's folders apart, and disconnects one at a time", async () => {
    const root = tempRoot();
    const db = openDb(root);
    const otherProject = "44444444-4444-4444-8444-444444444444";
    const calls: Array<{ url: string; method: string; auth: string | null }> = [];
    const codes: Record<string, { projectId: string; projectName: string; token: string; deviceId: string }> = {
      first: { projectId, projectName: "acme/first", token: "apm_first", deviceId: "device-first" },
      other: { projectId: otherProject, projectName: "acme/other", token: "apm_other", deviceId: "device-other" },
      again: { projectId, projectName: "acme/first", token: "apm_again", deviceId: "device-again" },
    };
    const server = await startLocalServer({
      db,
      port: 0,
      webOrigin: "http://127.0.0.1:5173",
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? "GET", auth: new Headers(init?.headers).get("authorization") });
        if (url.endsWith("/helper/token")) {
          return new Response(null, { status: 204 });
        }
        const code = codes[(JSON.parse(String(init?.body)) as { code: string }).code];
        return new Response(JSON.stringify({ ...code, trackingStartedAt }), { status: 201, headers: { "Content-Type": "application/json" } });
      },
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const web = { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" };
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: web, body: JSON.stringify(body) });

    expect((await post("/pair", { code: "first", apiUrl: "http://api.test" })).status).toBe(201);
    expect((await post("/pair", { code: "other", apiUrl: "http://api.test" })).status).toBe(201);
    expect(db.pairings().map((entry) => [entry.projectName, entry.deviceToken])).toEqual([
      ["acme/first", "apm_first"],
      ["acme/other", "apm_other"],
    ]);

    const outer = join(root, "work");
    const inner = join(outer, "inner");
    mkdirSync(inner, { recursive: true });
    expect((await post("/folders", { path: outer })).status).toBe(400);
    expect((await post("/folders", { path: outer, projectId: "55555555-5555-4555-8555-555555555555" })).status).toBe(409);
    expect((await post("/folders", { path: outer, projectId })).status).toBe(201);
    const clash = await post("/folders", { path: inner, projectId: otherProject });
    expect(clash.status).toBe(409);
    expect(((await clash.json()) as { error: string }).error).toContain("acme/first");

    expect((await post("/pair", { code: "again", apiUrl: "http://api.test" })).status).toBe(201);
    expect(db.pairing(projectId)?.deviceToken).toBe("apm_again");
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls).toContainEqual({ url: "http://api.test/helper/token", method: "DELETE", auth: "Bearer apm_first" });

    expect((await post(`/pairings/${projectId}/remove`, {})).status).toBe(204);
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls).toContainEqual({ url: "http://api.test/helper/token", method: "DELETE", auth: "Bearer apm_again" });
    expect(db.pairings().map((entry) => entry.projectId)).toEqual([otherProject]);
    expect(db.folders()).toEqual([]);
    expect((await post("/folders", { path: inner })).status).toBe(201);
    server.close();
    db.close();
  });
});
