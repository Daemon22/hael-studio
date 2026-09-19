/* Hael Studio's living manifest: refinements continue; checkpoints are snapshots. */
export type LifecycleState = "icon" | "launching" | "entry" | "running" | "media" | "exiting" | "exited";
export type EffectKind = "frame" | "audio" | "animation" | "lifecycle" | "interaction";
export type EffectTone = "gold" | "green" | "mist" | "ember";
export type RuntimeTone = "green" | "gold" | "blue" | "ember";
export type CapabilityState = "live" | "simulated" | "connected" | "planned";
export type EffectEvent = { id: string; time: number; kind: EffectKind; label: string; detail: string; tone: EffectTone; trigger?: string };
export type RuntimeEvent = { id: string; time: number; topic: string; label: string; detail: string; tone: RuntimeTone };
export type Scenario = { id: string; title: string; description: string; duration: number; events: RuntimeEvent[] };
export type Capability = { id: string; label: string; state: CapabilityState; detail: string };
export type SemanticNode = { id: string; label: string; detail: string; x: string; y: string; tone: EffectTone; icon: "sparkles" | "network" | "radio" | "message" | "globe"; capability: CapabilityState };
export type ArtifactManifest = { id: string; name: string; refinement: number; identity: { iconGlyph: string; tagline: string; appearance: string }; shell: { entryTitle: string; navItems: string[] }; startup: EffectEvent[]; shutdown: EffectEvent[]; effects: EffectEvent[]; media: { types: ("application" | "video" | "music")[] }; graph: SemanticNode[]; scenarios: Scenario[]; capabilities: Capability[] };
export type Checkpoint = { id: string; name: string; createdAt: string; refinement: number; manifest: ArtifactManifest };

export function checkpoint(name: string, manifest: ArtifactManifest): Checkpoint {
  return { id: `checkpoint-${Date.now()}`, name, createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), refinement: manifest.refinement, manifest };
}

const effects: EffectEvent[] = [
  { id: "frame-01", time: 0, kind: "lifecycle", label: "Application enters", detail: "Identity mark resolves and the entry surface becomes available.", tone: "gold", trigger: "app.start" },
  { id: "audio-01", time: 2, kind: "audio", label: "Welcome tone", detail: "A short sonic signature plays on the first threshold.", tone: "green", trigger: "audio.welcome" },
  { id: "frame-02", time: 4, kind: "frame", label: "Hero frame rendered", detail: "The first authored composition settles into the viewport.", tone: "mist", trigger: "frame.hero" },
  { id: "anim-01", time: 6, kind: "animation", label: "Constellation blooms", detail: "Semantic nodes reveal their relationships with a gentle orbit.", tone: "green", trigger: "animation.constellation" },
  { id: "interaction-01", time: 9, kind: "interaction", label: "Visitor speaks", detail: "The live communication bridge receives a spoken turn.", tone: "ember", trigger: "interaction.voice" },
  { id: "audio-02", time: 12, kind: "audio", label: "Response texture", detail: "A low ambient bed acknowledges the system response.", tone: "gold", trigger: "audio.response" },
  { id: "frame-03", time: 16, kind: "frame", label: "Media frame ready", detail: "The isolated media surface becomes visible without changing the app shell.", tone: "mist", trigger: "frame.media" },
  { id: "anim-02", time: 20, kind: "animation", label: "Exit transition", detail: "The application releases the scene and returns control cleanly.", tone: "ember", trigger: "animation.exit" },
];

export const defaultManifest: ArtifactManifest = {
  id: "gqobonco-lineage", name: "Gqobonco / Lineage", refinement: 84,
  identity: { iconGlyph: "◇", tagline: "A living research archive", appearance: "Identity mark resting among other applications" },
  shell: { entryTitle: "Knowledge does not disappear. It changes hands.", navItems: ["Dashboard", "Projects", "Identity", "Resources", "Settings"] },
  effects, startup: effects.slice(0, 4), shutdown: [effects[7]], media: { types: ["application", "video", "music"] },
  graph: [
    { id: "intention", label: "Human intention", detail: "Bring research into a living, shared experience.", x: "38%", y: "24%", tone: "gold", icon: "sparkles", capability: "live" },
    { id: "orren", label: "Orren semantic layer", detail: "9 dimensions held in one realizable graph.", x: "65%", y: "18%", tone: "green", icon: "network", capability: "live" },
    { id: "manya", label: "Manya event flow", detail: "Events connect tools, identities, and agents.", x: "72%", y: "55%", tone: "mist", icon: "radio", capability: "simulated" },
    { id: "lizwi", label: "Lizwi presence", detail: "Voice, language, gesture, and turn-taking.", x: "32%", y: "65%", tone: "ember", icon: "message", capability: "simulated" },
    { id: "release", label: "Staging realization", detail: "The realization awaits a human review circle.", x: "55%", y: "80%", tone: "gold", icon: "globe", capability: "planned" },
  ],
  scenarios: [
    { id: "multilingual", title: "Multilingual first visit", description: "A spoken welcome moves through presence, language, and agent listening.", duration: 18, events: [{ id: "presence", time: 2, topic: "lizwi.presence.detected", label: "Presence detected", detail: "A visitor enters the living archive.", tone: "green" }, { id: "language", time: 6, topic: "lizwi.language.xh", label: "Language: isiXhosa", detail: "The experience adapts its vocabulary.", tone: "gold" }, { id: "turn", time: 11, topic: "conversation.turn.complete", label: "Agent listening", detail: "The semantic guide is ready to respond.", tone: "blue" }, { id: "threshold", time: 16, topic: "experience.threshold.opened", label: "Threshold opened", detail: "The archive reveals its first path.", tone: "ember" }] },
    { id: "research", title: "Citation verification", description: "Research evidence flows through validation, provenance, and release readiness.", duration: 22, events: [{ id: "source", time: 3, topic: "research.source.opened", label: "Source opened", detail: "A primary record enters the workspace.", tone: "blue" }, { id: "citation", time: 9, topic: "citation.verified", label: "Citation verified", detail: "The source resolves against its identity.", tone: "green" }, { id: "manifest", time: 15, topic: "manifest.verified", label: "Manifest signed", detail: "The evidence bundle is reproducible.", tone: "gold" }, { id: "review", time: 20, topic: "review.circle.ready", label: "Review circle ready", detail: "A human decision can now be requested.", tone: "ember" }] },
    { id: "offline", title: "Low-connectivity recovery", description: "The workspace keeps meaning visible when the network becomes uncertain.", duration: 16, events: [{ id: "signal", time: 2, topic: "network.signal.degraded", label: "Signal degraded", detail: "The runtime moves to local-first mode.", tone: "ember" }, { id: "cache", time: 6, topic: "memory.cache.restored", label: "Memory restored", detail: "The last trusted state returns.", tone: "gold" }, { id: "queue", time: 10, topic: "event.queue.replayed", label: "Events replayed", detail: "Deferred events rejoin the flow.", tone: "green" }, { id: "sync", time: 14, topic: "workspace.sync.ready", label: "Sync ready", detail: "The user can choose when to reconnect.", tone: "blue" }] },
  ],
  capabilities: [
    { id: "canvas", label: "Canvas", state: "live", detail: "Semantic graph renders from the manifest." }, { id: "runtime", label: "Runtime", state: "simulated", detail: "Lifecycle is an instrumented model, not a real process." }, { id: "media", label: "Media", state: "simulated", detail: "Audio/video are stubbed probes." }, { id: "agents", label: "Agents", state: "connected", detail: "Mike bridges to Orren; agents answer through it." }, { id: "deployment", label: "Deployment", state: "planned", detail: "Windows/Android shells inherit the manifest later." },
  ],
};
