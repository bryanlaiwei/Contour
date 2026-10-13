# API

This program accepts sign-in, repository connections, local session uploads, and GitHub webhooks. The browser reads the map from here. Map processing, storage, and other shared logic live in `packages/core`, which this server and the worker both use.

## Structure

```mermaid
flowchart TD
  signin["Browser sends a Supabase sign-in token"] --> member{"Person belongs to the project?"}
  member -->|no| reject["401 or 404"]
  member -->|yes| graph["routes/graph.ts reads the map or saves a correction"]
  member -->|yes| workspace["routes/workspace.ts reads settings, members, invitations, and layout"]

  connect["Connect a repository"] --> access["GitHub App confirms the repo and write access"]
  access --> project["Store the project"]

  pair["Pair the local helper"] --> token["Exchange a pairing code for a device token"]
  upload["Helper uploads session events"] --> ingest["Check the token and store normalized events"]

  hook["GitHub webhook"] --> sig["Check the signature"]
  sig --> row["Insert a webhook row as queued"]
  row --> ack["Reply 202"]
  ack --> job["Queue one pg-boss job for the worker"]
```

Map processing stays in `packages/core`. The worker runs it. This server only stores the webhook and queues that job.

## Files

- `package.json` declares the `@apm/api` package and its HTTP server.
- `tsconfig.json` points the TypeScript compiler at `src` and emits into `dist`.
- `src/index.ts` checks configuration and listens on this machine at port 4000.
- `src/app.ts` is the HTTP server. It connects a repository, pairs a helper, accepts session uploads, receives webhooks, and mounts the map and settings routes.
- `src/auth.ts` checks a Supabase access token locally with the project's JWT secret and returns the signed-in user.
- `src/cors.ts` allows the configured site origin, and local development origins, to call the API.
- `src/require-access.ts` checks project membership before a route runs.
- `src/routes/workspace.ts` serves the person, model setup, members, invitations, devices, project deletion, and layout.
- `src/routes/graph.ts` serves the map, a work item, a feature, and a correction.
- `src/test/` covers sign-in, webhooks, uploads, membership, layout, model credentials, and the map pipeline.

The files that used to live beside these routes — the database pool, stored events, the webhook job queue, membership, model keys, and map processing — are in `packages/core`.
