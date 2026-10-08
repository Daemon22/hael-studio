# Hael Studio

Hael Studio is a **live construction environment** for making and evolving complete applications and media. The running experience becomes an inspectable, stateful workspace: people can understand it, simulate it, communicate with the systems shaping it, and refine it while keeping the architecture visible. It combines IDE surfaces, a semantic live canvas, runtime preview and effect timeline, agent collaboration, and natural-language communication through Mike.

Its defining loop is: **source change → HMR observation → runtime re-registration → state preservation → relationship propagation → visible canvas and inspector update**. The runtime layer models lifecycle and effects; it does not execute arbitrary project code or provide a deployment service.

## Run and operate

- `pnpm --filter @workspace/hael-studio run dev` — run the studio UI.
- `PORT=5001 pnpm --filter @workspace/api-server run dev` — build and run the API.
- `pnpm run typecheck` — check TypeScript across workspace packages.
- `pnpm test` — run the API and browser contract tests.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the API client and Zod contracts from the OpenAPI source.
- `pnpm --filter @workspace/db run push` — apply the Drizzle schema to a development database.

The API reads `PORT` and `DATABASE_URL`. In development without `DATABASE_URL`, it uses process-local memory so the prototype can run without a database. That mode is not durable and is rejected in production. Configure Postgres and apply the schema before running a production API.

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
- `tests` — API contract and browser smoke coverage.

## Architecture decisions

- The browser and API share the OpenAPI contract; request bodies and responses are validated with generated Zod schemas.
- Lifecycle simulation is a deterministic studio model. It stays separate from executing or deploying a user's application.
- The API persists the workspace snapshot, conversation messages, review requests, authored runtime events, and versioned live-construction state when Postgres is configured.
- Runtime-state writes use optimistic revision checks so parallel studio sessions cannot silently overwrite each other's state.
- Scenarios are authored fixtures; user-injected events are separate records so scenario definitions remain stable.
- Development memory mode is an explicit convenience only. Production requests fail without Postgres rather than silently losing state.

## Current backend boundary

The persistent data layer covers the current workspace API. Agent execution, repository operations, build/preview orchestration, identity and access control, deployment providers, and the server-side HMR/runtime relationship pipeline are not implemented by this API yet. The live-construction loop is therefore still incomplete. Prioritize workspace/surface corrections, then prove the HMR-to-runtime loop in a real browser, then automate relationship observation and provenance.
