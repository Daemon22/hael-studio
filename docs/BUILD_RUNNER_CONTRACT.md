# HAEL isolated build runner contract

Studio sends the runner a durable build ID, project ID, pinned repository identity (`provider`, `repository`, and `branch`), verified repository commit, Orren semantic revision, expected artifact manifest hash, and idempotency key. Studio resolves the repository binding from project storage and asks GitHub to verify the commit before creating the job. The runner must independently check that the repository is on its project allowlist and verify the source and semantic pins; it must not treat the client-submitted project ID as authorization.

## Runtime provenance injection

Every build request also includes `runtimeProvenance`:

- `version`: protocol version (`1`).
- `callbackUrl`: public Studio URL for `POST /api/runtime/provenance`.
- `capability`: short-lived HMAC bearer scoped to the given build and project.
- `bootstrapSource`: browser collector source supplied by Studio.
- `configGlobal`: `__HAEL_RUNTIME_PROVENANCE__`.
- `reportGlobal`: `__HAEL_REPORT_RUNTIME__`.
- `manifestSource`: asks the runner to populate `artifacts` from the final output manifest.

Before publishing the preview, the runner must inject `window.__HAEL_RUNTIME_PROVENANCE__` with `callbackUrl`, `capability`, and the final `artifacts` array, then execute `bootstrapSource` before application code. Each artifact entry must include its final relative `path`, SHA-256 `sha256`, semantic node IDs, and runtime IDs. The returned manifest must describe the actual published preview after instrumentation has been included.

The collector reports preview start/close, visibility changes, unhandled errors, and unhandled promise rejections. Runtime modules may emit a `hael:runtime` browser event with `{ eventType, runtimeId, artifactPath, artifactHash, detail }`, or call `window.__HAEL_REPORT_RUNTIME__(eventType, runtimeId, artifactPath, artifactHash, detail)` directly. Studio rejects events whose build is not successful or whose artifact path, hash, or runtime ID does not match the output manifest.

The capability expires after 30 days and cannot read project data or control the runner. The preview must not receive `HAEL_BUILD_RUNNER_TOKEN`, repository credentials, `HAEL_RUNTIME_PROVENANCE_SECRET`, or any Studio session cookie. Reports are self-reported by browser code; they provide build correlation, not tamper-proof execution attestation.

## Operational requirements

- Use HTTPS between Studio and the runner and keep the runner private to the application network.
- Run each build in a disposable sandbox with CPU, memory, disk, and wall-clock limits, default-deny egress, and no ambient credentials.
- Scope output URLs to the configured preview origin and isolate preview cookies/storage from Studio.
- Make create requests idempotent by the supplied key. Persist accepted jobs before acknowledging them and recover queued/running jobs after worker restart.
- Sanitize diagnostics, cap response bodies, and never log the runtime capability or runner credential.
- Keep the runner as a separate service; Studio's API must never execute user project code.
