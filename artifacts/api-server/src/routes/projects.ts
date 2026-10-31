import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { authorizeProjectRequest } from "../lib/projectAccess";
import { createProject, getProjectRole, listProjectMembers, listProjectsForSubject, manageProjectMembership, readProjectAuditEvents, recordProjectAuditEvent } from "../lib/workspaceRepository";

const router: IRouter = Router();
const CreateProjectBody = z.object({ name: z.string().trim().min(1).max(80) }).strict();
const GrantMembershipBody = z.object({
  subject: z.string().trim().min(1).max(255),
  role: z.enum(["admin", "editor", "viewer"]),
}).strict();
const AuditQuery = z.coerce.number().int().min(1).max(250).default(100);

router.get("/projects", async (_req, res) => {
  const actor = res.locals.studioActor as { subject: string };
  res.json(await listProjectsForSubject(actor.subject));
});

router.get("/projects/:projectId/memberships", authorizeProjectRequest, async (_req, res) => {
  const actor = res.locals.studioActor as { subject: string };
  const role = await getProjectRole(res.locals.studioProjectId, actor.subject);
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Project membership is limited to owners and admins.", code: "project_admin_required" });
    return;
  }
  res.json(await listProjectMembers(res.locals.studioProjectId));
});

router.post("/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Project name must be between 1 and 80 characters." });
    return;
  }
  const actor = res.locals.studioActor as { subject: string };
  const id = `prj_${randomUUID()}`;
  await createProject(id, parsed.data.name, actor.subject);
  await recordProjectAuditEvent({
    id: randomUUID(), projectId: id, actorSubject: actor.subject, action: "project.created", resourceType: "project", resourceId: id,
    requestId: String(req.id), metadata: {}, outcome: "succeeded",
  });
  res.status(201).json({ id, name: parsed.data.name, role: "owner" });
});

router.get("/projects/:projectId/audit", authorizeProjectRequest, async (req, res) => {
  const actor = res.locals.studioActor as { subject: string };
  const role = await getProjectRole(res.locals.studioProjectId, actor.subject);
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ error: "Project audit history is limited to owners and admins.", code: "project_admin_required" });
    return;
  }
  const limit = AuditQuery.safeParse(req.query.limit);
  if (!limit.success) {
    res.status(400).json({ error: "Audit history limit must be between 1 and 250." });
    return;
  }
  res.json(await readProjectAuditEvents(res.locals.studioProjectId, limit.data));
});

router.post("/projects/:projectId/memberships", authorizeProjectRequest, async (req, res) => {
  const actor = res.locals.studioActor as { subject: string };
  const parsed = GrantMembershipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid member subject and role are required." });
    return;
  }
  const result = await manageProjectMembership(res.locals.studioProjectId, actor.subject, parsed.data.subject, parsed.data.role);
  if (result === "actor_forbidden") {
    res.status(403).json({ error: "Only project owners and admins can manage membership.", code: "project_admin_required" });
    return;
  }
  if (result === "owner_required") {
    res.status(403).json({ error: "Only project owners can grant the admin role.", code: "project_owner_required" });
    return;
  }
  if (result === "owner_protected") {
    res.status(409).json({ error: "Project ownership must be transferred before changing the owner role.", code: "project_owner_transfer_required" });
    return;
  }
  await recordProjectAuditEvent({
    id: randomUUID(), projectId: res.locals.studioProjectId, actorSubject: actor.subject, action: "project.membership.granted",
    resourceType: "membership", resourceId: parsed.data.subject, requestId: String(req.id),
    metadata: { role: parsed.data.role }, outcome: "succeeded",
  });
  res.status(201).json({ projectId: res.locals.studioProjectId, subject: parsed.data.subject, role: parsed.data.role });
});

router.delete("/projects/:projectId/memberships/:subject", authorizeProjectRequest, async (req, res) => {
  const actor = res.locals.studioActor as { subject: string };
  const subject = typeof req.params.subject === "string" ? req.params.subject : "";
  if (!subject) {
    res.status(400).json({ error: "A valid member subject is required." });
    return;
  }
  const result = await manageProjectMembership(res.locals.studioProjectId, actor.subject, subject, null);
  if (result === "actor_forbidden") {
    res.status(403).json({ error: "Only project owners and admins can manage membership.", code: "project_admin_required" });
    return;
  }
  if (result === "target_not_found") {
    res.status(404).json({ error: "Project membership not found.", code: "membership_not_found" });
    return;
  }
  if (result === "owner_protected" || result === "owner_required") {
    if (result === "owner_required") {
      res.status(403).json({ error: "Admins cannot remove other admins.", code: "project_owner_required" });
      return;
    }
    res.status(409).json({ error: "Project ownership must be transferred before an owner can leave.", code: "project_owner_transfer_required" });
    return;
  }
  await recordProjectAuditEvent({
    id: randomUUID(), projectId: res.locals.studioProjectId, actorSubject: actor.subject, action: "project.membership.revoked",
    resourceType: "membership", resourceId: subject, requestId: String(req.id), metadata: {}, outcome: "succeeded",
  });
  res.status(204).end();
});

export default router;
