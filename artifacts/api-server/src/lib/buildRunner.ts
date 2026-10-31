import type { BuildJob } from "./workspaceRepository";
import { issueRuntimeCapability } from "./runtimeCapability";
import { RUNTIME_PROVENANCE_BOOTSTRAP } from "./runtimeBootstrap";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
export type RunnerManifestEntry = Record<string, unknown> & { path: string; sha256: string; semanticNodeIds: string[]; runtimeIds: string[] };
export type RunnerStatus = {
  runnerJobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  previewUrl?: string;
  outputManifest?: RunnerManifestEntry[];
  diagnostics?: string;
  startedAt?: string;
  finishedAt?: string;
};

function runnerBaseUrl(): URL {
  const value = process.env.HAEL_BUILD_RUNNER_URL;
  if (!value) throw new Error("The isolated build runner is not configured.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("HAEL_BUILD_RUNNER_URL is invalid."); }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && loopbackHosts.has(url.hostname))) {
    throw new Error("The isolated build runner must use HTTPS outside local development.");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("HAEL_BUILD_RUNNER_URL must not contain credentials or query values.");
  return url;
}

function runnerToken(): string {
  const token = process.env.HAEL_BUILD_RUNNER_TOKEN;
  if (!token || token.length < 32 || token.startsWith("replace-with-")) throw new Error("HAEL_BUILD_RUNNER_TOKEN must contain at least 32 non-placeholder characters.");
  return token;
}

function safeRunnerText(value: string, limit: number, extraSecrets: string[] = []): string {
  return [runnerToken(), ...extraSecrets].filter(Boolean).reduce((text, secret) => text.replaceAll(secret, "[redacted]"), value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, limit);
}

async function readRunnerJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) throw new Error("The build runner response exceeded the size limit.");
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new Error("The build runner response exceeded the size limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { return null; }
}

function validatePreviewUrl(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("The build runner returned an invalid preview URL.");
  let candidate: URL;
  try { candidate = new URL(value); } catch { throw new Error("The build runner returned an invalid preview URL."); }
  const expected = process.env.HAEL_PREVIEW_ORIGIN;
  if (!expected || candidate.origin !== new URL(expected).origin || candidate.protocol !== "https:") {
    if (!(process.env.NODE_ENV !== "production" && expected && candidate.origin === new URL(expected).origin && candidate.protocol === "http:")) {
      throw new Error("The build runner returned a preview URL outside the configured preview origin.");
    }
  }
  return candidate.toString();
}

function validateManifest(value: unknown): RunnerManifestEntry[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000) throw new Error("The build runner returned an invalid output manifest.");
  const paths = new Set<string>();
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error("The build runner returned an invalid output manifest entry.");
    const item = entry as Record<string, unknown>;
    if (typeof item.path !== "string" || !/^[A-Za-z0-9._/@+-]{1,512}$/.test(item.path)
      || item.path.startsWith("/") || item.path.split("/").some((part) => part === ".." || part === ".")
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)
      || !Array.isArray(item.semanticNodeIds) || !item.semanticNodeIds.every((id) => typeof id === "string" && id.length <= 160)
      || !Array.isArray(item.runtimeIds) || !item.runtimeIds.every((id) => typeof id === "string" && id.length <= 160)) {
      throw new Error("The build runner returned an invalid output manifest entry.");
    }
    if (paths.has(item.path)) throw new Error("The build runner returned duplicate manifest paths.");
    paths.add(item.path);
    return { path: item.path, sha256: item.sha256, semanticNodeIds: item.semanticNodeIds as string[], runtimeIds: item.runtimeIds as string[] };
  });
}

async function requestRunner(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<Record<string, unknown>> {
  const base = runnerBaseUrl();
  const url = new URL(`${base.pathname.replace(/\/$/, "")}${path}`, base.origin);
  const headers = new Headers({ accept: "application/json", authorization: `Bearer ${runnerToken()}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000), redirect: "error" });
  } catch {
    throw new Error("The isolated build runner could not be reached.");
  }
  const payload = await readRunnerJson(response);
  if (!response.ok || typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    const provenanceToken = typeof body === "object" && body !== null && "runtimeProvenance" in body
      && typeof body.runtimeProvenance === "object" && body.runtimeProvenance !== null
      && "capability" in body.runtimeProvenance && typeof body.runtimeProvenance.capability === "string"
      ? body.runtimeProvenance.capability : "";
    const detail = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? safeRunnerText(payload.error, 500, [provenanceToken]) : `The build runner returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return payload as Record<string, unknown>;
}

function parseStatus(payload: Record<string, unknown>, extraSecrets: string[] = []): RunnerStatus {
  const runnerJobId = payload.runnerJobId;
  const status = payload.status;
  if (typeof runnerJobId !== "string" || runnerJobId.length < 1 || runnerJobId.length > 200
    || !["queued", "running", "succeeded", "failed", "cancelled"].includes(String(status))) {
    throw new Error("The build runner returned an invalid job status.");
  }
  const previewUrl = validatePreviewUrl(payload.previewUrl);
  const outputManifest = validateManifest(payload.outputManifest);
  if (status === "succeeded" && (!previewUrl || outputManifest.length === 0)) {
    throw new Error("A successful build must return a preview URL and artifact manifest.");
  }
  const diagnostics = typeof payload.diagnostics === "string" ? safeRunnerText(payload.diagnostics, 4000, extraSecrets) : undefined;
  const parseDate = (date: unknown) => {
    if (date === undefined || date === null) return undefined;
    if (typeof date !== "string" || Number.isNaN(Date.parse(date))) throw new Error("The build runner returned an invalid timestamp.");
    return new Date(date).toISOString();
  };
  return { runnerJobId, status: status as RunnerStatus["status"], previewUrl, outputManifest, diagnostics, startedAt: parseDate(payload.startedAt), finishedAt: parseDate(payload.finishedAt) };
}

export async function submitBuildToRunner(job: BuildJob): Promise<RunnerStatus> {
  if (!job.sourceRepository || !job.sourceBranch) throw new Error("This build is missing its pinned repository binding.");
  const configuredOrigin = process.env.HAEL_STUDIO_API_ORIGIN;
  if (!configuredOrigin) throw new Error("HAEL_STUDIO_API_ORIGIN is required for build-bound runtime provenance.");
  let apiOrigin: URL;
  try { apiOrigin = new URL(configuredOrigin); } catch { throw new Error("HAEL_STUDIO_API_ORIGIN is invalid."); }
  const local = process.env.NODE_ENV !== "production" && loopbackHosts.has(apiOrigin.hostname) && apiOrigin.protocol === "http:";
  if ((!local && apiOrigin.protocol !== "https:") || apiOrigin.username || apiOrigin.password || apiOrigin.pathname !== "/" || apiOrigin.search || apiOrigin.hash) {
    throw new Error("HAEL_STUDIO_API_ORIGIN must be an HTTPS origin (or local HTTP origin during development).");
  }
  const capability = issueRuntimeCapability(job.projectId, job.id);
  const payload = await requestRunner("/v1/builds", "POST", {
    jobId: job.id,
    projectId: job.projectId,
    sourceRepository: { provider: "github", repository: job.sourceRepository, branch: job.sourceBranch },
    sourceCommit: job.sourceCommit,
    semanticRevision: job.semanticRevision,
    artifactManifestHash: job.artifactManifestHash,
    idempotencyKey: job.idempotencyKey,
    runtimeProvenance: {
      version: 1,
      callbackUrl: new URL("/api/runtime/provenance", apiOrigin.origin).toString(),
      capability,
      bootstrapSource: RUNTIME_PROVENANCE_BOOTSTRAP,
      configGlobal: "__HAEL_RUNTIME_PROVENANCE__",
      reportGlobal: "__HAEL_REPORT_RUNTIME__",
      manifestSource: "the successful build outputManifest returned by this runner",
    },
  });
  return parseStatus(payload, [capability]);
}

export async function getRunnerBuildStatus(runnerJobId: string): Promise<RunnerStatus> {
  return parseStatus(await requestRunner(`/v1/builds/${encodeURIComponent(runnerJobId)}`, "GET"));
}

export async function cancelRunnerBuild(runnerJobId: string): Promise<RunnerStatus> {
  return parseStatus(await requestRunner(`/v1/builds/${encodeURIComponent(runnerJobId)}/cancel`, "POST", {}));
}
