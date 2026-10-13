import type { Pool } from "pg";
import { SCHEMA_VERSION, normalizedEventSchema } from "@apm/shared";
import { describe, expect, it } from "vitest";
import { ingestEvents } from "./ingest-events.js";

const projectId = "33333333-3333-4333-8333-333333333333";
const trackingStartedAt = new Date("2026-09-24T12:00:00.000Z");

function session(kind: "session.started" | "session.content_added", eventId: string, createdAt: string) {
  const details =
    kind === "session.started"
      ? { kind, sessionId: "session", createdAt, sourceVersion: null }
      : {
          kind,
          sessionId: "session",
          createdAt,
          sourceVersion: null,
          recordIds: ["0"],
          messages: [{ id: "0", role: "user" as const, text: "hello", occurredAt: createdAt }],
        };
  return normalizedEventSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    eventId,
    sourceKey: eventId,
    projectId,
    source: "codex",
    occurredAt: createdAt,
    details,
  });
}

function recordingPool(): Pool {
  const client = {
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("from normalized_events")) {
        const ids = Array.isArray(params?.[0]) ? params[0].filter((id): id is string => typeof id === "string") : [];
        return { rows: ids.map((event_id) => ({ event_id, project_id: projectId })) };
      }
      return { rows: [] };
    },
    release() {
      return undefined;
    },
  };
  return {
    async query(sql: string) {
      if (sql.includes("from projects")) {
        return { rows: [{ tracking_started_at: trackingStartedAt }] };
      }
      return { rows: [] };
    },
    async connect() {
      return client;
    },
  } as unknown as Pool;
}

describe("session ingest", () => {
  it("keeps a session that started after tracking, and refuses one that started before", async () => {
    const recent = "2026-09-24T13:00:00.000Z";
    const early = "2026-09-24T11:00:00.000Z";
    const result = await ingestEvents(recordingPool(), {
      projectId,
      events: [
        session("session.started", "codex:recent:started", recent),
        session("session.content_added", "codex:recent:content", recent),
        session("session.started", "codex:early:started", early),
        session("session.content_added", "codex:early:content", early),
      ],
    });

    expect(result.acknowledged).toEqual(["codex:recent:started", "codex:recent:content"]);
    expect(result.rejected).toEqual([
      { eventId: "codex:early:started", reason: "created_before_tracking" },
      { eventId: "codex:early:content", reason: "created_before_tracking" },
    ]);
  });

  it("refuses a session that started at the tracking instant", async () => {
    const result = await ingestEvents(recordingPool(), {
      projectId,
      events: [session("session.started", "codex:cutoff:started", trackingStartedAt.toISOString())],
    });

    expect(result.acknowledged).toEqual([]);
    expect(result.rejected).toEqual([{ eventId: "codex:cutoff:started", reason: "created_before_tracking" }]);
  });
});
