# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Contour builds a live feature map of a project from GitHub activity (PRs, reviews, workflow runs) and local coding-agent sessions (Codex, Claude Code, Cursor). It is an npm workspaces monorepo (Node 22+, TypeScript, ESM). Packages are named `@apm/*`.

## Commands

```bash
npm install
npx supabase start          # local Postgres + Auth in Docker; also applies supabase/migrations
npm run typecheck           # all workspaces
npm test                    # all workspaces (vitest); needs DATABASE_URL and migrated DB
npm run build:server        # builds shared → github-collector → core → api → worker, in that order
npm run dev:api             # Express on :4000 (tsx watch)
npm run dev:worker          # pg-boss worker (tsx watch)
npm run dev:web             # Vite on :5173
npm run dev:helper          # local helper on :47321
npm run lint -w @apm/web    # ESLint only exists in apps/web
```

Run one test file or test by name from inside a workspace:

```bash
npm test -w @apm/api -- src/test/cors.test.ts
npm test -w @apm/core -- src/graph/evidence.test.ts -t "long pull request"
```

Other scripts: `npm run demo:seed -w @apm/api -- <github-username>` seeds a `demo/shop-app` project for a signed-in user; `npm run eval -w @apm/api` runs the grouping eval (`packages/core/src/graph/eval-grouping.ts`); `npm run build:mac -w @apm/local-collector` packages the Mac menu-bar helper.

Copy `.env.example` to `.env` and fill it from `supabase status`. The API exits on startup if `GITHUB_WEBHOOK_SECRET` is empty. Tests talk to a real Postgres (GitHub calls are mocked) and isolate by creating their own uniquely named projects/owners rather than resetting the database.

## Architecture

```
agents' logs → local-collector ─┐
GitHub webhook ─────────────────┼→ api → Postgres ⇄ worker
                                └  web ← api (reads the map)
```

- **`apps/api`**: Express. Verifies Supabase JWTs locally (HS256 secret or the project's JWKS; no Auth call per request), checks project membership, accepts helper uploads and GitHub webhooks, serves map/settings routes. For a webhook it only verifies the signature, inserts a `webhook_deliveries` row, replies 202, and queues a pg-boss job; it does no map processing.
- **`apps/worker`**: no HTTP. Processes queued deliveries into `normalized_events`, sweeps stale deliveries every minute, refreshes open PRs / unfinished workflow runs from GitHub every 5 min, and every 5 s queues `processProject` for projects with pending events or ready evidence (max 3 concurrently).
- **`apps/github-collector`**: a library, not a process. Webhook signature check + normalization, enrichment (PR commits/files, workflow jobs), access checks via the GitHub App, and the refresh logic.
- **`apps/local-collector`**: the helper on each member's Mac. Scans agent log dirs every ~30 s, keeps per-session byte checkpoints and an upload outbox in SQLite (`better-sqlite3`), and uploads `session.*` events. Per-agent parsing lives in `src/adapters/` behind the contract in `src/contract/`. `src/mac/` is the Swift menu-bar wrapper.
- **`apps/web`**: React + Vite + Tailwind, React Flow + ELK for the map. Polls `/graph/revision` every 15 s and refetches the graph only when the revision changes. `VITE_*` values are baked in at build time. `src/release.ts` holds release feature flags.
- **`packages/core`**: all database access and map processing, shared by the API and worker. `config.ts` is the only place server code reads `process.env`.
- **`packages/shared`**: zod schemas for the event contract (`schema/events.ts`) and API responses (`schema/api.ts`), plus logic shared with the helper and web.

### Map pipeline (`packages/core/src/graph/`)

`processProject` (in `process.ts`) runs two stages per project:

1. **Facts** (`facts.ts`): deterministic. Turns pending `normalized_events` into PR/review/workflow-run artifacts and `evidence` rows (session excerpts, PR text), in a short transaction that locks the project row (`lockProject`). Facts never wait on the model.
2. **Interpretation**: if an interpreter is configured, evidence that has been quiet for 20 s (or waited 60 s) is rendered into a prompt (`context.ts`, `graph-prompt.ts`). The model returns a `Proposal` (`proposal.ts`): a list of operations that reference evidence/work items/features by alias (`E1`, `W1`, `F1`, `new:<name>`). `apply.ts` validates and applies it. Interpretation is serialized per project with a lease on `projects.locked_until` (not a DB transaction), so no connection is held during the model call.

Every graph mutation goes through a `ChangeSet` → `commitChanges` (`graph-store.ts`), which bumps `projects.graph_revision` and writes `graph_changes` history. User edits from the UI go through `corrections.ts` the same way.

Work-item state is computed in `state.ts`: PR facts always win (open non-draft → in_review, draft → in_progress, merged only when its PRs are merged). Session evidence or the model can only infer `planned` / `in_progress`; an agent claiming "done" never makes something merged.

`model-interpreter.ts` supports OpenAI, Anthropic and Gemini behind one `Interpreter` interface, but this release only uses the server `OPENAI_API_KEY` (default model `gpt-5-nano`). Without that key, evidence stays unread and only facts appear.

## Conventions that bite

- **Package exports use a `node-dist` condition.** Every `exports` entry in `packages/core`, `packages/shared`, and `apps/github-collector` maps `types`/`default` to `src/*.ts` (so dev, tests and typecheck run TypeScript directly) and `node-dist` to `dist/*.js` (production runs with `node --conditions=node-dist`). A new module imported across packages needs an `exports` entry with all three keys, or it will work in dev but fail in production.
- **Imports use `.js` extensions** (NodeNext resolution). `tsconfig.base.json` enables `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, so optional fields are often spread conditionally (`...(model ? { model } : {})`).
- **Migrations** go in `supabase/migrations/<timestamp>_<name>.sql`. CI applies them in order with `psql` to a plain `postgres:16` container, not Supabase, so they must not depend on Supabase-only schemas.
- **Deploys**: the web app goes to Vercel (`vercel.json`; it only rebuilds when `apps/web`, `packages/shared`, or lockfiles change). The API and worker go to Railway as two services running the same `build:server` output; `scripts/start-hosted.mjs` chooses which one to start from `RAILWAY_SERVICE_NAME`. `.railway/railway.ts` is applied by hand with `railway config apply`, not at deploy time.
- Each app folder has a README with a flow diagram and a per-file list. Update it when you add, remove, or change the role of files.
- Commit messages are a single plain-English sentence ending with a period (e.g. "Stop a helper token from staying valid after its owner is removed.").
