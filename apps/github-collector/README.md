# GitHub collector

This package checks repository access, turns a GitHub webhook into one normalized event, fills in the current pull request or workflow snapshot, and decides when a stored observation is stale. The API and the worker call these functions and store the events. Nothing in this folder runs on its own.

## Structure

```mermaid
flowchart TD
  connect["API asks about a repository"] --> access["access.ts checks the GitHub App can see it and the person can write"]

  hook["API passes a webhook body"] --> signature["webhook.ts checks the signature"]
  signature --> kind{"Event type"}
  kind -->|handled delivery| event["Build one normalized event"]
  kind -->|ping or installation| ignore["Ignore"]

  event --> enrich["enrich.ts asks GitHub for the pull request or workflow snapshot"]
  enrich --> caller["Return the event. The API or worker stores it"]

  timer["Worker, every 5 minutes"] --> refresh["refresh.ts re-reads open pull requests and unfinished workflow runs"]
  refresh --> newer{"GitHub has a newer updatedAt?"}
  newer -->|yes| event
  newer -->|no| keep["Write nothing"]
```

## Files

- `package.json` declares the `@apm/github-collector` package and exports `access`, `github-client`, `webhook`, `enrich`, and `refresh`.
- `tsconfig.json` points the TypeScript compiler at `src` and emits into `dist`.
- `src/github-client.ts` signs the GitHub App JWT, requests an installation token, and calls the GitHub API with a timeout.
- `src/access.ts` checks that the repository id matches and the signed-in person has write access.
- `src/webhook.ts` checks the webhook signature and turns a pull request, review, workflow run, or workflow job into one normalized event.
- `src/enrich.ts` calls GitHub for the pull request’s commits and files, or a workflow run’s jobs, and attaches that snapshot to the event.
- `src/refresh.ts` re-reads up to 50 open pull requests from the last 30 days and 50 unfinished workflow runs from the last 24 hours. It returns a new event only when GitHub’s `updatedAt` is newer. The worker stores that event.
- `src/test/` checks access, webhook normalization, and enrichment.
