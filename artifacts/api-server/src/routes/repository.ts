import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { GitHubUnavailableError, resolveGitHubCommit, validateGitHubBranch, validateGitHubRepository } from "../lib/githubRepository";
import { authorizeProjectRequest } from "../lib/projectAccess";
import { getProjectRole, getProjectRepository, removeProjectRepository, recordProjectAuditEvent, setProjectRepository } from "../lib/workspaceRepository";

const router: IRouter = Router({ mergeParams: true });
router.use(authorizeProjectRequest);
const RepositoryBody = z.object({
  repository: z.string().trim().min(3).max(201),
  branch: z.string().trim().min(1).max(128),
}).strict();

router.get("/repository", async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const binding = await getProjectRepository(res.locals.studioProjectId);
    if (!binding) { res.json({ connected: false }); return; }
    let head: Awaited<ReturnType<typeof resolveGitHubCommit>>;
    try { head = await resolveGitHubCommit(binding.repository, binding.branch); }
    catch (error) {
      res.status(503).json({ error: error instanceof Error ? error.message : "The repository branch head could not be read.", code: "repository_unavailable" });
      return;
    }
    res.json({ connected: true, ...binding, headCommit: head.sha, commitUrl: head.url });
  } catch (error) { next(error); }
});

router.put("/repository", async (req, res, next) => {
  try {
    const actor = res.locals.studioActor as { subject: string };
    const role = await getProjectRole(res.locals.studioProjectId, actor.subject);
    if (role !== "owner" && role !== "admin") { res.status(403).json({ error: "Only project owners and admins can connect a repository.", code: "project_admin_required" }); return; }
    const parsed = RepositoryBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide a GitHub owner/repository and a valid branch.", code: "invalid_repository_binding" }); return; }
    let repository: string;
    let branch: string;
    try {
      repository = validateGitHubRepository(parsed.data.repository);
      branch = validateGitHubBranch(parsed.data.branch);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Repository binding is invalid.", code: "invalid_repository_binding" });
      return;
    }
    let head: Awaited<ReturnType<typeof resolveGitHubCommit>>;
    try { head = await resolveGitHubCommit(repository, branch); }
    catch (error) {
      const unavailable = error instanceof GitHubUnavailableError;
      res.status(unavailable ? 503 : 422).json({ error: error instanceof Error ? error.message : "The repository branch could not be verified.", code: unavailable ? "github_unavailable" : "repository_unverified" });
      return;
    }
    const binding = { projectId: res.locals.studioProjectId, provider: "github" as const, repository, branch, connectedBy: actor.subject, updatedAt: new Date().toISOString() };
    await setProjectRepository(binding);
    await recordProjectAuditEvent({ id: randomUUID(), projectId: binding.projectId, actorSubject: actor.subject, action: "repository.connected", resourceType: "repository", resourceId: repository, requestId: String(req.id), metadata: { provider: "github", branch, headCommit: head.sha }, outcome: "succeeded" });
    res.status(200).json({ connected: true, ...binding, headCommit: head.sha, commitUrl: head.url });
  } catch (error) { next(error); }
});

router.delete("/repository", async (req, res, next) => {
  try {
    const actor = res.locals.studioActor as { subject: string };
    const role = await getProjectRole(res.locals.studioProjectId, actor.subject);
    if (role !== "owner" && role !== "admin") { res.status(403).json({ error: "Only project owners and admins can disconnect a repository.", code: "project_admin_required" }); return; }
    const binding = await getProjectRepository(res.locals.studioProjectId);
    if (!binding) { res.status(204).end(); return; }
    await removeProjectRepository(binding.projectId);
    await recordProjectAuditEvent({ id: randomUUID(), projectId: binding.projectId, actorSubject: actor.subject, action: "repository.disconnected", resourceType: "repository", resourceId: binding.repository, requestId: String(req.id), metadata: {}, outcome: "succeeded" });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
