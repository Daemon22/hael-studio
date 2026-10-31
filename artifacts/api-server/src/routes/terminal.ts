import { randomUUID } from "node:crypto";
import { raw, Router, type IRouter } from "express";
import { z } from "zod";
import { authorizeProjectRequest } from "../lib/projectAccess";
import { executeTerminalCommand, parseTerminalCommand, readTerminalSnapshot, saveTerminalArchive, TerminalCommandError } from "../lib/projectTerminal";
import { recordProjectAuditEvent } from "../lib/workspaceRepository";

const router: IRouter = Router({ mergeParams: true });
router.use(authorizeProjectRequest);

router.get("/terminal", async (req, res) => {
  try {
    const snapshot = await readTerminalSnapshot(res.locals.studioProjectId as string, String(req.query.cwd ?? ""));
    res.json(snapshot);
  } catch (error) {
    if (error instanceof TerminalCommandError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

router.post("/terminal/command", async (req, res) => {
  const parsedBody = z.object({ input: z.string().trim().min(1).max(500), cwd: z.string().max(1000).optional(), confirm: z.boolean().optional() }).strict().safeParse(req.body);
  if (!parsedBody.success) { res.status(400).json({ error: "Enter a command up to 500 characters." }); return; }
  try {
    const command = parseTerminalCommand(parsedBody.data.input);
    const modifiesFiles = command.action === "unzip" || command.action === "clone";
    if (modifiesFiles && !parsedBody.data.confirm) {
      res.json({ status: "confirmation_required", command, preview: command.action === "unzip"
        ? `Extract “${command.path}” into the current project folder. Existing files will not be overwritten.`
        : `Clone ${command.repository} into a new folder in this project.` });
      return;
    }
    const result = await executeTerminalCommand(res.locals.studioProjectId as string, parsedBody.data.cwd ?? "", command);
    if (modifiesFiles) {
      const actor = res.locals.studioActor as { subject: string };
      await recordProjectAuditEvent({ id: randomUUID(), projectId: res.locals.studioProjectId as string, actorSubject: actor.subject,
        action: command.action === "unzip" ? "terminal.archive.extracted" : "terminal.repository.cloned",
        resourceType: "project_workspace", resourceId: command.action === "unzip" ? command.path : command.repository,
        requestId: String(req.id), metadata: { cwd: result.cwd }, outcome: "succeeded" });
    }
    res.json({ status: "completed", command, ...result });
  } catch (error) {
    if (error instanceof TerminalCommandError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

router.put("/terminal/archive", raw({ type: "application/octet-stream", limit: "64mb" }), async (req, res) => {
  const parsed = z.object({ cwd: z.string().max(1000).optional(), name: z.string().trim().min(1).max(180) }).strict().safeParse({ cwd: req.query.cwd ?? "", name: req.query.name ?? "" });
  if (!parsed.success || !Buffer.isBuffer(req.body)) { res.status(400).json({ error: "Choose a ZIP archive to add to this project." }); return; }
  try {
    const result = await saveTerminalArchive(res.locals.studioProjectId as string, parsed.data.cwd ?? "", parsed.data.name, req.body);
    const actor = res.locals.studioActor as { subject: string };
    await recordProjectAuditEvent({ id: randomUUID(), projectId: res.locals.studioProjectId as string, actorSubject: actor.subject,
      action: "terminal.archive.uploaded", resourceType: "project_workspace_file", resourceId: result.name,
      requestId: String(req.id), metadata: { cwd: result.cwd, size: result.size }, outcome: "succeeded" });
    res.status(201).json({ status: "completed", ...result });
  } catch (error) {
    if (error instanceof TerminalCommandError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

export default router;
