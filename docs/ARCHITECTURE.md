# HAEL Studio + Orren Architecture

**Status:** Target architecture, 18 October 2026  
**Scope:** The HAEL Studio workspace and the Orren semantic engine / Visual Hub. This document defines their system boundary, current implementation, and remaining delivery gates.

## Product boundary

HAEL Studio is the project workspace: it holds project membership, source-control context, conversations, review decisions, build and preview sessions, and the live construction shell. Its canvas explains how the project is assembled and what its runtime is doing.

Orren is the semantic authoring system: it interprets `.orn` intent, builds and resolves the Semantic Intermediate Representation (SIR), coordinates realization targets, emits artifacts, and records semantic provenance. Orren's Visual Hub is the semantic map for seeing and shaping that SIR. It is not a second project manager or deployment service.

The products share a project identity and a selected semantic session, but do not share mutable ownership of the same state:

| Concern | Authority | Studio's use |
|---|---|---|
| User, organization, membership, project access | Studio identity/access boundary | Authorizes all project operations |
| Repository, branch, commit, source edits | Studio repository adapter, scoped to user grant | Supplies a pinned source snapshot to Orren/build jobs |
| `.orn` source, SIR, resolutions, semantic history | Orren Engine and its project store | Reads a versioned semantic snapshot; submits explicit semantic commands |
| Realization plans and generated artifacts | Orren Engine | Displays artifacts and provenance; never treats generated files as source intent |
| Build and preview processes | Studio isolated execution service | Starts, observes, stops, and displays an isolated run |
| Conversation, review requests, human approvals | Studio | Records intent, proposals, and decisions; approval is required for consequential actions |
| Deployment credentials and release | A later release service | Out of scope for the first integrated release |

There must be one authoritative copy for each concern. Studio may cache an Orren snapshot for display, keyed by project, semantic session, revision, and hash. It cannot silently edit that cache or write directly into Orren's database.

## User-facing composition

The default Studio workbench is one authoring loop with two synchronized views of one program: a language surface for speaking or writing intent, and a program model surface backed by the selected Orren semantic session. These are not separate products placed side by side. Selecting a program element focuses the language instruction on that element; applying an instruction updates the Orren-owned semantic record, and the model view refreshes at the returned revision. The model uses readable concepts, values, conditions, behaviors, and relationships instead of asking people to author source snippets.

The Studio shell owns identity, project selection, navigation, runtime/build/preview, and review context. Orren owns `.orn` intent, SIR, semantic commands, the nine dimensions, realization, and provenance. Studio does not fork Orren's semantic logic or write directly to its store. The full Orren Visual Hub remains available as a deeper inspector for tree, flow, dimensions, realization, and history; it is an inspection surface within the same project and semantic session, not a second project workspace. The host contract passes the Studio session and project-scoped API client explicitly. An iframe with broad browser storage access is not the integration boundary.

Speech capture is an optional browser capability activated by the user. Captured words remain editable in the language surface until the user applies them. Studio sends typed, project-scoped Orren commands with the current semantic revision and an idempotency key. The visible phrase grammar supports named elements, typed variables (`create variable visit count as number`), declarative activation rules (`create rule greet visitor when visitor arrives`), behaviors, and typed relationships. Free-form instructions attach as behavior to the selected element. Orren stores variable types in the cognitive dimension and rule conditions in the conditional dimension; executable code is a later realization artifact, not the user's authoring format.

The command surface is Studio's project navigator and Orren's semantic command entry, with a single input for voice or typing. It shows a server-reported logical current directory under `/projects/{projectId}` and offers familiar `pwd`, `ls`, and `cd` commands, plus a ZIP upload/extraction flow and public GitHub `clone` actions. A small explicit phrase grammar maps supported natural-language commands to structured operations; unknown input is rejected rather than passed to a shell. Extract and clone require a preview and a second confirmation. ZIP paths are checked against traversal and symlink entries, archive and expansion sizes are bounded, and existing files are not overwritten. Project files live beneath `HAEL_WORKSPACE_ROOT/{projectId}`; development falls back to an ignored local workspace directory, while production fails closed without an explicit root. The API does not run project scripts. Orren-facing phrases for element creation, variables, rules, behavior, and relationships submit versioned semantic commands. Help explains the command vocabulary and voice-provider privacy boundary.

When a semantic action affects source, Orren emits the changed semantic IDs and artifact mapping; Studio shows the build consequence and requests approval at the relevant boundary. Builds remain pinned to an Orren manifest and a verified source commit. This creates one coherent authoring experience while preserving one authoritative owner for each kind of state.

## System shape

```text
Browser
  ├─ Studio workspace UI: project, source, runtime, conversation, review
  └─ Orren Visual Hub surface: semantic tree, flow, dimensions, realization, provenance
          │ HTTPS / WebSocket (Studio session)
          ▼
Studio API / application boundary
  ├─ identity + project authorization
  ├─ repository adapter ── scoped provider credentials
  ├─ Orren adapter ─────── authenticated, versioned semantic protocol
  ├─ job coordinator ───── queue, build/preview isolation, cancellation
  ├─ event gateway ─────── ordered project events with resumable cursor
  └─ PostgreSQL ────────── Studio-owned records and job/event metadata
          │
          ├── Orren Engine service / worker
          │     ├─ parse → SIR → equilibrium → realization IR → codegen
          │     └─ Orren-owned project store, source/SIR hashes, provenance
          │
          └── ephemeral isolated build/preview worker
                └─ pinned source + approved realization artifacts; no secrets by default
```

The first integration should use a private Orren worker/service behind the Studio API. Browser clients never call Orren directly and never receive repository or provider credentials. The adapter is the only code that knows Orren's transport and version details. Start with one worker pool that enforces one active writer per semantic project; scale reads and independent projects separately. Do not shell out using user-controlled command strings.

Orren's existing CLI and Python API remain useful local interfaces. The service protocol is a new, explicit adapter contract; a CLI command is not assumed to be an HTTP API. If the worker uses a subprocess initially, invoke a fixed executable with validated structured input, a per-job working directory, bounded input/output, timeout, cancellation, and sanitized environment. Keep that implementation behind the adapter so it can later become a long-lived service without changing Studio clients.

## Semantic bridge contract

Use a versioned JSON contract generated from a single OpenAPI definition (or an equivalent published schema package owned by Orren). The initial operations are:

| Operation | Result |
|---|---|
| Open semantic session | Session ID, current source hash, SIR hash, revision, supported operations, engine version |
| Read snapshot | SIR nodes/edges, all nine dimensions, confidence, resolutions, realization targets, artifact status, provenance cursor |
| Submit command | A typed proposal such as add/move node, connect nodes, set dimension, resolve conflict, or request realization |
| Resolve proposal | Accepted/rejected outcome, new revision, changed node IDs, diagnostics, provenance events |
| Realize target | Job ID and target; completion returns artifact manifest, capability gaps, degradation obligations, and hashes |
| Read events | Ordered events after a cursor; supports reconnect and replay without losing changes |

Every write includes `projectId`, `semanticSessionId`, `expectedRevision`, `commandId` (idempotency key), and the actor. A stale revision returns a conflict with the current revision and snapshot reference; the client must refresh and let the human reconcile. A command is never applied twice when retried with the same command ID. Events include a monotonic per-session sequence, event ID, actor/producer, timestamp, source and SIR hashes, and correlation ID.

The bridge preserves the nine Orren dimensions as first-class values. Studio may progressively display them, but cannot omit them when caching, exporting, or submitting a semantic edit. A low-confidence parse or unresolved equilibrium conflict is represented as a proposal/diagnostic, not silently treated as settled intent.

## Runtime, realization, and source changes

Orren's generated artifacts are derived output. A semantic edit changes the SIR hash and marks affected artifacts stale. Realization emits a manifest that maps semantic node IDs to target paths, artifact hashes, capability status, source/SIR hashes, engine/backend versions, and provenance. Studio presents that mapping and can request a build only against a pinned manifest.

The live-construction loop is:

1. A user opens a project and an Orren semantic session at a known revision.
2. Studio records an explicit user action or an Orren suggestion as a typed command.
3. Orren parses/refines/resolves it, checks `expectedRevision`, persists the new semantic state, and emits ordered events.
4. Studio updates its read cache and identifies affected semantic nodes, artifacts, and runtime features from stable IDs and manifest mappings.
5. The user requests realization; Orren returns hashed artifacts and explicit gaps/degradation.
6. Studio requests a build/preview for that immutable artifact manifest in an isolated worker.
7. Runtime/HMR observations are correlated to the pinned build and mapped back to source/artifact/semantic IDs. They never mutate SIR by themselves.
8. Studio displays the result and offers a human-reviewed next action.

HMR observation is development-only and is not evidence that arbitrary generated code is safe. Build workers use disposable workspaces, least-privilege identities, resource/time limits, no ambient credentials, and default-deny network egress. A preview receives only the exact assets and scoped test fixtures it needs. User approval gates repository writes, merges, permission changes, and releases.

### Studio build and provenance API

Studio stores project-scoped build jobs in PostgreSQL. A request pins a 40/64-character source commit, Orren semantic revision, SHA-256 artifact manifest hash, and an `Idempotency-Key`. Repeating the same key and inputs returns the original job; changed inputs or actor conflict. Studio calls the private runner using `HAEL_BUILD_RUNNER_URL` and `HAEL_BUILD_RUNNER_TOKEN`. The runner accepts `POST /v1/builds`, returns a runner job ID and status, supports `GET /v1/builds/{runnerJobId}`, and accepts `POST /v1/builds/{runnerJobId}/cancel`. Studio validates the returned preview origin against `HAEL_PREVIEW_ORIGIN`, bounds the output manifest and diagnostics, and persists status, timestamps, and output hashes. Runner errors leave a durable failed job that can be retried before runner acceptance. An unconfigured runner fails closed; Studio never executes project source in its API process.

The Orren Visual Hub now has a project-scoped v1 API on the `codex/hael-project-sessions` upstream branch: `GET /v1/projects/{projectId}/snapshot` and `POST /v1/projects/{projectId}/commands`. Project sessions use per-project SQLite files, materialized SIR revisions, replayable idempotent commands, and optimistic revision checks. HAEL supports that contract when `ORREN_API_VERSION=1`; production stays fail-closed until the branch is merged and deployed with a private service token. The legacy `/api/health`, `/api/field`, and `/api/action` adapter remains restricted to the seeded project in development. HAEL requires HTTPS and a 32-character service token for remote/prod endpoints, rejects URL credentials/query/fragment data, and caps responses at 2 MB.

The runner is a separate deployment contract, not code shipped in this repository. It must resolve project IDs only through an approved repository/semantic binding, verify the requested commit and manifest hash, start disposable sandboxes with resource limits and default-deny egress, publish previews under the configured preview origin, and keep build credentials out of the preview. Production isolation is not achieved until that runner is deployed and its policy is verified. Runtime observations are accepted only for successful builds and only when artifact path/hash and runtime ID match the runner's immutable output manifest. Studio derives semantic node IDs from that manifest and stores ordered observations under the build ID. Studio issues a short-lived HMAC capability scoped to one project/build and includes a preview bootstrap collector in the runner request; the runner must inject the capability and final output manifest before app code runs. The collector reports lifecycle and browser errors, and app runtimes can emit `hael:runtime` events. Runtime reports are preview self-reports, not hardware-backed attestation.

## Persistence and recovery

Studio PostgreSQL owns accounts/memberships, projects, GitHub repository/branch bindings, conversations, reviews, job records, runtime observations, and a durable event outbox. Repository bindings contain no credentials. Public repositories can be read without a token; private repositories require a server-side `HAEL_GITHUB_TOKEN` with read-only contents access. That service token is shared by the Studio deployment and is not equivalent to per-user GitHub App grants, which remain future work. Orren owns source/SIR/realization semantic history and hashes. Its current optional SQLite project database is appropriate for local/single-project use; server deployments must provision one isolated durable store per semantic project or a database service with equivalent tenant isolation and transactional revision checks. Studio must not point multiple tenants at one unscoped SQLite file.

All long-running work is a durable job with `queued/running/succeeded/failed/cancelled` status, creator, input hashes, toolchain/engine versions, start/end time, output-manifest reference, and sanitized diagnostics. Retryable operations carry idempotency keys. A crash may lose a worker process, but not the job record or committed semantic revision. Reconnect replays events from the last acknowledged cursor, then fetches a snapshot if the cursor has expired.

The repository currently has a single seeded workspace ID. Before multi-project use, every API route and data access path must take a workspace/project identifier from the authorized request context, not from a module-level constant. Apply authorization before reads, writes, event subscription, or starting jobs. Store secrets in a provider vault/secret manager and only keep opaque references in Studio records.

## Identity, trust, and approval

- Use an OIDC-compatible identity provider behind a provider-neutral Studio auth interface. Enforce organization/project roles on the server. A UI role or hidden control is never authorization.
- Repository access is per installation/repository grant and read-only by default. A write requires a separately scoped grant and explicit user confirmation for the action.
- Studio-to-Orren service calls use workload identity or rotated service credentials, project-scoped authorization, TLS, and request IDs. Orren does not trust a browser-supplied actor or project ID.
- Treat `.orn`, repository files, model output, generated artifacts, tool output, and runtime events as untrusted data. They cannot change the worker's policy, authorization, or available secrets.
- Agent suggestions are proposals. Orren may report semantic confidence and conflicts; only the user or an explicitly authorized policy can accept a proposal that changes project state.
- Audit records capture who requested, proposed, accepted, ran, or released an action, with input/output hashes. Avoid placing raw secrets or unnecessary private source in logs.

## Failure behavior

Orren unavailable: Studio remains usable for inspecting the last authorized snapshot and local project metadata; semantic edits and realization are visibly unavailable and are not queued as if accepted.  
Studio database unavailable: fail closed for project mutations, authorization, and job creation; do not fall back to process memory in production.  
Build worker unavailable: keep the accepted semantic revision; mark the build job retryable/failed and preserve diagnostics.  
Revision conflict: return the current revision/snapshot reference; do not last-write-wins.  
Partial realization: retain successful artifacts, report each missing/degraded target and obligation, and never label the whole build as successful.  
Event disconnect: resume from cursor; if retention expired, refresh full snapshot and continue.

## Deployment topology

For the first integrated production environment, deploy the Studio web/API boundary, PostgreSQL, Orren worker, durable object storage for immutable artifacts, and an isolated job/preview runner. Keep the Orren worker and preview runner private to the application network. Use a managed queue or a Postgres-backed job queue initially; the job abstraction is stable if a dedicated queue is introduced later. Separate dev, test, and production credentials and databases. Deployments and public release infrastructure remain a later product phase.

## Delivery gates before UI completion

1. **Orren contract:** a draft Orren change adds the versioned project snapshot and command API, durable project sessions, optimistic revision checks, and idempotent commands. The contract still needs published schema/version policy and explicit realization/artifact operations. The draft must be reviewed and merged, then deployed with durable storage and a single-writer policy.
2. **Studio data model:** projects, role memberships, scoped workspace/runtime repository functions, project list/create/grant/revoke/list routes, and migrations for projects, sessions, audit events, build jobs, and runtime observations exist. The Studio UI supports project switching and owner/admin membership management. Successful workspace, runtime, project, membership, Orren command, build, and observation mutations write project audit records; owners/admins can read recent events. Owner removal is protected until ownership transfer exists. Ownership transfer, richer tenant/organization boundaries, migration and isolation evidence, and moving every browser surface to the selected project contract remain open.
3. **Orren adapter:** Studio has a versioned project/session client behind the API and requires the v1 contract in production. Its development fallback still proxies the legacy single session for the default project. Orren currently returns a project revision and SIR field, but does not emit source artifacts; the Studio build page reads the live Orren revision and gates build submission until a source manifest is available. Snapshot/command is not yet a full realization/event protocol.
4. **Repository and job boundaries:** Studio now stores project-scoped GitHub repository/branch bindings, checks branch heads through GitHub, and verifies a pinned commit against the bound repository before creating a build. Build records pin that repository identity and send it to the runner. Private repository access currently uses an optional deployment-level read-only token; per-user GitHub App grants and token rotation are open. Durable idempotent build jobs, runner dispatch/status/cancellation, pinned source/semantic/artifact hashes, output manifests, and build-bound runtime observations are implemented in the Studio API. The isolated runner remains an external deployment contract. Emitted-manifest retrieval, worker recovery/queue dispatch, resource limits, preview credential isolation, and runner policy evidence remain open. The UI labels this as a runner boundary; it does not claim deployment isolation has been independently verified.
5. **Runtime loop:** client-side HMR listens for Vite's before/after update events, re-registers stable runtime identities, traces dependency/effect relationships, and propagates dependent health. Studio issues build-scoped runtime capabilities, and the API validates reports against a successful build's output manifest. The reader orders observations by time across independent preview streams. The runner must still inject the collector into the preview; browser observations remain best-effort evidence rather than trusted execution attestation.
6. **Security and operations:** RS256 token signature, issuer, audience, time, and JWKS validation plus project-role checks are implemented in the API. Browser sign-in uses OIDC authorization code with PKCE, signed state, nonce, and a revocable server-side session. Sessions renew on activity after 15 minutes, expire after 12 hours idle, and have a 7-day absolute limit. Project audit events are durable in PostgreSQL and readable by project owners/admins. Remaining work includes ownership transfer, secret references, production database requirements, readiness, backups/restore, audit integrity/retention, and isolation evidence.
7. **Architecture evidence:** run fresh database migration, API/worker integration, concurrency/idempotency, authorization isolation, job isolation, failure/reconnect, and browser contract checks; record results here.

The current code has an Express API, OpenAPI contracts, Postgres workspace persistence, project/membership records, project-scoped workspace/runtime reads and writes, project create/list/grant/revoke operations, OIDC JWT verification, OIDC PKCE login, durable revocable sessions, project switching, and an owner/admin audit-history surface in Studio. Studio stores project GitHub repository/branch bindings, resolves the current branch head, and verifies requested commits against the bound repository before persisting the source identity with each build. Durable idempotent build jobs call a separately configured runner and persist runner status/output manifests; project-scoped runtime observations must match a successful build's manifest. Studio's project build view reads the current project-scoped Orren revision. Orren's project-session change is attached as an open draft PR, not yet part of a deployed service. The existing engine reports plans but no emitted source manifest, so build creation remains gated. Per-user GitHub grants, emitted-manifest retrieval, runner deployment and isolation evidence, collector injection, ownership transfer, and a complete realization protocol remain open. The delivery gates remain open while implementation and evidence continue.
