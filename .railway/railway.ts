import { defineRailway, github, project, service } from "railway/iac";

// Railway does not read this file during deploys. `railway config apply` stores these settings on each service.
// Both services run the same build; scripts/start-hosted.mjs picks the API or the worker from the service name.
export default defineRailway((ctx) => {
  const hosted = {
    build: {
      buildCommand: "npm run build:server",
      // Both services compile the same server workspaces. Site, helper, and docs changes do not match.
      watchPatterns: [
        "/package.json",
        "/package-lock.json",
        "/scripts/**",
        "/apps/api/**",
        "/apps/worker/**",
        "/apps/github-collector/**",
        "/packages/core/**",
        "/packages/shared/**",
        "!/packages/shared/src/mac-helper.ts",
        "!/packages/shared/src/test/mac-helper.test.ts",
      ],
    },
    start: "npm run start:hosted",
    source: github("bryanlaiwei/Contour", { branch: "main" }),
  };
  const api = service("api", { ...hosted, replicas: { iad: 1 } });
  const worker = service("worker", {
    ...hosted,
    replicas: { iad: 2 },
    deploy: { numReplicas: 2 },
  });

  return project(ctx.projectName, {
    variables: { managed: false },
    resources: [api, worker],
  });
});
