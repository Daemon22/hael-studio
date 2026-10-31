import type { RequestHandler } from "express";
import { initialWorkspace } from "./workspaceSeed";
import { getProjectRole } from "./workspaceRepository";

const roleRank = { viewer: 1, editor: 2, admin: 3, owner: 4 } as const;
type StudioRole = keyof typeof roleRank;

export const authorizeProjectRequest: RequestHandler = async (req, res, next) => {
  const actor = res.locals.studioActor as { subject?: unknown } | undefined;
  const projectId = typeof req.params.projectId === "string"
    ? req.params.projectId
    : req.header("x-studio-project-id") ?? initialWorkspace.id;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId)) {
    res.status(400).json({ error: "Project ID is invalid.", code: "invalid_project_id" });
    return;
  }
  if (typeof actor?.subject !== "string") {
    res.status(401).json({ error: "Sign in to continue.", code: "authentication_required" });
    return;
  }
  const requiredRole: StudioRole = req.method === "GET" || req.method === "HEAD" ? "viewer" : "editor";
  try {
    const role = await getProjectRole(projectId, actor.subject);
    if (!role) {
      res.status(404).json({ error: "Project not found or you do not have access.", code: "project_not_found" });
      return;
    }
    if (roleRank[role] < roleRank[requiredRole]) {
      res.status(403).json({ error: "Your project role does not allow this action.", code: "project_role_required" });
      return;
    }
    res.locals.studioProjectId = projectId;
    res.locals.studioProjectRole = role;
    next();
  } catch (error) {
    next(error);
  }
};
