import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { verifyRuntimeCapability } from "../lib/runtimeCapability";
import { RUNTIME_PROVENANCE_BOOTSTRAP } from "../lib/runtimeBootstrap";
import { getBuildJob, recordProjectAuditEvent, recordRuntimeObservation } from "../lib/workspaceRepository";

const router: IRouter = Router();
const ObservationBody = z.object({
  streamId: z.string().trim().min(8).max(128),
  sequence: z.number().int().min(0).max(2_147_483_647),
  runtimeId: z.string().trim().min(1).max(160),
  eventType: z.enum(["hmr_update", "runtime_error", "dependency_degraded", "lifecycle"]),
  artifactPath: z.string().trim().min(1).max(512),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/i),
  detail: z.string().max(1000).optional(),
}).strict();

router.post("/runtime/provenance", async (req, res) => {
  const authorization = req.header("authorization") ?? "";
  const match = /^Bearer (hael-runtime-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization);
  const capability = match ? verifyRuntimeCapability(match[1]!) : null;
  if (!capability) { res.status(401).json({ error: "Runtime provenance capability is invalid or expired.", code: "invalid_runtime_capability" }); return; }
  const parsed = ObservationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Runtime observation is invalid.", code: "invalid_runtime_observation" }); return; }
  const job = await getBuildJob(capability.projectId, capability.buildId);
  if (!job || job.status !== "succeeded") { res.status(404).json({ error: "Successful build was not found.", code: "build_not_found" }); return; }
  const artifact = job.outputManifest.find((entry) => entry.path === parsed.data.artifactPath && entry.sha256 === parsed.data.artifactHash.toLowerCase());
  if (!artifact || !Array.isArray(artifact.runtimeIds) || !artifact.runtimeIds.includes(parsed.data.runtimeId)) {
    res.status(409).json({ error: "Observation does not match the successful build output manifest.", code: "runtime_provenance_mismatch" });
    return;
  }
  const actorSubject = `runtime:${job.id}`;
  const observation = {
    id: randomUUID(), projectId: job.projectId, buildId: job.id, actorSubject,
    ...parsed.data, artifactHash: parsed.data.artifactHash.toLowerCase(),
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
  await recordProjectAuditEvent({ id: randomUUID(), projectId: job.projectId, actorSubject,
    action: "runtime.observation.reported", resourceType: "build", resourceId: job.id, requestId: String(req.id),
    metadata: { sequence: observation.sequence, runtimeId: observation.runtimeId, eventType: observation.eventType }, outcome: "succeeded" });
  res.status(201).json({ accepted: true, sequence: observation.sequence });
});

export default router;
