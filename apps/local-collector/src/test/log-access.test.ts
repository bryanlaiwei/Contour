import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readLogAccess } from "../logs/log-access.js";

const temps: string[] = [];

afterEach(() => {
  for (const root of temps.splice(0)) {
    chmodSync(root, 0o700);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("log folder access", () => {
  it("tells a blocked folder apart from one that is not installed", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "apm-access-")));
    temps.push(root);
    const blocked = join(root, "blocked");
    mkdirSync(blocked);
    chmodSync(blocked, 0o000);
    const access = readLogAccess({ codex: blocked, claude_code: join(root, "missing") });
    expect(access).toEqual([
      { id: "codex", path: blocked, state: "blocked" },
      { id: "claude_code", path: join(root, "missing"), state: "missing" },
    ]);
    chmodSync(blocked, 0o700);
  });
});
