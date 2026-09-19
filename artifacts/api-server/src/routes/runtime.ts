import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  InjectRuntimeEventBody,
  InjectRuntimeEventResponse,
  ListRuntimeScenariosResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const scenarios = [
  {
    id: "multilingual",
    title: "Multilingual first visit",
    description: "A spoken welcome moves through presence, language, and agent listening.",
    duration: 18,
    events: [
      { id: "presence", scenarioId: "multilingual", time: 2, topic: "lizwi.presence.detected", label: "Presence detected", detail: "A visitor enters the living archive.", tone: "green" as const },
      { id: "language", scenarioId: "multilingual", time: 6, topic: "lizwi.language.xh", label: "Language: isiXhosa", detail: "The experience adapts its vocabulary.", tone: "gold" as const },
      { id: "turn", scenarioId: "multilingual", time: 11, topic: "conversation.turn.complete", label: "Agent listening", detail: "The semantic guide is ready to respond.", tone: "blue" as const },
      { id: "threshold", scenarioId: "multilingual", time: 16, topic: "experience.threshold.opened", label: "Threshold opened", detail: "The archive reveals its first path.", tone: "ember" as const },
    ],
  },
  {
    id: "research",
    title: "Citation verification",
    description: "Research evidence flows through validation, provenance, and release readiness.",
    duration: 22,
    events: [
      { id: "source", scenarioId: "research", time: 3, topic: "research.source.opened", label: "Source opened", detail: "A primary record enters the workspace.", tone: "blue" as const },
      { id: "citation", scenarioId: "research", time: 9, topic: "citation.verified", label: "Citation verified", detail: "The source resolves against its identity.", tone: "green" as const },
      { id: "manifest", scenarioId: "research", time: 15, topic: "manifest.verified", label: "Manifest signed", detail: "The evidence bundle is reproducible.", tone: "gold" as const },
      { id: "review", scenarioId: "research", time: 20, topic: "review.circle.ready", label: "Review circle ready", detail: "A human decision can now be requested.", tone: "ember" as const },
    ],
  },
  {
    id: "offline",
    title: "Low-connectivity recovery",
    description: "The workspace keeps meaning visible when the network becomes uncertain.",
    duration: 16,
    events: [
      { id: "signal", scenarioId: "offline", time: 2, topic: "network.signal.degraded", label: "Signal degraded", detail: "The runtime moves to local-first mode.", tone: "ember" as const },
      { id: "cache", scenarioId: "offline", time: 6, topic: "memory.cache.restored", label: "Memory restored", detail: "The last trusted state returns.", tone: "gold" as const },
      { id: "queue", scenarioId: "offline", time: 10, topic: "event.queue.replayed", label: "Events replayed", detail: "Deferred events rejoin the flow.", tone: "green" as const },
      { id: "sync", scenarioId: "offline", time: 14, topic: "workspace.sync.ready", label: "Sync ready", detail: "The user can choose when to reconnect.", tone: "blue" as const },
    ],
  },
];

router.get("/runtime/scenarios", (req, res) => {
  req.log.info({ scenarioCount: scenarios.length }, "Runtime scenarios requested");
  res.json(ListRuntimeScenariosResponse.parse(scenarios));
});

router.post("/runtime/events", (req, res) => {
  const parsed = InjectRuntimeEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Runtime event is invalid." });
    return;
  }

  const event = InjectRuntimeEventResponse.parse({
    id: randomUUID(),
    ...parsed.data,
  });
  req.log.info({ scenarioId: event.scenarioId, topic: event.topic }, "Runtime event injected");
  res.status(201).json(event);
});

export { scenarios };
export default router;