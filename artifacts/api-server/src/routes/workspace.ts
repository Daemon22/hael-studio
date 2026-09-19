import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateReviewRequestBody,
  CreateReviewRequestResponse,
  CreateWorkspaceMessageBody,
  CreateWorkspaceMessageResponse,
  GetWorkspaceResponse,
} from "@workspace/api-zod";
import type { WorkspaceSnapshot } from "@workspace/api-zod";

const router: IRouter = Router();

const workspace: WorkspaceSnapshot = {
  id: "gqobonco-lineage",
  name: "Gqobonco / Lineage",
  subtitle: "The intelligence workspace",
  branch: "main",
  refinement: 8,
  status: "flowing" as const,
  spaces: [
    { id: "intention", label: "Design intention", detail: "Last touched 4m ago", count: 5, tone: "gold" as const, status: "active" as const },
    { id: "system", label: "System architecture", detail: "2 open questions", count: 8, tone: "green" as const, status: "waiting" as const },
    { id: "agents", label: "Agent council", detail: "1 waiting for you", count: 1, tone: "blue" as const, status: "waiting" as const },
    { id: "responsibility", label: "Responsibility", detail: "All checks passing", count: 2, tone: "ember" as const, status: "healthy" as const },
  ],
  nodes: [
    { id: "intention", label: "Human intention", detail: "Bring research into a living, shared experience.", tone: "gold" as const, feature: "intention" },
    { id: "orren", label: "Orren semantic layer", detail: "9 dimensions held in one realizable graph.", tone: "green" as const, feature: "semantic" },
    { id: "manya", label: "Manya event flow", detail: "Events connect tools, identities, and agents.", tone: "mist" as const, feature: "events" },
    { id: "lizwi", label: "Lizwi presence", detail: "Voice, language, gesture, and turn-taking.", tone: "ember" as const, feature: "presence" },
    { id: "release", label: "Staging realization", detail: "Preview is ready for a human review circle.", tone: "gold" as const, feature: "release" },
  ],
  participants: [
    { id: "amara", initials: "AM", name: "Amara Mensah", role: "Builder", tone: "gold" as const },
    { id: "orren", initials: "O", name: "Orren", role: "Semantic guide", tone: "green" as const },
    { id: "reviewer", initials: "R", name: "Reviewer", role: "Responsibility", tone: "blue" as const },
  ],
  messages: [
    { id: "msg-1", author: "Amara Mensah", role: "human" as const, body: "Let’s make the first visit feel like an invitation, not an onboarding form.", timeLabel: "09:41", tone: "human" as const, linkedNodeId: "intention" },
    { id: "msg-2", author: "Orren / semantic guide", role: "agent" as const, body: "I’ve reframed the opening as a welcoming threshold. Three realizations are ready to compare without changing the source.", timeLabel: "09:42", tone: "agent" as const, linkedNodeId: "orren" },
    { id: "msg-3", author: "Reviewer / responsibility", role: "reviewer" as const, body: "2 checks passed. No new permissions or sensitive data paths detected.", timeLabel: "09:43", tone: "soft" as const, linkedNodeId: "responsibility" },
  ],
  capabilities: [
    { id: "workspace", label: "Responsive studio shell", state: "live" as const },
    { id: "runtime", label: "Runtime lifecycle", state: "simulated" as const },
    { id: "github", label: "Source control", state: "connected" as const },
    { id: "persistence", label: "Shared persistence", state: "planned" as const },
  ],
};

router.get("/workspace", (req, res) => {
  req.log.info({ workspaceId: workspace.id }, "Workspace snapshot requested");
  res.json(GetWorkspaceResponse.parse(workspace));
});

router.post("/workspace/messages", (req, res) => {
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
  workspace.messages.push(message);
  req.log.info({ workspaceId: workspace.id, target: parsed.data.target }, "Workspace message created");
  res.status(201).json(message);
});

router.post("/workspace/reviews", (req, res) => {
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
  workspace.status = "review";
  req.log.info({ workspaceId: workspace.id, branch: parsed.data.branch }, "Review request queued");
  res.status(201).json(review);
});

export default router;