import type { WorkspaceSnapshot } from "@workspace/api-zod";

export const initialWorkspace: WorkspaceSnapshot = {
  id: "gqobonco-lineage",
  name: "Gqobonco / Lineage",
  subtitle: "The intelligence workspace",
  branch: "main",
  refinement: 8,
  status: "flowing",
  spaces: [
    { id: "intention", label: "Design intention", detail: "Last touched 4m ago", count: 5, tone: "gold", status: "active" },
    { id: "system", label: "System architecture", detail: "2 open questions", count: 8, tone: "green", status: "waiting" },
    { id: "agents", label: "Agent council", detail: "1 waiting for you", count: 1, tone: "blue", status: "waiting" },
    { id: "responsibility", label: "Responsibility", detail: "All checks passing", count: 2, tone: "ember", status: "healthy" },
  ],
  nodes: [
    { id: "intention", label: "Human intention", detail: "Bring research into a living, shared experience.", tone: "gold", feature: "intention" },
    { id: "orren", label: "Orren semantic layer", detail: "9 dimensions held in one realizable graph.", tone: "green", feature: "semantic" },
    { id: "manya", label: "Manya event flow", detail: "Events connect tools, identities, and agents.", tone: "mist", feature: "events" },
    { id: "lizwi", label: "Lizwi presence", detail: "Voice, language, gesture, and turn-taking.", tone: "ember", feature: "presence" },
    { id: "release", label: "Staging realization", detail: "Preview is ready for a human review circle.", tone: "gold", feature: "release" },
  ],
  participants: [
    { id: "amara", initials: "AM", name: "Amara Mensah", role: "Builder", tone: "gold" },
    { id: "orren", initials: "O", name: "Orren", role: "Semantic guide", tone: "green" },
    { id: "reviewer", initials: "R", name: "Reviewer", role: "Responsibility", tone: "blue" },
  ],
  messages: [
    { id: "msg-1", author: "Amara Mensah", role: "human", body: "Let’s make the first visit feel like an invitation, not an onboarding form.", timeLabel: "09:41", tone: "human", linkedNodeId: "intention" },
    { id: "msg-2", author: "Orren / semantic guide", role: "agent", body: "I’ve reframed the opening as a welcoming threshold. Three realizations are ready to compare without changing the source.", timeLabel: "09:42", tone: "agent", linkedNodeId: "orren" },
    { id: "msg-3", author: "Reviewer / responsibility", role: "reviewer", body: "2 checks passed. No new permissions or sensitive data paths detected.", timeLabel: "09:43", tone: "soft", linkedNodeId: "responsibility" },
  ],
  capabilities: [
    { id: "workspace", label: "Responsive studio shell", state: "live" },
    { id: "runtime", label: "Runtime lifecycle", state: "simulated" },
    { id: "github", label: "Source control", state: "connected" },
    { id: "persistence", label: "Shared persistence", state: "planned" },
  ],
};
