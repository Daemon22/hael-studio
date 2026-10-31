import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { cancelRunnerBuild, getRunnerBuildStatus, submitBuildToRunner } from "../lib/buildRunner";
import { GitHubUnavailableError, resolveGitHubBranchCommit } from "../lib/githubRepository";
import { readOrrenProject } from "../lib/orrenClient";
import { authorizeProjectRequest } from "../lib/projectAccess";
import {
  BuildIdempotencyConflictError,
  createBuildJob,
  getBuildJob,
  listBuildJobs,
  getProjectRepository,
  readRuntimeObservations,
  recordProjectAuditEvent,
  recordRuntimeObservation,
  updateBuildJob,
  type BuildJob,
  type BuildStatus,
} from "../lib/workspaceRepository";

const router: IRouter = Router({ mergeParams: true });
router.use(authorizeProjectRequest);

const CreateBuildBody = z.object({
  sourceCommit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i),
  semanticRevision: z.number().int().min(0).max(2_147_483_647),
  artifactManifestHash: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();
const ObservationBody = z.object({
  streamId: z.string().trim().min(8).max(128).optional(),
  sequence: z.number().int().min(0).max(2_147_483_647),
  runtimeId: z.string().trim().min(1).max(160),
  eventType: z.enum(["hmr_update", "runtime_error", "dependency_degraded", "lifecycle"]),
  artifactPath: z.string().trim().min(1).max(512),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/i),
  detail: z.string().max(1000).optional(),
}).strict();

function toPublicBuild(job: BuildJob) {
  return {
    id: job.id, projectId: job.projectId, requestedBy: job.requestedBy,
    sourceRepository: job.sourceRepository, sourceBranch: job.sourceBranch,
    sourceCommit: job.sourceCommit, semanticRevision: job.semanticRevision,
    artifactManifestHash: job.artifactManifestHash, status: job.status,
    previewUrl: job.previewUrl, outputManifest: job.outputManifest,
    diagnostics: job.diagnostics, retryable: (job.status === "failed" || job.status === "queued") && !job.runnerJobId,
    cancelable: (job.status === "queued" || job.status === "running") && Boolean(job.runnerJobId),
    createdAt: job.createdAt, startedAt: job.startedAt, finishedAt: job.finishedAt,
  };
}

function runnerPatch(status: Awaited<ReturnType<typeof submitBuildToRunner>>) {
  const nextStatus: BuildStatus = status.status;
  return {
    status: nextStatus,
    runnerJobId: status.runnerJobId,
    previewUrl: status.previewUrl,
    outputManifest: status.outputManifest,
    diagnostics: status.diagnostics,
    startedAt: status.startedAt,
    finishedAt: status.finishedAt,
  };
}

async function dispatch(job: BuildJob, req: Parameters<typeof authorizeProjectRequest>[0]) {
  let status: Awaited<ReturnType<typeof submitBuildToRunner>>;
  try {
    status = await submitBuildToRunner(job);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "The isolated runner rejected this build.";
    const failed = await updateBuildJob(job.projectId, job.id, { status: "failed", diagnostics: message, finishedAt: new Date().toISOString() }) ?? job;
    await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId, actorSubject: job.requestedBy,
      action: "build.dispatch_failed", resourceType: "build", resourceId: job.id, requestId: String(req.id),
      metadata: { stage: "runner_dispatch" }, outcome: "rejected" });
    return failed;
  }
  const updated = await updateBuildJob(job.projectId, job.id, runnerPatch(status));
  if (status.status === "queued" || status.status === "running") {
    await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId, actorSubject: job.requestedBy,
      action: "build.dispatched", resourceType: "build", resourceId: job.id, requestId: String(req.id),
      metadata: { runnerJobId: status.runnerJobId }, outcome: "succeeded" });
  }
  return updated ?? job;
}

router.post("/builds", async (req, res) => {
  const parsed = CreateBuildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Build input requires a pinned source commit, semantic revision, and SHA-256 artifact manifest hash." });
    return;
  }
  const idempotencyKey = req.header("idempotency-key")?.trim();
  if (!idempotencyKey || !/^[a-zA-Z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    res.status(400).json({ error: "Provide an Idempotency-Key between 8 and 128 safe characters." });
    return;
  }
  const actor = res.locals.studioActor as { subject: string };
  if (process.env.ORREN_API_VERSION !== "1") {
    res.status(503).json({ error: "Builds require the project-scoped Orren v1 semantic snapshot API.", code: "orren_snapshot_unavailable" });
    return;
  }
  let semanticSnapshot: Record<string, unknown>;
  try { semanticSnapshot = await readOrrenProject(res.locals.studioProjectId); }
  catch {
    res.status(503).json({ error: "The selected project's semantic snapshot could not be read from Orren.", code: "orren_snapshot_unavailable" });
    return;
  }
  if (semanticSnapshot.projectId !== res.locals.studioProjectId || semanticSnapshot.revision !== parsed.data.semanticRevision) {
    res.status(409).json({ error: "The pinned Orren revision is no longer current. Refresh the semantic workspace and retry.", code: "orren_revision_conflict" });
    return;
  }
  const semanticField = semanticSnapshot.field;
  const semanticRuntime = typeof semanticField === "object" && semanticField !== null && "runtime" in semanticField
    ? semanticField.runtime : null;
  if (typeof semanticRuntime !== "object" || semanticRuntime === null || !("codegenAvailable" in semanticRuntime) || semanticRuntime.codegenAvailable !== true) {
    res.status(409).json({ error: "Orren has no emitted source artifacts for this semantic revision. Build submission is unavailable until an artifact manifest is emitted.", code: "semantic_artifacts_unavailable" });
    return;
  }
  const repository = await getProjectRepository(res.locals.studioProjectId);
  if (!repository) {
    res.status(409).json({ error: "Connect a trusted GitHub repository before requesting a build.", code: "repository_not_connected" });
    return;
  }
  let verifiedCommit: Awaited<ReturnType<typeof resolveGitHubBranchCommit>>;
  try { verifiedCommit = await resolveGitHubBranchCommit(repository.repository, repository.branch, parsed.data.sourceCommit); }
  catch (error) {
    const unavailable = error instanceof GitHubUnavailableError;
    res.status(unavailable ? 503 : 422).json({ error: error instanceof Error ? error.message : "The source commit could not be verified against the connected repository.", code: unavailable ? "github_unavailable" : "source_commit_unverified" });
    return;
  }
  const now = new Date().toISOString();
  const job: BuildJob = {
    id: randomUUID(), projectId: res.locals.studioProjectId, requestedBy: actor.subject, idempotencyKey,
    ...parsed.data, sourceRepository: repository.repository, sourceBranch: repository.branch,
    sourceCommit: verifiedCommit.sha,
    artifactManifestHash: parsed.data.artifactManifestHash.toLowerCase(), status: "queued", outputManifest: [], createdAt: now,
  };
  try {
    const result = await createBuildJob(job);
    if (!result.created) {
      const current = result.job.status === "queued" && !result.job.runnerJobId
        ? await dispatch(result.job, req)
        : result.job;
      res.status(current.status === "queued" || current.status === "running" ? 202 : 200).json(toPublicBuild(current));
      return;
    }
    await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId, actorSubject: actor.subject,
      action: "build.requested", resourceType: "build", resourceId: job.id, requestId: String(req.id),
      metadata: { sourceCommit: job.sourceCommit, semanticRevision: job.semanticRevision, artifactManifestHash: job.artifactManifestHash }, outcome: "succeeded" });
    const dispatched = await dispatch(job, req);
    if (dispatched.status === "failed") {
      res.status(503).json({ error: dispatched.diagnostics ?? "The isolated runner could not accept this build.", build: toPublicBuild(dispatched) });
      return;
    }
    res.status(202).json(toPublicBuild(dispatched));
  } catch (error) {
    if (error instanceof BuildIdempotencyConflictError) {
      res.status(409).json({ error: error.message, code: "idempotency_key_conflict" });
      return;
    }
    throw error;
  }
});

router.get("/builds", async (req, res) => {
  const rawLimit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    res.status(400).json({ error: "Build history limit must be between 1 and 100." });
    return;
  }
  const jobs = await listBuildJobs(res.locals.studioProjectId, rawLimit);
  const refreshed = await Promise.all(jobs.map(async (job) => {
    if (job.runnerJobId && (job.status === "queued" || job.status === "running")) {
      try {
        const status = await getRunnerBuildStatus(job.runnerJobId);
        if (status.runnerJobId === job.runnerJobId) return await updateBuildJob(job.projectId, job.id, runnerPatch(status)) ?? job;
      } catch { /* Preserve the last durable status while the runner is unavailable. */ }
    }
    return job;
  }));
  res.json(refreshed.map(toPublicBuild));
});

router.get("/builds/:buildId", async (req, res) => {
  const job = await getBuildJob(res.locals.studioProjectId, req.params.buildId!);
  if (!job) { res.status(404).json({ error: "Build not found.", code: "build_not_found" }); return; }
  if (job.runnerJobId && ["queued", "running"].includes(job.status)) {
    try {
      const status = await getRunnerBuildStatus(job.runnerJobId);
      if (status.runnerJobId !== job.runnerJobId) throw new Error("Runner job identity mismatch.");
      const updated = await updateBuildJob(job.projectId, job.id, runnerPatch(status));
      if (updated && updated.status !== job.status) {
        await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId, actorSubject: job.requestedBy,
          action: "build.status_changed", resourceType: "build", resourceId: job.id, requestId: String(req.id),
          metadata: { from: job.status, to: updated.status }, outcome: "succeeded" });
      }
      res.json(toPublicBuild(updated ?? job));
      return;
    } catch {
      // Keep the last durable state visible while the runner is temporarily unavailable.
    }
  }
  res.json(toPublicBuild(job));
});

router.post("/builds/:buildId/retry", async (req, res) => {
  const job = await getBuildJob(res.locals.studioProjectId, req.params.buildId!);
  if (!job) { res.status(404).json({ error: "Build not found.", code: "build_not_found" }); return; }
  if ((job.status !== "failed" && job.status !== "queued") || job.runnerJobId) {
    res.status(409).json({ error: "Only a build that has not been accepted by the runner can be retried here.", code: "build_not_retryable" });
    return;
  }
  const reset = await updateBuildJob(job.projectId, job.id, { status: "queued", diagnostics: null, startedAt: null, finishedAt: null });
  const dispatched = await dispatch(reset ?? job, req);
  await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId,
    actorSubject: (res.locals.studioActor as { subject: string }).subject, action: "build.retried",
    resourceType: "build", resourceId: job.id, requestId: String(req.id), metadata: {}, outcome: "succeeded" });
  if (dispatched.status === "failed") {
    res.status(503).json({ error: dispatched.diagnostics ?? "The isolated runner could not accept this build.", build: toPublicBuild(dispatched) });
    return;
  }
  res.status(202).json(toPublicBuild(dispatched));
});

router.post("/builds/:buildId/cancel", async (req, res) => {
  const job = await getBuildJob(res.locals.studioProjectId, req.params.buildId!);
  if (!job) { res.status(404).json({ error: "Build not found.", code: "build_not_found" }); return; }
  if (!["queued", "running"].includes(job.status) || !job.runnerJobId) {
    res.status(409).json({ error: "This build cannot be cancelled in its current state.", code: "build_not_cancellable" });
    return;
  }
  const status = await cancelRunnerBuild(job.runnerJobId);
  if (status.runnerJobId !== job.runnerJobId) { res.status(502).json({ error: "The runner returned a different job identity." }); return; }
  const updated = await updateBuildJob(job.projectId, job.id, runnerPatch(status));
  await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId,
    actorSubject: (res.locals.studioActor as { subject: string }).subject,
    action: status.status === "cancelled" ? "build.cancelled" : "build.cancel_requested",
    resourceType: "build", resourceId: job.id, requestId: String(req.id), metadata: { runnerStatus: status.status }, outcome: "succeeded" });
  res.json(toPublicBuild(updated ?? job));
});

router.get("/builds/:buildId/observations", async (req, res) => {
  const job = await getBuildJob(res.locals.studioProjectId, req.params.buildId!);
  if (!job) { res.status(404).json({ error: "Build not found.", code: "build_not_found" }); return; }
  res.json(await readRuntimeObservations(job.projectId, job.id));
});

router.post("/builds/:buildId/observations", async (req, res) => {
  const job = await getBuildJob(res.locals.studioProjectId, req.params.buildId!);
  if (!job) { res.status(404).json({ error: "Build not found.", code: "build_not_found" }); return; }
  if (job.status !== "succeeded") { res.status(409).json({ error: "Runtime observations require a successful, pinned build.", code: "build_not_ready" }); return; }
  const parsed = ObservationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Runtime observation is invalid." }); return; }
  const artifact = job.outputManifest.find((entry) => entry.path === parsed.data.artifactPath && entry.sha256 === parsed.data.artifactHash.toLowerCase());
  if (!artifact || !Array.isArray(artifact.runtimeIds) || !artifact.runtimeIds.includes(parsed.data.runtimeId)) {
    res.status(409).json({ error: "The observation does not match a runtime identity in this build manifest.", code: "runtime_provenance_mismatch" });
    return;
  }
  const observation = {
    id: randomUUID(), projectId: job.projectId, buildId: job.id,
    actorSubject: (res.locals.studioActor as { subject: string }).subject,
    ...parsed.data,
    streamId: parsed.data.streamId ?? "manual",
    artifactHash: parsed.data.artifactHash.toLowerCase(),
    semanticNodeIds: Array.isArray(artifact.semanticNodeIds) ? artifact.semanticNodeIds.filter((id): id is string => typeof id === "string") : [],
    observedAt: new Date().toISOString(),
  };
  try { await recordRuntimeObservation(observation); }
  catch (error) {
    if (error instanceof Error && (error.message.includes("sequence") || error.message.includes("duplicate key"))) {
      res.status(409).json({ error: "This observation sequence was already recorded.", code: "runtime_sequence_conflict" });
      return;
    }
    throw error;
  }
  await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId,
    actorSubject: (res.locals.studioActor as { subject: string }).subject, action: "runtime.observation.recorded",
    resourceType: "build", resourceId: job.id, requestId: String(req.id),
    metadata: { sequence: observation.sequence, runtimeId: observation.runtimeId, eventType: observation.eventType }, outcome: "succeeded" });
  res.status(201).json(observation);
});

export default router;
