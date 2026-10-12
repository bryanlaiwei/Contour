import { spawn } from "node:child_process";

const workspaces = {
  api: "@apm/api",
  worker: "@apm/worker",
};

const service = process.env.RAILWAY_SERVICE_NAME ?? "";
const workspace = workspaces[service];
if (!workspace) {
  console.error(`RAILWAY_SERVICE_NAME must be api or worker. Received "${service}".`);
  process.exit(1);
}

const child = spawn("npm", ["start", "--workspace", workspace], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
