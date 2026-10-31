# Hael Studio

Hael Studio is a **live construction environment** for making and evolving complete applications and media. The running experience becomes an inspectable, stateful workspace: people can understand it, simulate it, communicate with the systems shaping it, and refine it while keeping the architecture visible. It combines IDE surfaces, a semantic live canvas, runtime preview and effect timeline, agent collaboration, and natural-language communication through Mike.

The companion architecture with Orren (semantic engine + Visual Hub), including state ownership, service boundary, event contract, security, and delivery gates, is defined in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). It distinguishes the current development bridge from the production integration still to build.

Its defining loop is: **source change → HMR observation → runtime re-registration → state preservation → relationship propagation → visible canvas and inspector update**. The runtime layer models lifecycle and effects; it does not execute arbitrary project code or provide a deployment service.

## Run and operate

- `pnpm --filter @workspace/hael-studio run dev` — run the studio UI.
- `PORT=5001 pnpm --filter @workspace/api-server run dev` — build and run the API.
- `pnpm run typecheck` — check TypeScript across workspace packages.
- `pnpm test` — run the API and browser contract tests.
- `pnpm test:backend` — run in-memory API coverage and optional Postgres integration coverage.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the API client and Zod contracts from the OpenAPI source.
- `pnpm --filter @workspace/db run migrate` — apply pending numbered SQL migrations.
- `python visual-hub/server.py` from the [Orren repository](https://github.com/Daemon22/Orren) — start its local Engine + Visual Hub service for the Studio semantic surface.

The API reads `PORT`, `NODE_ENV`, `DATABASE_URL`, and optionally `DATABASE_POOL_MAX`. Copy `.env.example` and replace its placeholder credentials for local PostgreSQL. `DATABASE_URL` must be a PostgreSQL URL, for example `postgresql://hael:change-me@localhost:5432/hael_studio`. For managed databases that require TLS, use the provider's TLS-enabled connection URL. `DATABASE_POOL_MAX` defaults to `10` and must be a positive integer.

The API also reads `ORREN_SERVICE_URL` (default `http://127.0.0.1:4173`) and optional `ORREN_SERVICE_TOKEN`. Local Orren uses loopback HTTP. Non-loopback Orren services must use HTTPS. Studio exposes this bridge only outside production until project authorization is implemented.

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
- **Orren semantic field:** open the live SIR tree, inspect all nine dimensions and provenance, edit nodes and typed relationships, and review realization plans from the configured Orren Visual Hub service.
- **Live construction:** observe source/HMR changes, preserve runtime state, and show affected relationships in the canvas and inspector.
- **Conversation loom and Mike:** communicate with agents and the running system with explicit review boundaries.

## Where things live

- `artifacts/hael-studio` — React studio, shell, canvas, lifecycle, state engine, and runtime inspector.
- `artifacts/hael-studio/src/pages/OrrenHub.tsx` — Studio's semantic surface over the live Orren Visual Hub field.
- `artifacts/api-server` — Express API, workspace persistence, and server-side Orren adapter.
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

The API now stores projects and project memberships, creates/lists projects, grants and revokes roles, and scopes workspace/runtime persistence by an authorized project selected through a route or project-context header. Owners are protected from removal until ownership transfer exists. Successful workspace, runtime, project, membership, Orren command, build, and runtime-observation mutations are recorded in project-scoped audit history; owners and admins can read recent history. Production API requests require a signed RS256 identity token validated against configured OIDC issuer, audience, and JWKS; project reads require membership and writes require editor access or above. The seeded production project owner is configured with `STUDIO_BOOTSTRAP_SUBJECT`. The Studio shell lists accessible projects, lets the user create and switch projects, and sends the selection with API requests. Browser sign-in uses the OIDC authorization-code flow with PKCE, signed state, and nonce validation, then creates a revocable server-side session. Sessions renew on activity after 15 minutes, expire after 12 hours idle, and have a 7-day absolute limit. Ownership transfer remains open. Orren's Visual Hub still keeps edits in one process-wide in-memory session, so the Studio Orren bridge stays disabled in production and rejects non-default project context. Studio now persists idempotent build jobs and build-bound runtime observations and delegates builds to an external runner configured with `HAEL_BUILD_RUNNER_URL`, `HAEL_BUILD_RUNNER_TOKEN`, and `HAEL_PREVIEW_ORIGIN`; the Build & Preview page supports pinned inputs, status, retry, cancellation, output manifests, and returned previews. Production isolation depends on deploying and verifying the private runner. Repository grants/snapshots, durable semantic sessions, automatic source/semantic pin resolution, runner recovery and policy evidence, browser-to-server runtime provenance wiring, and audit integrity/retention remain open. The integrated live-construction loop is not complete. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the target boundary and remaining gates.

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

### Architecture status — 2026-10-18

The Studio + Orren ownership boundary and target integration contract are now documented in `docs/ARCHITECTURE.md`. This is an architecture decision record, not implementation evidence. The verification items above remain as recorded; the cross-product integration gates in the architecture document are still open.

### Orren bridge implementation — 2026-10-18

The Studio UI now has a semantic field route backed by `/api/orren/*`, which proxies the Orren Visual Hub `/api/health`, `/api/field`, and `/api/action` endpoints. The UI exposes tree selection, behavior creation, reparenting, typed relationships, dimension inspection, target planning, and session provenance. Orren's returned metadata is labeled as in-memory/session-only and plan-only where applicable. A local Orren service must be running at `ORREN_SERVICE_URL` (default `http://127.0.0.1:4173`). The bridge is disabled in production until project authorization is implemented.

Repository connection and contribution APIs are outside the current workspace persistence boundary. They require repository identity, authorization, and ownership rules before remote projects can write to the database; no remote-repository access is granted by `DATABASE_URL` alone.
