// Staging menu-bar entry. It forces the staging site, then runs the same helper as npm run dev:helper.
// Collection, upload, and pairing stay in the local collector.

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../local-collector/src/cli.js";
import { stagingWebOrigin } from "../../../packages/shared/src/staging-helper.js";

const support = join(homedir(), "Library", "Application Support", "Contour");
mkdirSync(support, { recursive: true });
process.env.WEB_ORIGIN = stagingWebOrigin;
process.env.APM_HELPER_STRICT_ORIGIN = "1";
process.env.APM_HELPER_DB = join(support, "collector.sqlite");

// The menu bar app owns this process. When it quits, its pipe closes and collection stops.
process.stdin.resume();
process.stdin.on("end", () => {
  process.exit(0);
});

void runCli(process.argv.slice(2), process.env, {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
}).then(
  (result) => {
    if (process.argv[2] === "serve" && result.exitCode === 0) {
      return;
    }
    process.exit(result.exitCode);
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : "Collector failed.";
    console.error(message);
    process.exit(1);
  },
);
