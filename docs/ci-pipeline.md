# CI pipeline

Measured 2026-10-14. Wall-clock is push to the `check` job completing. Main has no deploy stage, so pull requests and main share this path.

## Before

20 successful runs of `ci.yml` on main. Median 1:33, p90 1:41. The path is the single `check` job (median 1:31, p90 1:38, queue about 2s).

| Job | Step | Median | p90 | Class |
|-----|------|--------|-----|-------|
| check | Initialize containers | 22s | 30s | setup |
| check | npm test | 19s | 20s | execution |
| check | npm run typecheck | 17s | 18s | toolchain |
| check | apt-get postgresql-client | 9s | 12s | setup |
| check | npm run build:server | 10s | 11s | toolchain |
| check | npm ci | 6s | 8s | setup |

Latest main run `38507544017`: Postgres was accepting connections at 03:41:37 and the container step ended at 03:41:51. The 10s health interval held the job after the database was ready. 32 test files. Vitest `collect` exceeds `tests` in the local collector; the api workspace is about even. `npm test` runs the workspaces one after another.

## Changes

- Dropped the Postgres service container. The image pull runs beside `npm ci`, and the database is polled every second during typecheck.
- Migrations use `psql` inside the container, so the job no longer installs `postgresql-client` before typecheck.

## After

| Path | Wall-clock | Run |
|------|------------|-----|
| Pull request: check | 0:44 | 38511568060 |

Job duration 42s, queue 2s. Runner minutes moved with the wall-clock: one job, about 1:31 before, 0:42 on this run.

Step starts, from job start, versus main run `38507544017`: typecheck at 0:13 instead of 0:47, build at 0:24 instead of 1:05, tests at 0:31 instead of 1:16. The install step was 9s while `npm ci` itself reported 4s, so the image pull overlapped the install. Typecheck and migrate was 11s and included the boot poll, so the boot did not outlast typecheck on this run.

Observed saving versus the main median: 49 seconds (1:33 to 0:44). Projected saving: 32 seconds. This runner was also fast on the work the change does not touch (typecheck 11s vs median 17s, build 7s vs 10s, tests 9s vs 19s). Putting those back at their medians leaves about 30 seconds, inside the projection. Verdict: confirmed.

An earlier run on the same branch, `38511382923`, finished the job in 65s. `docker run` waited for the pull, so that download still blocked the job for 7s. The follow-up overlaps the pull with `npm ci`.

## Trend

| Week | Test files | Median PR minutes | p90 | Minutes per 100 files |
|------|------------|-------------------|-----|------------------------|
| 2026-10-14 | 32 | 1:33 | 1:41 | 4:51 |

The after figure is one run, so it is not a new median. Re-measure when the `check` job's median exceeds 2 minutes.

## Not taken yet

- A second test job. `npm test` median is 19s. Another job would repeat checkout and install to split that.
- `isolate: false`. Collect time beats test time in the local collector, and the expected gain is a few seconds of a 19s step.
- Running workspace tests at once. They share one database, and that is not shown to be safe.
- A `node_modules` cache. `npm ci` median is already 6s with the setup-node download cache.
- Faster runners, or a native TypeScript checker. Both would spend money or a toolchain change to shorten a job that is now under a minute.
