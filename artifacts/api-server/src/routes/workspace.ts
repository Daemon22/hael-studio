import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateReviewRequestBody,
  CreateReviewRequestResponse,
  CreateWorkspaceMessageBody,
  CreateWorkspaceMessageResponse,
  GetWorkspaceResponse,
  GetWorkspaceRuntimeStateResponse,
  SaveWorkspaceRuntimeStateBody,
  SaveWorkspaceRuntimeStateResponse,
} from "@workspace/api-zod";
import {
  readStudioRuntimeState,
  readWorkspace,
  RuntimeStateConflictError,
  saveReviewRequest,
  saveStudioRuntimeState,
  saveWorkspaceMessage,
} from "../lib/workspaceRepository";
import { initialWorkspace } from "../lib/workspaceSeed";

const router: IRouter = Router();
const workspaceId = initialWorkspace.id;

router.get("/workspace", async (req, res) => {
  const workspace = await readWorkspace();
  req.log.info({ workspaceId: workspace.id }, "Workspace snapshot requested");
  res.json(GetWorkspaceResponse.parse(workspace));
});

router.get("/workspace/runtime-state", async (_req, res) => {
  const state = await readStudioRuntimeState();
  if (!state) {
    res.status(404).json({ error: "No runtime state has been saved yet." });
    return;
  }
  res.json(GetWorkspaceRuntimeStateResponse.parse(state));
});

router.put("/workspace/runtime-state", async (req, res) => {
  const parsed = SaveWorkspaceRuntimeStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Runtime state is invalid." });
    return;
  }

  try {
    const saved = await saveStudioRuntimeState(
      parsed.data.expectedRevision,
      parsed.data.state,
    );
    res.json(SaveWorkspaceRuntimeStateResponse.parse(saved));
  } catch (error) {
    if (error instanceof RuntimeStateConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post("/workspace/messages", async (req, res) => {
  const parsed = CreateWorkspaceMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message body is invalid." });
    return;
  }

  const message = CreateWorkspaceMessageResponse.parse({
    id: randomUUID(),
    author: "You",
    role: "human",
    body: parsed.data.body,
    timeLabel: "now",
    tone: "human",
    linkedNodeId: parsed.data.target === "orren" ? "orren" : null,
  });
  await saveWorkspaceMessage(message);
  req.log.info({ workspaceId, target: parsed.data.target }, "Workspace message created");
  res.status(201).json(message);
});

router.post("/workspace/reviews", async (req, res) => {
  const parsed = CreateReviewRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Review request is invalid." });
    return;
  }

  const review = CreateReviewRequestResponse.parse({
    id: randomUUID(),
    status: "queued",
    title: parsed.data.title,
    branch: parsed.data.branch,
    createdAt: new Date().toISOString(),
  });
  await saveReviewRequest(review);
  req.log.info({ workspaceId, branch: parsed.data.branch }, "Review request queued");
  res.status(201).json(review);
});

export default router;
