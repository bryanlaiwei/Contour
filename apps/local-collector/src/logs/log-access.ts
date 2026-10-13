// Reports whether macOS let this process read each agent log folder.
// A missing folder means that agent is not installed. A blocked folder is a permission failure.

import { readdirSync } from "node:fs";
import { agents } from "../agents.js";
import type { LogRoots } from "../collection-pass.js";

export type LogAccessState = "ok" | "missing" | "blocked";

export type LogAccess = {
  id: string;
  path: string;
  state: LogAccessState;
};

export function readLogAccess(roots: LogRoots): LogAccess[] {
  return agents.flatMap((agent) => {
    const path = roots[agent.id];
    if (!path) {
      return [];
    }
    return [{ id: agent.id, path, state: accessState(path) }];
  });
}

function accessState(path: string): LogAccessState {
  try {
    readdirSync(path);
    return "ok";
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    switch (code) {
      case "ENOENT":
        return "missing";
      case "EACCES":
      case "EPERM":
        return "blocked";
      default:
        return "blocked";
    }
  }
}
