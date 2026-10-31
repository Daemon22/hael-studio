import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import { callOrren, commandOrrenProject, OrrenUnavailableError, readOrrenProject } from "../lib/orrenClient";
import { authorizeProjectRequest } from "../lib/projectAccess";
import { recordProjectAuditEvent } from "../lib/workspaceRepository";
import { initialWorkspace } from "../lib/workspaceSeed";

const router: IRouter = Router({ mergeParams: true });
router.use((req, res, next) => {
  const versioned = process.env.ORREN_API_VERSION === "1";
  const selectedProjectId = req.header("x-studio-project-id") ?? initialWorkspace.id;
  if (!versioned && selectedProjectId !== initialWorkspace.id) {
    res.status(409).json({ error: "Orren is not yet provisioned with an isolated semantic session for this project.", code: "orren_project_scope_unavailable" });
    return;
  }
  req.params.projectId = versioned ? selectedProjectId : initialWorkspace.id;
  next();
});
router.use(authorizeProjectRequest);
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production" && process.env.ORREN_API_VERSION !== "1") {
    res.status(503).json({ error: "Production requires the project-scoped Orren API v1 contract.", code: "orren_bridge_not_secured" });
    return;
  }
  next();
});
const validTargets = new Set(["web_interface", "android_app", "rust_core"]);
const validRelations = new Set(["feeds", "triggers", "produces", "depends_on"]);

function validateAction(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const action = input.action;
  const text = (key: string, max: number, optional = false): string | null | undefined => {
    const candidate = input[key];
    if (candidate === undefined && optional) return undefined;
    if (typeof candidate !== "string") return null;
    const normalized = candidate.trim();
    return normalized.length > 0 && normalized.length <= max ? normalized : null;
  };

  if (action === "reset" && (input.mode === "example" || input.mode === "empty")) return { action, mode: input.mode };
  if (action === "realize") {
    const nodeId = text("nodeId", 160, true);
    return nodeId === null ? null : { action, ...(nodeId ? { nodeId } : {}) };
  }
  if (action === "create") {
    const name = text("name", 48);
    const parentId = text("parentId", 160, true);
    return name && parentId !== null ? { action, name, ...(parentId ? { parentId } : {}) } : null;
  }
  if (action === "variable") {
    const name = text("name", 48);
    const parentId = text("parentId", 160, true);
    const valueType = input.valueType;
    return name && parentId !== null && typeof valueType === "string" && ["text", "number", "boolean", "date", "list", "object"].includes(valueType)
      ? { action, name, valueType, ...(parentId ? { parentId } : {}) } : null;
  }
  if (action === "rule") {
    const name = text("name", 48);
    const condition = text("condition", 180);
    const parentId = text("parentId", 160, true);
    return name && condition && parentId !== null ? { action, name, condition, ...(parentId ? { parentId } : {}) } : null;
  }
  if (action === "behavior") {
    const nodeId = text("nodeId", 160);
    const behavior = text("text", 180);
    return nodeId && behavior ? { action, nodeId, text: behavior } : null;
  }
  if (action === "move") {
    const nodeId = text("nodeId", 160);
    const parentId = text("parentId", 160);
    return nodeId && parentId ? { action, nodeId, parentId } : null;
  }
  if (action === "relate") {
    const from = text("from", 160);
    const to = text("to", 160);
    const type = input.type;
    const note = text("note", 120, true);
    return from && to && typeof type === "string" && validRelations.has(type) && note !== null
      ? { action, from, to, type, ...(note ? { note } : {}) }
      : null;
  }
  if ((action === "add_target" || action === "remove_target") && typeof input.target === "string" && validTargets.has(input.target)) {
    return { action, target: input.target };
  }
  return null;
}

function sendOrrenError(error: unknown, res: Response) {
  if (error instanceof OrrenUnavailableError) {
    res.status(503).json({ error: error.message, code: "orren_unavailable" });
    return;
  }
  if (typeof error === "object" && error !== null && "status" in error && (error.status === 400 || error.status === 409)) {
    const payload = "payload" in error && typeof error.payload === "object" && error.payload !== null ? error.payload : {};
    res.status(error.status).json({ error: error instanceof Error ? error.message : "Orren rejected the request.", ...payload });
    return;
  }
  throw error;
}

router.get("/orren/health", async (_req, res, next) => {
  try {
    res.json({ connected: true, runtime: await callOrren("/api/health") });
  } catch (error) {
    try { sendOrrenError(error, res); } catch (unexpected) { next(unexpected); }
  }
});

router.get("/orren/field", async (_req, res, next) => {
  try {
    const payload = process.env.ORREN_API_VERSION === "1"
      ? await readOrrenProject(res.locals.studioProjectId)
      : { field: await callOrren("/api/field") };
    res.json({ connected: true, ...payload });
  } catch (error) {
    try { sendOrrenError(error, res); } catch (unexpected) { next(unexpected); }
  }
});

router.post("/orren/action", async (req, res, next) => {
  const action = validateAction(req.body);
  if (!action) {
    res.status(400).json({ error: "Orren action is invalid." });
    return;
  }
  try {
    let result: Record<string, unknown>;
    if (process.env.ORREN_API_VERSION === "1") {
      const revisionHeader = req.header("if-match")?.replace(/^"|"$/g, "");
      const idempotencyKey = req.header("idempotency-key")?.trim();
      const revision = revisionHeader && /^\d+$/.test(revisionHeader) ? Number(revisionHeader) : Number.NaN;
      if (!Number.isSafeInteger(revision) || revision < 0 || !idempotencyKey || !/^[a-zA-Z0-9._:-]{8,128}$/.test(idempotencyKey)) {
        res.status(400).json({ error: "Versioned Orren commands require a numeric If-Match revision and Idempotency-Key.", code: "orren_command_headers_required" });
        return;
      }
      result = await commandOrrenProject(res.locals.studioProjectId, revision, idempotencyKey, action);
    } else {
      result = await callOrren("/api/action", action);
    }
    await recordProjectAuditEvent({
      id: randomUUID(), projectId: res.locals.studioProjectId, actorSubject: (res.locals.studioActor as { subject: string }).subject,
      action: `orren.${String(action.action)}.submitted`, resourceType: "semantic_command",
      requestId: String(req.id), metadata: { command: action.action }, outcome: "succeeded",
    });
    res.json(process.env.ORREN_API_VERSION === "1"
      ? { connected: true, ...result }
      : { connected: true, field: result });
  } catch (error) {
    try { sendOrrenError(error, res); } catch (unexpected) { next(unexpected); }
  }
});

export default router;
