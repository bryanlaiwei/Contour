import type { Pool, PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "@apm/core/config";
import { getPool } from "@apm/core/db";
import { createPairingCode, exchangePairingCode, findHelperDevice } from "@apm/core/helper-tokens";
import { connectRepository } from "@apm/core/store";
import { removeMember } from "@apm/core/workspace";

loadEnvFile();

const pool = getPool();
const ownerId = "a7000000-0000-4000-8000-000000000001";
const memberId = "a7000000-0000-4000-8000-000000000002";

describe("helper token and membership removal", () => {
  afterAll(async () => {
    await pool.query("delete from workspaces where name = any($1::text[])", [["race/helper-token", "race/helper-auth"]]);
  });

  it("does not leave a usable helper token when removal overlaps pairing", async () => {
    await pool.query(
      `delete from workspaces where id in (select workspace_id from projects where github_repo_id = $1)`,
      [88_000_981],
    );
    const connected = await connectRepository(pool, { userId: ownerId, owner: "race", name: "helper-token", repoId: 88_000_981 });
    if ("error" in connected) {
      throw new Error(connected.error);
    }
    const project = connected.project;
    await pool.query(`insert into memberships (workspace_id, user_id, role) values ($1, $2, 'member')`, [
      project.workspace_id,
      memberId,
    ]);
    const pairing = await createPairingCode(pool, { projectId: project.id, userId: memberId });

    let releasePause = () => {};
    const release = new Promise<void>((resolve) => {
      releasePause = resolve;
    });
    let markPaused = () => {};
    const paused = new Promise<void>((resolve) => {
      markPaused = resolve;
    });
    const exchangePromise = exchangePairingCode(pauseAfterFirstLock(pool, release, markPaused), { code: pairing.code });
    let removalPromise: ReturnType<typeof removeMember> | undefined;
    try {
      await paused;
      removalPromise = removeMember(pool, { projectId: project.id, userId: memberId });
      await waitForLockWait(pool);
      releasePause();
      const exchanged = await exchangePromise;
      const removed = await removalPromise;
      expect(removed.status).toBe("removed");
      expect("token" in exchanged).toBe(true);
      if (!("token" in exchanged)) {
        return;
      }
      expect(await findHelperDevice(pool, exchanged.token)).toBeNull();
      const stored = await pool.query<{ revoked_at: Date | null }>("select revoked_at from collector_tokens where id = $1", [
        exchanged.device.id,
      ]);
      expect(stored.rows[0]?.revoked_at).not.toBeNull();
    } finally {
      releasePause();
      await exchangePromise.catch(() => undefined);
      await removalPromise?.catch(() => undefined);
      await pool.query("delete from workspaces where name = $1", ["race/helper-token"]);
    }
  }, 20_000);

  it("rejects a helper token whose owner is no longer a member", async () => {
    await pool.query(
      `delete from workspaces where id in (select workspace_id from projects where github_repo_id = $1)`,
      [88_000_982],
    );
    const connected = await connectRepository(pool, { userId: ownerId, owner: "race", name: "helper-auth", repoId: 88_000_982 });
    if ("error" in connected) {
      throw new Error(connected.error);
    }
    const project = connected.project;
    try {
      await pool.query(`insert into memberships (workspace_id, user_id, role) values ($1, $2, 'member')`, [
        project.workspace_id,
        memberId,
      ]);
      const pairing = await createPairingCode(pool, { projectId: project.id, userId: memberId });
      const exchanged = await exchangePairingCode(pool, { code: pairing.code });
      if (!("token" in exchanged)) {
        throw new Error("pairing code was not exchanged");
      }
      expect(await findHelperDevice(pool, exchanged.token)).toEqual(expect.objectContaining({ id: exchanged.device.id }));

      await pool.query(`delete from memberships where workspace_id = $1 and user_id = $2`, [project.workspace_id, memberId]);
      const stillActive = await pool.query<{ revoked_at: Date | null }>("select revoked_at from collector_tokens where id = $1", [
        exchanged.device.id,
      ]);
      expect(stillActive.rows[0]?.revoked_at).toBeNull();
      expect(await findHelperDevice(pool, exchanged.token)).toBeNull();
    } finally {
      await pool.query("delete from workspaces where name = $1", ["race/helper-auth"]);
    }
  });
});

/** Keeps the exchange transaction open after its first row lock, before the token insert. */
function pauseAfterFirstLock(pool: Pool, release: Promise<void>, onPause: () => void): Pool {
  return {
    async connect() {
      const client = await pool.connect();
      let paused = false;
      return {
        async query(sql: string, params?: unknown[]) {
          const result = await client.query(sql, params);
          if (!paused && sql.toLowerCase().includes("for update")) {
            paused = true;
            onPause();
            await release;
          }
          return result;
        },
        release() {
          client.release();
        },
      } as PoolClient;
    },
  } as Pool;
}

async function waitForLockWait(pool: Pool): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const waiting = await pool.query<{ query: string }>(
      `select query from pg_stat_activity
       where pid <> pg_backend_pid() and wait_event_type = 'Lock' and state = 'active'`,
    );
    if (waiting.rows.some((row) => /memberships|collector_pairing_codes|collector_tokens/i.test(row.query))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("member removal did not wait on the pairing exchange");
}
