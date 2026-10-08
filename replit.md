# Hael Studio

Hael Studio is a **live construction environment** for making and evolving complete applications and media. The running experience becomes an inspectable, stateful workspace: people can understand it, simulate it, communicate with the systems shaping it, and refine it while keeping the architecture visible. It combines IDE surfaces, a semantic live canvas, runtime preview and effect timeline, agent collaboration, and natural-language communication through Mike.

Its defining loop is: **source change → HMR observation → runtime re-registration → state preservation → relationship propagation → visible canvas and inspector update**. The runtime layer models lifecycle and effects; it does not execute arbitrary project code or provide a deployment service.

## Run and operate

- `pnpm --filter @workspace/hael-studio run dev` — run the studio UI.
- `PORT=5001 pnpm --filter @workspace/api-server run dev` — build and run the API.
- `pnpm run typecheck` — check TypeScript across workspace packages.
- `pnpm test` — run the API and browser contract tests.
- `pnpm test:backend` — run in-memory API coverage and optional Postgres integration coverage.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the API client and Zod contracts from the OpenAPI source.
- `pnpm --filter @workspace/db run migrate` — apply pending numbered SQL migrations.

The API reads `PORT`, `NODE_ENV`, `DATABASE_URL`, and optionally `DATABASE_POOL_MAX`. Copy `.env.example` and replace its placeholder credentials for local PostgreSQL. `DATABASE_URL` must be a PostgreSQL URL, for example `postgresql://hael:change-me@localhost:5432/hael_studio`. For managed databases that require TLS, use the provider's TLS-enabled connection URL. `DATABASE_POOL_MAX` defaults to `10` and must be a positive integer.

In development without `DATABASE_URL`, the API uses process-local memory and does not need a database. That mode is not durable. Production requires a valid `DATABASE_URL`, verifies connectivity and that migrations are applied before listening, and reports a clear startup error otherwise. The Postgres pool defaults to 10 connections and closes after the HTTP server drains on `SIGINT` or `SIGTERM`. Apply migrations before deploying or starting production:

```sh
pnpm --filter @workspace/db run migrate
```

Migrations live in `lib/db/migrations` and use the ordered `NNNN_description.sql` naming convention. The runner tracks applied file names in `hael_schema_migrations`, runs each migration transactionally, and takes a Postgres advisory lock so concurrent deploys cannot apply the same migration twice. Add a new numbered SQL file for each schema change; do not use schema push in production.

Postgres integration tests are opt-in and intentionally use a separate `HAEL_TEST_DATABASE_URL` so a developer's ordinary `DATABASE_URL` cannot be mutated accidentally. Point it at a disposable, dedicated database; `pnpm test` applies migrations there and exercises persistence and runtime conflicts. Without it, those tests skip cleanly. CI should provide its own dedicated test database URL.

## Product surface

- **Compose:** express an intention and shape the application or media experience through the semantic canvas.
- **Simulate:** drive lifecycle and effects, replay scenarios, and inspect runtime signals.
- **Inspect:** relate runtime identities to implementation, compare snapshots, and trace changes.
- **Live construction:** observe source/HMR changes, preserve runtime state, and show affected relationships in the canvas and inspector.
- **Conversation loom and Mike:** communicate with agents and the running system with explicit review boundaries.

## Where things live

- `artifacts/hael-studio` — React studio, shell, canvas, lifecycle, state engine, and runtime inspector.
- `artifacts/api-server` — Express API and workspace persistence boundary.
- `lib/api-spec/openapi.yaml` — source of truth for HTTP operations and payloads.
- `lib/api-zod` and `lib/api-client-react` — generated validation contracts and React Query client.
- `lib/db/src/schema` — Drizzle/Postgres schema.
- `lib/db/migrations` — ordered, repeatable Postgres migrations.
- `tests` — API contract and browser smoke coverage.

## Architecture decisions

- The browser and API share the OpenAPI contract; request bodies and responses are validated with generated Zod schemas.
- Lifecycle simulation is a deterministic studio model. It stays separate from executing or deploying a user's application.
- The API persists the workspace snapshot, conversation messages, review requests, authored runtime events, and versioned live-construction state when Postgres is configured.
- Runtime-state writes use optimistic revision checks so parallel studio sessions cannot silently overwrite each other's state.
- The `(workspace_id, created_at)` indexes on messages and authored runtime events support the API's workspace-filtered chronological reads. Reviews are write-only today and have no speculative secondary index.
- Scenarios are authored fixtures; user-injected events are separate records so scenario definitions remain stable.
- Development memory mode is an explicit convenience only. Production requests fail without Postgres rather than silently losing state.
- Runtime-state conflicts return the latest persisted state and revision when available, so clients can merge and retry without overwriting another session.
- The 409 response contract now includes that latest record; the server has a matching Zod response validator because the generated route validators only cover successful response bodies. This addresses a mismatch that previously left clients with only an error string.

## Current backend boundary

The persistent data layer covers the current workspace API. Agent execution, repository operations, build/preview orchestration, identity and access control, deployment providers, and the server-side HMR/runtime relationship pipeline are not implemented by this API yet. The live-construction loop is therefore still incomplete. Prioritize workspace/surface corrections, then prove the HMR-to-runtime loop in a real browser, then automate relationship observation and provenance.

## Backend completion gate

Do not begin UI polish until every item below has been verified:

1. The numbered migrations apply cleanly to a fresh Postgres database using the documented command.
2. Production starts with `DATABASE_URL`; missing, invalid, unreachable, and unmigrated database configurations fail clearly, and shutdown closes the pool.
3. The in-memory suite passes, and Postgres persistence tests pass when `HAEL_TEST_DATABASE_URL` points to a dedicated CI/test database.
4. Runtime-state conflict tests prove stale writes return 409 with merge data and accepted writes increment revisions.
5. The React Query client and Zod contracts regenerate from `lib/api-spec/openapi.yaml` and compile.
6. These notes match the verified implementation and test results.

### Verification status — 2026-10-08

1. **Pending:** the migration has not been applied to a fresh, dedicated Postgres database in this environment.
2. **Partial:** missing and unreachable production database failures are covered by tests; a live production database run is pending a dedicated Postgres URL.
3. **Partial:** `pnpm test` passes all 14 in-memory API tests. Postgres integration skips until `HAEL_TEST_DATABASE_URL` is configured, and the browser smoke test skips because Chromium is not installed in this environment.
4. **Passed:** stale writes return 409 with the latest state and revision, and accepted writes increment the revision.
5. **Passed:** React Query and Zod generation completed from the current OpenAPI document, and library typechecking passed. Full workspace typechecking is blocked by a pre-existing syntax error in `artifacts/hael-studio/src/pages/Home.tsx`; this task did not change frontend code.
6. **Passed:** these notes describe the migration runner, environment, test paths, and remaining gate work.

Repository connection and contribution APIs are outside the current workspace persistence boundary. They require repository identity, authorization, and ownership rules before remote projects can write to the database; no remote-repository access is granted by `DATABASE_URL` alone.
