# Orren Visual Hub in Hael Studio

**Status:** Phase 1 — isolated, static, read-only visual sample.

## Purpose and ownership

Hael Studio provides a dedicated entry point to Orren's Visual Hub at `/orren/index.html`. The Hub remains an Orren-owned semantic surface: it visualizes a SIR field and is not merged into Hael Studio's UI `StateEngine`, generic workspace API, or authored runtime-event channel. Orren remains the authority for SIR meaning; this static host does not create a second source of semantic truth.

The Studio top bar opens the Hub in a separate tab so the two application shells and their state remain isolated. The hosted page contains the five Orren views over a bundled illustrative sample graph. Selection, filtering, and view navigation are presentation-only. Node creation, behavior edits, relationship changes, drag-to-restructure, target changes, and realization controls are disabled.

## What this integration does not do

- It does not call Orren's Python API or Hael Studio's API.
- It does not read or mutate Hael's React state, `StateEngine`, or persisted runtime-state resource.
- It does not persist edits, connect to a live SIR session, or create audit/provenance records.
- Its target cards and paths are illustrative sample data only; no realization files are emitted or deployed.
- It does not establish authentication, authorization, or private workspace access.

The page displays these limits directly. Do not describe the bundled sample as a connected or live Orren workspace.

## Source and visual identity

The static UI was mirrored from `Daemon22/Orren` at commit `ece3e6b1b59cf050cc5533c2a354dfee383189c6` (`Connect Visual Hub to live SIR runtime`). The Orren emblem and sanctuary artwork were copied byte-for-byte from `Orren/visual-hub/assets/`; their recorded SHA-256 values are:

| Asset | SHA-256 |
|---|---|
| `orren-emblem.webp` | `dec227b7d6efbe0e7c232c2f26393d12b085d8058dc308593abfe98fae8dc8bf` |
| `orren-sanctuary.webp` | `4c84864c411e320ea23722c20457487dc344388d4ce2ce1ee7de9833afe7b591` |

Architecture sources reviewed:

- [Orren Visual Hub source commit](https://github.com/Daemon22/Orren/tree/ece3e6b1b59cf050cc5533c2a354dfee383189c6/visual-hub)
- [Hael Studio source revision](https://github.com/Daemon22/hael-studio/tree/f00835c47a14b57a5bc0c57af231f6bd1ffdaa6c)
- [Hael Studio SIRE/ERIS visual-canon rule](https://github.com/Daemon22/hael-studio/blob/main/docs/canon/SIRE-ERIS-VISUAL-CANON.md)
- [HAEL Foundation cross-repository commitment audit](https://github.com/Daemon22/haelfoundation/blob/main/docs/COMMITMENT-AUDIT-2026-10-12.md)

This view uses Orren's identity only. It does not depict or substitute for SIRE or ERIS. The canonical SIRE/ERIS binaries are not present in the inspected Studio repository; if a future Studio feature displays either identity, it must use the exact founder-supplied bytes and verify the hashes recorded in the Studio visual-canon document. A missing canonical asset must be reported, never replaced with an approximation.

## Gate before a live connection

Do not enable browser-to-engine writes or claim live SIR integration until the architecture provides all of the following:

1. A persistent, authenticated Orren service suitable for the intended deployment (the current Python server is process-local and unauthenticated).
2. A versioned request/response schema with explicit workspace identity and optimistic revision handling.
3. A narrow server-side Studio adapter/BFF with allowlisted commands, timeout/error contracts, and credentials kept server-side; do not proxy the current raw action endpoint as-is.
4. Durable SIR state, provenance/audit records, and an explicit user-confirmation boundary for mutations.
5. Distinct states for realization plans versus emitted, verified artifacts.
6. Verified permissions and deployment handling for any private identity assets.

The current Studio API's generic messages and runtime events are not an Orren command bus. Its browser-local `StateEngine` is not an SIR store. Keep the static integration isolated until the above gates are implemented and tested.
