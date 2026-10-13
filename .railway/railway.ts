import { defineRailway, project, service } from "railway/iac";

// Railway does not read this file during deploys. `railway config apply` stores these settings on each service.
// Both services run the same build; scripts/start-hosted.mjs picks the API or the worker from the service name.
export default defineRailway((ctx) => {
  const hosted = {
    build: "npm run build:server",
    start: "npm run start:hosted",
    replicas: { iad: 1 },
  };
  const api = service("api", hosted);
  const worker = service("worker", hosted);

  return project(ctx.projectName, {
    variables: { managed: false },
    resources: [api, worker],
  });
});
