/* Hael Studio — Luminous Codex Workspace. This page keeps semantic intent, live preview, simulation, and accountable agents in one warm, dimensional canvas. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Eye,
  ArrowUpRight,
  FileCode2,
  FolderTree,
  GitPullRequest,
  Bug,
  Puzzle,
  PanelBottom,
  Cloud,
  Braces,
  SearchCheck,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  Command,
  Compass,
  Cpu,
  Database,
  GitBranch,
  GitCommitHorizontal,
  Globe2,
  Hammer,
  History,
  Layers3,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Network,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Gauge,
  Radio,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  SunMedium,
  TerminalSquare,
  TestTube2,
  UserRound,
  UsersRound,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeNav } from "@/components/ModeNav";
import { StudioShell } from "@/components/StudioShell";
import "../hael-responsive.css";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const markUrl = "/manus-storage/hael-studio-mark_792fa113.png";
const canvasArt = "/manus-storage/hael-studio-canvas-art_368e3674.jpg";

type Mode = "compose" | "preview" | "simulate" | "inspect";
type CanvasLayout = "focus" | "relationship";
type CanvasLayer = "metadata" | "connectors" | "runtime";
type LayerVisibility = Record<CanvasLayer, boolean>;

type EffectKind = "frame" | "audio" | "animation" | "lifecycle" | "interaction";
type EffectEvent = { id: string; time: number; kind: EffectKind; label: string; detail: string; tone: "gold" | "green" | "mist" | "ember"; trigger?: string };
type TimelineSnapshot = { id: string; name: string; createdAt: string; effectTime: number; effectSpeed: number; effectIntensity: number; artifactType: "application" | "video" | "music"; previewStage: "icon" | "entry" | "running" | "media" | "exit"; mediaTime: number; runtimeTime: number; layers: LayerVisibility };
type LayerDiff = "same" | "enabled" | "hidden";

const effectTimeline: EffectEvent[] = [
  { id: "frame-01", time: 0, kind: "lifecycle", label: "Application enters", detail: "Identity mark resolves and the entry surface becomes available.", tone: "gold", trigger: "app.start" },
  { id: "audio-01", time: 2, kind: "audio", label: "Welcome tone", detail: "A short sonic signature plays on the first threshold.", tone: "green", trigger: "audio.welcome" },
  { id: "frame-02", time: 4, kind: "frame", label: "Hero frame rendered", detail: "The first authored composition settles into the viewport.", tone: "mist", trigger: "frame.hero" },
  { id: "anim-01", time: 6, kind: "animation", label: "Constellation blooms", detail: "Semantic nodes reveal their relationships with a gentle orbit.", tone: "green", trigger: "animation.constellation" },
  { id: "interaction-01", time: 9, kind: "interaction", label: "Visitor speaks", detail: "The live communication bridge receives a spoken turn.", tone: "ember", trigger: "interaction.voice" },
  { id: "audio-02", time: 12, kind: "audio", label: "Response texture", detail: "A low ambient bed acknowledges the system response.", tone: "gold", trigger: "audio.response" },
  { id: "frame-03", time: 16, kind: "frame", label: "Media frame ready", detail: "The isolated media surface becomes visible without changing the app shell.", tone: "mist", trigger: "frame.media" },
  { id: "anim-02", time: 20, kind: "animation", label: "Exit transition", detail: "The application releases the scene and returns control cleanly.", tone: "ember", trigger: "animation.exit" },
];

type RuntimeEvent = {
  id: string;
  time: number;
  topic: string;
  label: string;
  detail: string;
  tone: "green" | "gold" | "blue" | "ember";
};

type Scenario = {
  id: string;
  title: string;
  description: string;
  duration: number;
  events: RuntimeEvent[];
};

type Node = {
  id: string;
  label: string;
  detail: string;
  x: string;
  y: string;
  tone: "gold" | "green" | "mist" | "ember";
  icon: typeof Sparkles;
};

const scenarios: Scenario[] = [
  { id: "multilingual", title: "Multilingual first visit", description: "A spoken welcome moves through presence, language, and agent listening.", duration: 18, events: [
    { id: "presence", time: 2, topic: "lizwi.presence.detected", label: "Presence detected", detail: "A visitor enters the living archive.", tone: "green" },
    { id: "language", time: 6, topic: "lizwi.language.xh", label: "Language: isiXhosa", detail: "The experience adapts its vocabulary.", tone: "gold" },
    { id: "turn", time: 11, topic: "conversation.turn.complete", label: "Agent listening", detail: "The semantic guide is ready to respond.", tone: "blue" },
    { id: "threshold", time: 16, topic: "experience.threshold.opened", label: "Threshold opened", detail: "The archive reveals its first path.", tone: "ember" },
  ] },
  { id: "research", title: "Citation verification", description: "Research evidence flows through validation, provenance, and release readiness.", duration: 22, events: [
    { id: "source", time: 3, topic: "research.source.opened", label: "Source opened", detail: "A primary record enters the workspace.", tone: "blue" },
    { id: "citation", time: 9, topic: "citation.verified", label: "Citation verified", detail: "The source resolves against its identity.", tone: "green" },
    { id: "manifest", time: 15, topic: "manifest.verified", label: "Manifest signed", detail: "The evidence bundle is reproducible.", tone: "gold" },
    { id: "review", time: 20, topic: "review.circle.ready", label: "Review circle ready", detail: "A human decision can now be requested.", tone: "ember" },
  ] },
  { id: "offline", title: "Low-connectivity recovery", description: "The workspace keeps meaning visible when the network becomes uncertain.", duration: 16, events: [
    { id: "signal", time: 2, topic: "network.signal.degraded", label: "Signal degraded", detail: "The runtime moves to local-first mode.", tone: "ember" },
    { id: "cache", time: 6, topic: "memory.cache.restored", label: "Memory restored", detail: "The last trusted state returns.", tone: "gold" },
    { id: "queue", time: 10, topic: "event.queue.replayed", label: "Events replayed", detail: "Deferred events rejoin the flow.", tone: "green" },
    { id: "sync", time: 14, topic: "workspace.sync.ready", label: "Sync ready", detail: "The user can choose when to reconnect.", tone: "blue" },
  ] },
];

const nodes: Node[] = [
  { id: "intention", label: "Human intention", detail: "Bring research into a living, shared experience.", x: "38%", y: "24%", tone: "gold", icon: Sparkles },
  { id: "orren", label: "Orren semantic layer", detail: "9 dimensions held in one realizable graph.", x: "65%", y: "18%", tone: "green", icon: Network },
  { id: "manya", label: "Manya event flow", detail: "Events connect tools, identities, and agents.", x: "72%", y: "55%", tone: "mist", icon: Radio },
  { id: "lizwi", label: "Lizwi presence", detail: "Voice, language, gesture, and turn-taking.", x: "32%", y: "65%", tone: "ember", icon: MessageCircle },
  { id: "release", label: "Staging realization", detail: "Preview is ready for a human review circle.", x: "55%", y: "80%", tone: "gold", icon: Globe2 },
];

const modeMeta: Record<Mode, { label: string; caption: string; icon: typeof Sparkles }> = {
  compose: { label: "Compose", caption: "Shape the intention and its living relationships.", icon: WandSparkles },
  preview: { label: "Preview", caption: "Experience the current realization before it becomes real.", icon: Globe2 },
  simulate: { label: "Simulate", caption: "Replay the system under a chosen scenario.", icon: Play },
  inspect: { label: "Inspect", caption: "Trace meaning, implementation, evidence, and change.", icon: Code2 },
};

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "gold" | "ember" }) {
  return <span className={cn("status-pill", `status-${tone}`)}>{children}</span>;
}

function Avatar({ initials, tone }: { initials: string; tone: "gold" | "green" | "blue" }) {
  return <span className={cn("avatar", `avatar-${tone}`)}>{initials}</span>;
}

function NodeCard({ node, selected, showDetails, onSelect }: { node: Node; selected: boolean; showDetails: boolean; onSelect: () => void }) {
  const Icon = node.icon;
  return (
    <button
      onClick={onSelect}
      className={cn("node-card", `node-${node.tone}`, `node-anchor-${node.id}`, selected && "node-selected", showDetails && "node-expanded")}
    >
      <span className="node-icon"><Icon size={16} strokeWidth={1.8} /></span>
      <span className="node-copy"><strong>{node.label}</strong><small>{node.detail}</small></span>
      <span className="node-dot" />
    </button>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("compose");
  const [selected, setSelected] = useState("intention");
  const [loomOpen, setLoomOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [activeTool, setActiveTool] = useState("canvas");
  const [layoutMode, setLayoutMode] = useState<"canvas" | "split">(() => (localStorage.getItem("hael-layout") as "canvas" | "split") || "canvas");
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout>(() => (localStorage.getItem("hael-canvas-layout") as CanvasLayout) || "relationship");
  const [canvasDetails, setCanvasDetails] = useState(() => localStorage.getItem("hael-canvas-details") === "1");
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(() => { try { return { metadata: true, connectors: true, runtime: true, ...JSON.parse(localStorage.getItem("hael-canvas-layers") || "{}") }; } catch { return { metadata: true, connectors: true, runtime: true }; } });
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => Number(localStorage.getItem("hael-left-width")) || 250);
  const [rightPanelWidth, setRightPanelWidth] = useState(() => Number(localStorage.getItem("hael-right-width")) || 310);
  function chooseCanvasLayout(next: CanvasLayout) { setCanvasLayout(next); localStorage.setItem("hael-canvas-layout", next); }
  function toggleCanvasDetails() { setCanvasDetails((visible) => { const next = !visible; localStorage.setItem("hael-canvas-details", next ? "1" : "0"); return next; }); }
  function toggleLayer(layer: CanvasLayer) { setLayerVisibility((current) => { const next = { ...current, [layer]: !current[layer] }; localStorage.setItem("hael-canvas-layers", JSON.stringify(next)); return next; }); }
  const [mikeOpen, setMikeOpen] = useState(false);
  const [mikeMessage, setMikeMessage] = useState("");
  const [miked, setMiked] = useState(false);
  const [mikeTarget, setMikeTarget] = useState<"orren" | "terminal" | "room">("orren");
  const [mikeStatus, setMikeStatus] = useState<"ready" | "staged" | "approved">("ready");
  const [previewStage, setPreviewStage] = useState<"icon" | "entry" | "running" | "media" | "exit">("entry");
  const [artifactType, setArtifactType] = useState<"application" | "video" | "music">("application");
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [mediaTime, setMediaTime] = useState(24);
  const [mediaVolume, setMediaVolume] = useState(72);
  const [mediaMuted, setMediaMuted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [effectIntensity, setEffectIntensity] = useState(72);
  const [mediaEventLog, setMediaEventLog] = useState<string[]>([]);
  const [effectTime, setEffectTime] = useState(6);
  const [effectPlaying, setEffectPlaying] = useState(false);
  const [effectSpeed, setEffectSpeed] = useState(1);
  const [selectedEffectId, setSelectedEffectId] = useState("anim-01");
  const [effectReplayCount, setEffectReplayCount] = useState(0);
  const [timelineSnapshots, setTimelineSnapshots] = useState<TimelineSnapshot[]>([
    { id: "snapshot-welcome", name: "Welcoming threshold", createdAt: "09:42", effectTime: 6, effectSpeed: 1, effectIntensity: 72, artifactType: "application", previewStage: "entry", mediaTime: 24, runtimeTime: 7, layers: { metadata: true, connectors: true, runtime: true } },
    { id: "snapshot-media", name: "Media handoff", createdAt: "09:47", effectTime: 16, effectSpeed: 1, effectIntensity: 58, artifactType: "video", previewStage: "media", mediaTime: 62, runtimeTime: 16, layers: { metadata: true, connectors: false, runtime: true } },
  ]);
  const [snapshotName, setSnapshotName] = useState("");
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [compareAgainstSnapshotId, setCompareAgainstSnapshotId] = useState("snapshot-media");
  const [comparisonTransition, setComparisonTransition] = useState(false);
  const [comparisonProgress, setComparisonProgress] = useState(0);
  const [comparisonMode, setComparisonMode] = useState<"standard" | "cinematic">("standard");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOscillatorRef = useRef<OscillatorNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scenarioId, setScenarioId] = useState("multilingual");
  const [scenarioTime, setScenarioTime] = useState(0);
  const [scenarioPlaying, setScenarioPlaying] = useState(false);
  const [manualEvent, setManualEvent] = useState("");
  const [canvasRuntime, setCanvasRuntime] = useState("ready");
  const [inspectTab, setInspectTab] = useState("code");
  const [selectedFile, setSelectedFile] = useState("app.orn");
  const [codeQuery, setCodeQuery] = useState("");
  const [splitView, setSplitView] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [runtimeOpen, setRuntimeOpen] = useState(true);
  const [canvasScale, setCanvasScale] = useState(1);
  const [activeMode, setActiveMode] = useState(modeMeta.compose);
  const [beginResize, setBeginResize] = useState<((side: "left" | "right") => void) | null>(null);

  /* Existing component logic and render body continue unchanged below. */
  // ...
