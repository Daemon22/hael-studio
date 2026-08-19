/* Hael Studio — Luminous Codex Workspace. This page keeps semantic intent, live preview, simulation, and accountable agents in one warm, dimensional canvas. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const markUrl = "/manus-storage/hael-studio-mark_792fa113.png";
const canvasArt = "/manus-storage/hael-studio-canvas-art_368e3674.jpg";

type Mode = "compose" | "preview" | "simulate" | "inspect";

type EffectKind = "frame" | "audio" | "animation" | "lifecycle" | "interaction";
type EffectEvent = { id: string; time: number; kind: EffectKind; label: string; detail: string; tone: "gold" | "green" | "mist" | "ember"; trigger?: string };
type TimelineSnapshot = { id: string; name: string; createdAt: string; effectTime: number; effectSpeed: number; effectIntensity: number; artifactType: "application" | "video" | "music"; previewStage: "icon" | "entry" | "running" | "media" | "exit"; mediaTime: number; runtimeTime: number };

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

function NodeCard({ node, selected, onSelect }: { node: Node; selected: boolean; onSelect: () => void }) {
  const Icon = node.icon;
  return (
    <button
      onClick={onSelect}
      className={cn("node-card", `node-${node.tone}`, selected && "node-selected")}
      style={{ left: node.x, top: node.y }}
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
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => Number(localStorage.getItem("hael-left-width")) || 250);
  const [rightPanelWidth, setRightPanelWidth] = useState(() => Number(localStorage.getItem("hael-right-width")) || 310);
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
    { id: "snapshot-welcome", name: "Welcoming threshold", createdAt: "09:42", effectTime: 6, effectSpeed: 1, effectIntensity: 72, artifactType: "application", previewStage: "entry", mediaTime: 24, runtimeTime: 7 },
    { id: "snapshot-media", name: "Media handoff", createdAt: "09:47", effectTime: 16, effectSpeed: 1, effectIntensity: 58, artifactType: "video", previewStage: "media", mediaTime: 62, runtimeTime: 16 },
  ]);
  const [snapshotName, setSnapshotName] = useState("");
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOscillatorRef = useRef<OscillatorNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scenarioId, setScenarioId] = useState("multilingual");
  const [runtimeTime, setRuntimeTime] = useState(7);
  const [runtimeSpeed, setRuntimeSpeed] = useState(1);
  const [device, setDevice] = useState("Desktop");
  const [language, setLanguage] = useState("isiXhosa");
  const [persona, setPersona] = useState("Researcher");
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);

  const activeScenario = scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];
  const visibleEvents = activeScenario.events.filter((event) => event.time <= runtimeTime);
  const activeEvent = [...visibleEvents].pop();
  const activeEffect = effectTimeline.reduce<EffectEvent | null>((current, effect) => effect.time <= effectTime ? effect : current, null);
  const selectedEffect = effectTimeline.find((effect) => effect.id === selectedEffectId) ?? effectTimeline[0];
  const selectedNode
 = useMemo(() => nodes.find((node) => node.id === selected) ?? nodes[0], [selected]);
  const activeMode = modeMeta[mode];
  const ModeIcon = activeMode.icon;

  useEffect(() => {
    localStorage.setItem("hael-layout", layoutMode);
    localStorage.setItem("hael-left-width", String(leftPanelWidth));
    localStorage.setItem("hael-right-width", String(rightPanelWidth));
  }, [layoutMode, leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "1") { event.preventDefault(); setActiveTool("code"); setMode("inspect"); }
      if ((event.metaKey || event.ctrlKey) && event.key === "2") { event.preventDefault(); setActiveTool("terminal"); }
      if ((event.metaKey || event.ctrlKey) && event.key === "3") { event.preventDefault(); setActiveTool("source"); }
      if ((event.metaKey || event.ctrlKey) && event.key === "4") { event.preventDefault(); setActiveTool("canvas"); setLayoutMode("split"); }
      if ((event.metaKey || event.ctrlKey) && event.key === "P") { event.preventDefault(); setMode("preview"); setActiveTool("canvas"); }
      if ((event.metaKey || event.ctrlKey) && event.key === "J") { event.preventDefault(); setMikeOpen((current) => !current); }
      if (event.key === "Escape") { setMikeOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setEffectTime(Math.min(20, runtimeTime));
  }, [runtimeTime]);

  useEffect(() => {
    if (!effectPlaying) return;
    const timer = window.setInterval(() => {
      setEffectTime((current) => {
        const next = Math.min(current + effectSpeed, effectTimeline[effectTimeline.length - 1].time);
        const crossed = effectTimeline.find((effect) => effect.time > current && effect.time <= next);
        if (crossed) {
          setSelectedEffectId(crossed.id);
          setMediaEventLog((events) => [crossed.trigger ?? crossed.id, ...events].slice(0, 5));
        }
        if (next >= effectTimeline[effectTimeline.length - 1].time) setEffectPlaying(false);
        return next;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [effectPlaying, effectSpeed]);

  useEffect(() => {
    if (!mediaPlaying) return;
    const timer = window.setInterval(() => setMediaTime((current) => { const next = current >= 100 ? 0 : current + 1; setEffectTime(Math.round((next / 100) * 20)); return next; }), 350);
    return () => window.clearInterval(timer);
  }, [mediaPlaying]);

  useEffect(() => {
    if (!simulationRunning) return;
    const timer = window.setInterval(() => {
      setRuntimeTime((current) => {
        const next = Math.min(current + 1, activeScenario.duration);
        if (next >= activeScenario.duration) setSimulationRunning(false);
        return next;
      });
    }, Math.max(180, 900 / runtimeSpeed));
    return () => window.clearInterval(timer);
  }, [activeScenario.duration, runtimeSpeed, simulationRunning]);

  useEffect(() => {
    const newlyVisible = activeScenario.events.filter((event) => event.time <= runtimeTime && !runtimeEvents.some((existing) => existing.id === event.id));
    if (newlyVisible.length) setRuntimeEvents((current) => [...current, ...newlyVisible]);
  }, [activeScenario.events, runtimeEvents, runtimeTime]);

  function sendMessage() {
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
  }

  function selectScenario(id: string) {
    setScenarioId(id);
    setRuntimeTime(0);
    setSimulationRunning(false);
    setRuntimeEvents([]);
  }

  function resetRuntime() {
    setRuntimeTime(0);
    setSimulationRunning(false);
    setRuntimeEvents([]);
  }

  function injectEvent() {
    const event: RuntimeEvent = { id: `manual-${Date.now()}`, time: runtimeTime, topic: "studio.manual.event", label: "Manual event injected", detail: "A human-authored signal entered the runtime.", tone: "gold" };
    setRuntimeEvents((current) => [...current, event]);
  }

  function replayScenario() {
    setRuntimeTime(0);
    setRuntimeEvents([]);
    setSimulationRunning(true);
    setMode("simulate");
  }

  function beginResize(side: "left" | "right") {
    const startX = window.innerWidth / 2;
    const startValue = side === "left" ? leftPanelWidth : rightPanelWidth;
    const onMove = (event: MouseEvent) => {
      const delta = event.clientX - startX;
      if (side === "left") setLeftPanelWidth(Math.min(390, Math.max(205, startValue + delta)));
      else setRightPanelWidth(Math.min(430, Math.max(260, startValue - delta)));
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function sendMike() {
    if (!mikeMessage.trim()) return;
    setMiked(true);
    setMikeStatus("staged");
    setMikeMessage("");
  }

  function approveMike() {
    setMikeStatus("approved");
    setActiveTool("terminal");
    setMikeOpen(false);
  }

  function captureSnapshot() {
    const name = snapshotName.trim() || `Effect pass ${timelineSnapshots.length + 1}`;
    setTimelineSnapshots((current) => [...current, { id: `snapshot-${Date.now()}`, name, createdAt: "now", effectTime, effectSpeed, effectIntensity, artifactType, previewStage, mediaTime, runtimeTime }]);
    setSnapshotName("");
  }

  function restoreSnapshot(snapshot: TimelineSnapshot) {
    setEffectTime(snapshot.effectTime); setEffectSpeed(snapshot.effectSpeed); setEffectIntensity(snapshot.effectIntensity); setArtifactType(snapshot.artifactType); setPreviewStage(snapshot.previewStage); setMediaTime(snapshot.mediaTime); setRuntimeTime(snapshot.runtimeTime); setCompareSnapshotId(null); setMediaEventLog((events) => [`snapshot.restore.${snapshot.name}`, ...events].slice(0, 5));
  }

  function replayEffects() {
    setEffectTime(0);
    setSelectedEffectId(effectTimeline[0].id);
    setEffectReplayCount((count) => count + 1);
    setEffectPlaying(true);
    setMediaEventLog(["timeline.replay"]);
  }

  function stepEffect(direction: 1 | -1) {
    const index = effectTimeline.findIndex((effect) => effect.id === selectedEffectId);
    const next = effectTimeline[Math.min(effectTimeline.length - 1, Math.max(0, index + direction))];
    setSelectedEffectId(next.id);
    setEffectTime(next.time);
    setMediaEventLog((events) => [`timeline.step.${direction > 0 ? "forward" : "back"}`, ...events].slice(0, 5));
  }

  function effectIcon(kind: EffectKind) {
    return kind === "frame" ? "◇" : kind === "audio" ? "◖" : kind === "animation" ? "✦" : kind === "lifecycle" ? "↗" : "○";
  }

  function renderEffectLane(kind: EffectKind) {
    return <div className="effect-lane" key={kind}><span className="lane-label">{kind}</span><div className="lane-content">{effectTimeline.filter((effect) => effect.kind === kind).map((effect) => <button key={effect.id} className={cn("effect-marker", `effect-${effect.kind}`, `effect-${effect.tone}`, selectedEffectId === effect.id && "selected")} style={{ left: `${(effect.time / 20) * 100}%` }} onClick={() => { setSelectedEffectId(effect.id); setEffectTime(effect.time); }} title={`${effect.label} · ${effect.detail}`}><span>{effectIcon(effect.kind)}</span></button>)}</div></div>;
  }

  function advancePreviewStage() {
    const stages = ["icon", "entry", "running", "media", "exit"] as const;
    const next = stages[(stages.indexOf(previewStage) + 1) % stages.length];
    setPreviewStage(next);
    setMediaEventLog((current) => [`lifecycle.${next}`, ...current].slice(0, 5));
  }

  function toggleSound() {
    if (audioPlaying) {
      audioOscillatorRef.current?.stop();
      audioOscillatorRef.current = null;
      setAudioPlaying(false);
      setMediaEventLog((current) => ["audio.stop", ...current].slice(0, 5));
      return;
    }
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = artifactType === "music" ? 220 : 440;
    gain.gain.value = mediaMuted ? 0 : Math.max(0.02, mediaVolume / 1000);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    audioOscillatorRef.current = oscillator;
    audioGainRef.current = gain;
    setAudioPlaying(true);
    setMediaEventLog((current) => ["audio.start", ...current].slice(0, 5));
  }

  function toggleVideoPlayback() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setMediaPlaying(true);
      setMediaEventLog((current) => ["video.play", ...current].slice(0, 5));
    } else {
      videoRef.current.pause();
      setMediaPlaying(false);
      setMediaEventLog((current) => ["video.pause", ...current].slice(0, 5));
    }
  }

  return (
    <StudioShell>
      <div className="studio-background-art" style={{ backgroundImage: `url(${canvasArt})` }} aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark-wrap"><img src={markUrl} alt="Hael Studio mark" /></div>
          <div><p className="brand-name">HAEL <span>STUDIO</span></p><p className="brand-subtitle">The intelligence workspace</p></div>
        </div>
        <div className="project-switcher"><span className="eyebrow">Project</span><strong>Gqobonco / Lineage</strong><ChevronDown size={14} /></div>
        <div className="topbar-actions">
          <div className="presence"><Avatar initials="AM" tone="gold" /><Avatar initials="SK" tone="green" /><span className="presence-more">+2</span><span className="presence-label">4 present</span></div>
          <Button className="icon-button soft-button" size="icon" aria-label="Search"><Search size={17} /></Button>
          <Button className="icon-button soft-button" size="icon" aria-label="Settings"><Settings2 size={17} /></Button>
          <Button className="release-button"><GitCommitHorizontal size={16} /> Request review <ArrowUpRight size={15} /></Button>
        </div>
      </header>

      <section className="workspace-grid" style={{ gridTemplateColumns: `54px ${leftPanelWidth}px 5px minmax(530px, 1fr) 5px ${rightPanelWidth}px` }}>
        <nav className="workbench-rail" aria-label="IDE workbench">
          <div className="workbench-top">
            <button className={cn("workbench-tool", activeTool === "canvas" && "active")} onClick={() => setActiveTool("canvas")} title="Hael Canvas"><img src={markUrl} alt="" /></button>
            <span className="workbench-rule" />
            <button className={cn("workbench-tool", activeTool === "code" && "active")} onClick={() => { setActiveTool("code"); setMode("inspect"); }} title="Code"><FileCode2 size={18} /></button>
            <button className={cn("workbench-tool", activeTool === "files" && "active")} onClick={() => setActiveTool("files")} title="Explorer"><FolderTree size={18} /></button>
            <button className={cn("workbench-tool", activeTool === "search" && "active")} onClick={() => setActiveTool("search")} title="Search"><SearchCheck size={18} /></button>
            <button className={cn("workbench-tool", activeTool === "source" && "active")} onClick={() => setActiveTool("source")} title="Source Control"><GitPullRequest size={18} /><span className="workbench-badge">3</span></button>
            <button className={cn("workbench-tool", activeTool === "run" && "active")} onClick={() => setActiveTool("run")} title="Run and Debug"><Bug size={18} /></button>
            <button className={cn("workbench-tool", activeTool === "extensions" && "active")} onClick={() => setActiveTool("extensions")} title="Extensions"><Puzzle size={18} /></button>
          </div>
          <div className="workbench-bottom"><button className={cn("workbench-tool", activeTool === "terminal" && "active")} onClick={() => setActiveTool("terminal")} title="Terminal"><PanelBottom size={18} /></button><button className={cn("workbench-tool", activeTool === "deploy" && "active")} onClick={() => setActiveTool("deploy")} title="Deploy"><Cloud size={18} /></button></div>
        </nav>
        <aside className="constellation-rail">
          <div className="rail-heading"><div><span className="eyebrow">Your studio</span><h2>{activeTool === "canvas" ? "Constellation" : activeTool === "source" ? "Source control" : activeTool === "run" ? "Run & Debug" : activeTool === "terminal" ? "Terminal" : activeTool === "files" ? "Explorer" : activeTool === "extensions" ? "Extensions" : activeTool === "deploy" ? "Deploy" : activeTool === "search" ? "Search" : "Code"}</h2></div><Button variant="ghost" size="icon" className="rail-more"><MoreHorizontal size={18} /></Button></div>
          {activeTool !== "canvas" && <div className="ide-tool-drawer">
            {activeTool === "code" && <><div className="drawer-title"><Braces size={14} /> Open editors</div><button className="drawer-file active"><FileCode2 size={14} /><span>app.orn</span><small>edited</small></button><button className="drawer-file"><FileCode2 size={14} /><span>lineage.ts</span></button><button className="drawer-file"><FileCode2 size={14} /><span>preview.css</span></button><div className="drawer-note">Semantic source stays beside its realization. Select a node in the canvas to trace its implementation.</div></>}
            {activeTool === "files" && <><div className="drawer-title"><FolderTree size={14} /> Workspace</div><button className="drawer-file"><span>⌄</span><span>src</span></button><button className="drawer-file indent"><span>⌄</span><span>components</span></button><button className="drawer-file indent-2"><FileCode2 size={14} /><span>LineagePanel.tsx</span></button><button className="drawer-file"><span>⌄</span><span>tests</span></button><button className="drawer-file"><FileCode2 size={14} /><span>package.json</span></button></>}
            {activeTool === "source" && <><div className="drawer-title"><GitPullRequest size={14} /> Changes <StatusPill tone="gold">3</StatusPill></div><div className="change-row"><span className="change-add">M</span><span>app.orn</span><small>+18 −4</small></div><div className="change-row"><span className="change-add">M</span><span>LineagePanel.tsx</span><small>+42 −9</small></div><div className="change-row"><span className="change-add">A</span><span>scenario.test.ts</span><small>+31</small></div><button className="drawer-action"><GitCommitHorizontal size={14} /> Commit & request review</button></>}
            {activeTool === "run" && <><div className="drawer-title"><Bug size={14} /> Runtime targets</div><div className="target-card"><span className="target-dot green" /><span><strong>Local preview</strong><small>http://localhost:3000</small></span><StatusPill tone="green">Live</StatusPill></div><div className="target-card"><span className="target-dot gold" /><span><strong>Scenario runner</strong><small>3 replayable flows</small></span><StatusPill tone="gold">Ready</StatusPill></div><button className="drawer-action" onClick={() => { setMode("simulate"); setActiveTool("canvas"); }}><Play size={14} /> Run scenario</button></>}
            {activeTool === "terminal" && <><div className="drawer-title"><PanelBottom size={14} /> Terminal · zsh</div><div className="terminal-window"><div><span className="terminal-prompt">hael@studio</span> <span className="terminal-path">~/gqobonco</span></div><div><span className="terminal-prompt">$</span> pnpm test:semantic</div><div className="terminal-success">✓ 48 semantic checks passing</div><div><span className="terminal-prompt">$</span> git status</div><div className="terminal-muted">On branch main · 3 changes ready</div></div><button className="drawer-action" onClick={() => setActiveTool("canvas")}><Braces size={14} /> Return to canvas</button></>}
            {activeTool === "extensions" && <><div className="drawer-title"><Puzzle size={14} /> Installed extensions</div><div className="extension-row"><span className="extension-icon">O</span><span><strong>Orren Language Tools</strong><small>Semantic source + LSP</small></span><StatusPill tone="green">On</StatusPill></div><div className="extension-row"><span className="extension-icon green">M</span><span><strong>Manya Runtime Bridge</strong><small>Events + identities</small></span><StatusPill tone="green">On</StatusPill></div><div className="extension-row"><span className="extension-icon gold">A</span><span><strong>Aruk Credentials</strong><small>Safe provider routing</small></span><StatusPill tone="gold">Ready</StatusPill></div></>}
            {activeTool === "deploy" && <><div className="drawer-title"><Cloud size={14} /> Environments</div><div className="target-card"><span className="target-dot gold" /><span><strong>Staging</strong><small>Last deployed 4m ago</small></span><StatusPill tone="gold">Review</StatusPill></div><div className="target-card"><span className="target-dot green" /><span><strong>Production</strong><small>Current v0.8.3</small></span><StatusPill tone="green">Healthy</StatusPill></div><button className="drawer-action"><ArrowUpRight size={14} /> Open deployment diff</button></>}
            {activeTool === "search" && <><div className="drawer-title"><SearchCheck size={14} /> Search workspace</div><Input placeholder="Search symbols, events, files…" /><div className="search-result"><span className="result-kind">S</span><span><strong>conversation.turn.complete</strong><small>app.orn · event channel</small></span></div><div className="search-result"><span className="result-kind">F</span><span><strong>LineagePanel</strong><small>src/components · component</small></span></div></>}
          </div>}
          <div className="rail-tabs"><button className="rail-tab active"><CircleDot size={14} /> Space</button><button className="rail-tab"><Code2 size={14} /> Files</button><button className="rail-tab"><History size={14} /> History</button></div>
          <div className="mini-project-card"><div className="mini-project-icon"><Sparkles size={18} /></div><div><strong>River of lineage</strong><span>Growing · 7 threads</span></div><span className="live-dot" /></div>
          <div className="rail-section"><div className="section-label"><span>Active spaces</span><Plus size={14} /></div>
            <button className="space-item selected"><span className="space-glyph glyph-gold"><WandSparkles size={15} /></span><span><strong>Design intention</strong><small>Last touched 4m ago</small></span><span className="space-count">5</span></button>
            <button className="space-item"><span className="space-glyph glyph-green"><Network size={15} /></span><span><strong>System architecture</strong><small>2 open questions</small></span><span className="space-count">8</span></button>
            <button className="space-item"><span className="space-glyph glyph-blue"><Bot size={15} /></span><span><strong>Agent council</strong><small>1 waiting for you</small></span><span className="space-count active-count">1</span></button>
            <button className="space-item"><span className="space-glyph glyph-ember"><ShieldCheck size={15} /></span><span><strong>Responsibility</strong><small>All checks passing</small></span><Check className="check-icon" size={15} /></button>
          </div>
          <div className="rail-divider" />
          <div className="rail-section"><div className="section-label"><span>Field gallery</span><button className="text-link">Explore</button></div>
            <div className="field-list"><button className="field-chip"><span className="field-bloom research" />Research</button><button className="field-chip"><span className="field-bloom creative" />Creative arts</button><button className="field-chip"><span className="field-bloom systems" />Systems</button></div>
          </div>
          <div className="rail-footer"><div className="team-card"><div className="team-icon"><UsersRound size={16} /></div><div><strong>Team room</strong><span>3 threads need care</span></div><ArrowUpRight size={15} /></div><div className="branch-line"><GitBranch size={14} /><span>main</span><StatusPill tone="green">synced</StatusPill></div></div>
          </aside>
          <div className="panel-resizer left-resizer" onMouseDown={() => beginResize("left")} role="separator" aria-label="Resize project panel" />

        <section className="canvas-column">
          <ModeNav mode={mode} onModeChange={setMode} layoutMode={layoutMode} onSplitView={() => setLayoutMode(layoutMode === "split" ? "canvas" : "split")} onRunScenario={() => setSimulationRunning(!simulationRunning)} onMike={() => setMikeOpen(true)} onCommand={() => setCommandOpen(true)} simulationRunning={simulationRunning} />
          <div className="mode-intro"><div><span className="eyebrow">Current mode</span><h1><ModeIcon size={22} />{activeMode.label}</h1><p>{activeMode.caption}</p></div><div className="canvas-zoom"><span>100%</span><button>−</button><button>+</button></div></div>
          <div className={cn("live-canvas", `canvas-${mode}`, layoutMode === "split" && "has-split-view")}>
            {layoutMode === "split" && <div className="split-code-pane"><div className="split-pane-header"><span><Braces size={13} /> app.orn</span><span>Orren Language Tools</span></div><div className="code-lines"><span><i>01</i><b>intent</b> river_of_lineage <em>=</em> {"{"}</span><span><i>02</i>  <b>surface</b>: "welcoming-threshold",</span><span><i>03</i>  <b>listen</b>: ["presence", "language", "turn"],</span><span><i>04</i>  <b>realize</b>: <mark>preview</mark>(intention),</span><span><i>05</i>  <b>simulate</b>: scenario("multilingual"),</span><span><i>06</i>{"}"}</span></div><div className="split-pane-footer"><span><span className="pulse-dot" /> semantic LSP connected</span><button onClick={() => setActiveTool("terminal")}><PanelBottom size={12} /> Open terminal</button></div></div>}
            <div className="canvas-art" aria-hidden="true" />
            <div className="canvas-vignette" />
            <div className="constellation-lines"><span className="line line-one" /><span className="line line-two" /><span className="line line-three" /><span className="orbit orbit-one" /><span className="orbit orbit-two" /></div>
            <div className="canvas-stamp"><span className="stamp-icon"><Sparkles size={15} /></span><span>Intention / 05</span><span className="stamp-divider" /><span>v0.8.4</span></div>
            <div className="canvas-title"><span className="eyebrow">Illuminated intention · 05</span><h2>A river where knowledge<br /><em>can remember itself.</em></h2><p>Research, language, and living systems converge into one generous interface.</p><div className="codex-caption"><span>✦</span> semantic manuscript / 09 dimensions</div></div>
            {nodes.map((node) => <NodeCard key={node.id} node={node} selected={node.id === selected} onSelect={() => setSelected(node.id)} />)}
            <div className="codex-seal"><span>HAEL</span><small>FIELD / 05</small></div><div className="canvas-signal"><div className="signal-orb"><span /><span /><span /></div><div><strong>{simulationRunning ? "Scenario in motion" : "System is listening"}</strong><small>{simulationRunning ? "conversation.turn.complete" : "5 semantic threads connected"}</small></div><button onClick={() => setSimulationRunning(!simulationRunning)}>{simulationRunning ? <X size={14} /> : <Play size={14} />}</button></div>
            {mode === "preview" && <div className="preview-runtime">
              <div className="runtime-toolbar"><div className="runtime-route"><span className="runtime-traffic"><i /><i /><i /></span><span>lineage.gqobonco.studio</span><StatusPill tone="green"><span className="pulse-dot" /> runtime ready</StatusPill></div><div className="runtime-toolbar-actions"><button onClick={replayScenario}><RotateCcw size={13} /> Replay</button><button onClick={() => setMode("simulate")}><Play size={13} /> Simulate</button></div></div>
              <div className="runtime-controls"><label>Device<select value={device} onChange={(event) => setDevice(event.target.value)}><option>Desktop</option><option>Tablet</option><option>Mobile</option></select></label><label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>isiXhosa</option><option>English</option><option>Orren</option></select></label><label>Persona<select value={persona} onChange={(event) => setPersona(event.target.value)}><option>Researcher</option><option>First-time visitor</option><option>Reviewer</option></select></label></div>
              <div className="preview-runtime-body">
                <div className="preview-stage-strip"><div className="preview-stages">{(["icon", "entry", "running", "media", "exit"] as const).map((stage) => <button key={stage} onClick={() => setPreviewStage(stage)} className={cn(previewStage === stage && "active")}><span>{stage === "icon" ? "◇" : stage === "entry" ? "↗" : stage === "running" ? "●" : stage === "media" ? "◒" : "×"}</span>{stage}</button>)}</div><div className="artifact-switcher"><button className={artifactType === "application" ? "active" : ""} onClick={() => setArtifactType("application")}><Boxes size={12} /> App</button><button className={artifactType === "video" ? "active" : ""} onClick={() => setArtifactType("video")}><Play size={12} /> Video</button><button className={artifactType === "music" ? "active" : ""} onClick={() => setArtifactType("music")}><Radio size={12} /> Music</button></div></div>
                <div className="preview-identity"><span className="eyebrow">A living research archive</span><span className="preview-runtime-state"><span className="pulse-dot" /> {activeEvent ? activeEvent.label : "Awaiting first signal"}</span></div>
                <h3>{artifactType === "application" ? <>Knowledge does not disappear.<br /><em>It changes hands.</em></> : artifactType === "video" ? <>A moving image<br /><em>can remember a place.</em></> : <>Let the signal<br /><em>find its rhythm.</em></>}</h3>
                <p>{previewStage === "icon" ? "Checking the identity mark before entry." : previewStage === "entry" ? `Welcome, ${persona.toLowerCase()}. This threshold is speaking in ${language}.` : previewStage === "running" ? "The application is moving through its live state." : previewStage === "media" ? "Media playback is isolated from the application runtime." : "The experience has exited cleanly and left its trace."}</p>
                <div className="preview-runtime-card"><div className="preview-orbit"><span /><span /><span /></div><div><span className="eyebrow">Current runtime state</span><strong>{activeEvent ? activeEvent.detail : "The experience is ready to receive a visitor."}</strong><small>{device} · {language} · {persona}</small></div></div>
                {artifactType === "video" && <div className="video-runtime"><video ref={videoRef} src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" poster={canvasArt} onTimeUpdate={(event) => { const video = event.currentTarget; setMediaTime(Math.round((video.currentTime / Math.max(1, video.duration)) * 100)); setEffectTime(Math.round((video.currentTime / Math.max(1, video.duration)) * 20)); }} onEnded={() => { setMediaPlaying(false); setMediaEventLog((current) => ["video.ended", ...current].slice(0, 5)); }} /><div className="video-overlay"><button onClick={toggleVideoPlayback}>{mediaPlaying ? <Pause size={14} /> : <Play size={14} />}</button><span>{mediaPlaying ? "Playing video sandbox" : "Video ready"}</span><StatusPill tone="green">isolated</StatusPill></div></div>}
                {artifactType === "music" && <div className="audio-runtime"><div className="audio-wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="audio-runtime-meta"><div><span className="eyebrow">Sound sandbox</span><strong>{audioPlaying ? "Startup tone is sounding" : "Sound ready to preview"}</strong><small>Web Audio · isolated from app runtime</small></div><StatusPill tone={audioPlaying ? "green" : "gold"}>{audioPlaying ? "Playing" : "Stopped"}</StatusPill></div><button className="audio-primary" onClick={toggleSound}>{audioPlaying ? <Pause size={14} /> : <Play size={14} />} {audioPlaying ? "Stop sound" : "Play sound"}</button></div>}
                {artifactType !== "application" && <div className="media-control"><button className="media-play" onClick={() => artifactType === "video" ? toggleVideoPlayback() : toggleSound()}>{(artifactType === "video" ? mediaPlaying : audioPlaying) ? <Pause size={14} /> : <Play size={14} />}</button><div className="media-track"><span style={{ width: `${mediaTime}%` }} /><input aria-label="Media playback position" type="range" min="0" max="100" value={mediaTime} onChange={(event) => setMediaTime(Number(event.target.value))} /></div><span className="media-time">{mediaTime}%</span><div className="volume-wrap"><button onClick={() => setMediaMuted(!mediaMuted)} aria-label="Toggle mute">{mediaMuted ? "×" : "◖"}</button><input aria-label="Media volume" type="range" min="0" max="100" value={mediaVolume} onChange={(event) => setMediaVolume(Number(event.target.value))} /></div></div>}
                <div className="effect-timeline"><div className="effect-timeline-head"><div><span className="eyebrow">Full effect timeline</span><strong>{selectedEffect.label}</strong><small>{selectedEffect.detail}</small></div><div className="effect-head-actions"><StatusPill tone={effectPlaying ? "green" : "gold"}>{effectPlaying ? "Replaying" : `Pass ${effectReplayCount + 1}`}</StatusPill><button onClick={replayEffects}><RotateCcw size={13} /> Replay</button></div></div><div className="effect-ruler"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span><span>00:20</span></div><div className="effect-track"><span className="effect-playhead" style={{ left: `${(effectTime / 20) * 100}%` }} /><div className="effect-lanes">{(["frame", "audio", "animation", "lifecycle", "interaction"] as EffectKind[]).map(renderEffectLane)}</div></div><div className="media-inspection-lanes"><div className="inspection-lane"><span className="lane-label">waveform</span><div className="waveform-line">{Array.from({ length: 48 }, (_, index) => <span key={index} style={{ height: `${8 + ((index * 17) % 24)}%`, opacity: index / 70 + .45 }} />)}<i className="inspection-playhead" style={{ left: `${(effectTime / 20) * 100}%` }} /></div></div><div className="inspection-lane"><span className="lane-label">frames</span><div className="thumbnail-line">{Array.from({ length: 7 }, (_, index) => <button key={index} onClick={() => setEffectTime(Math.round((index / 6) * 20))} className={cn(index === Math.round((effectTime / 20) * 6) && "active")} style={{ backgroundImage: `url(${canvasArt})`, backgroundPosition: `${index * 18}% center` }}><span>{String(index * 3).padStart(2, "0")}s</span></button>)}<i className="inspection-playhead" style={{ left: `${(effectTime / 20) * 100}%` }} /></div></div></div><div className="effect-timeline-controls"><div><button className="effect-control-primary" onClick={() => setEffectPlaying(!effectPlaying)}>{effectPlaying ? <Pause size={13} /> : <Play size={13} />} {effectPlaying ? "Pause" : "Play"}</button><button onClick={() => stepEffect(-1)}><RotateCcw size={13} /></button><button onClick={() => stepEffect(1)}><StepForward size={13} /></button></div><label>Playhead <input aria-label="Effect timeline playhead" type="range" min="0" max="20" value={effectTime} onChange={(event) => setEffectTime(Number(event.target.value))} /><span>00:{String(effectTime).padStart(2, "0")}</span></label><label>Speed <select value={effectSpeed} onChange={(event) => setEffectSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label></div><div className="effect-selected-detail"><span className={cn("effect-kind-icon", `effect-${selectedEffect.kind}`)}>{effectIcon(selectedEffect.kind)}</span><div><strong>{selectedEffect.time.toString().padStart(2, "0")}s · {selectedEffect.kind}</strong><small>trigger: {selectedEffect.trigger}</small></div><StatusPill tone="neutral">{activeEffect?.id === selectedEffect.id ? "At playhead" : "Inspectable"}</StatusPill></div><div className="effect-inspector"><div><span className="eyebrow">Motion intensity</span><small>{mediaEventLog.length ? mediaEventLog.join(" · ") : "No effects fired yet"}</small></div><input aria-label="Effect intensity" type="range" min="0" max="100" value={effectIntensity} onChange={(event) => setEffectIntensity(Number(event.target.value))} /><StatusPill tone="neutral">{effectIntensity}%</StatusPill></div></div><div className="snapshot-panel"><div className="snapshot-heading"><div><span className="eyebrow">Named effect passes</span><strong>Compare and restore craft</strong></div><div className="snapshot-capture"><Input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} placeholder="Name this pass…" /><button onClick={captureSnapshot}><Plus size={13} /> Save snapshot</button></div></div><div className="snapshot-list">{timelineSnapshots.map((snapshot) => <div className={cn("snapshot-card", compareSnapshotId === snapshot.id && "comparing")} key={snapshot.id}><div className="snapshot-card-main"><span className="snapshot-glyph">✦</span><div><strong>{snapshot.name}</strong><small>{snapshot.createdAt} · {snapshot.artifactType} · {snapshot.previewStage} · {snapshot.effectIntensity}% motion</small></div></div><div className="snapshot-actions"><button onClick={() => setCompareSnapshotId(compareSnapshotId === snapshot.id ? null : snapshot.id)}>{compareSnapshotId === snapshot.id ? "Close compare" : "Compare"}</button><button onClick={() => restoreSnapshot(snapshot)}><RotateCcw size={12} /> Restore</button></div>{compareSnapshotId === snapshot.id && <div className="snapshot-compare"><span>Timeline {snapshot.effectTime}s</span><span>Runtime {snapshot.runtimeTime}s</span><span>Media {snapshot.mediaTime}%</span><StatusPill tone="gold">Saved pass</StatusPill></div>}</div>)}</div></div>
                <div className="preview-progress"><span style={{ width: `${Math.max(8, (runtimeTime / activeScenario.duration) * 100)}%` }} /></div><div className="preview-runtime-footer"><small>{Math.round((runtimeTime / activeScenario.duration) * 100)}% of scenario elapsed · {previewStage} stage</small><div><button onClick={advancePreviewStage}><StepForward size={13} /> Next stage</button><button onClick={() => setMode("simulate")}><Activity size={13} /> View live events</button></div></div>
              </div>
            </div>}
            {mode === "simulate" && <div className="simulation-pane"><div className="simulation-head"><div><span className="eyebrow">Replayable runtime / {String(scenarios.findIndex((scenario) => scenario.id === scenarioId) + 1).padStart(2, "0")}</span><h3>{activeScenario.title}</h3><p>{activeScenario.description}</p></div><div className="simulation-head-actions"><StatusPill tone={simulationRunning ? "green" : "gold"}>{simulationRunning ? "Playing" : runtimeTime >= activeScenario.duration ? "Complete" : "Paused"}</StatusPill><button onClick={resetRuntime} title="Reset scenario"><RotateCcw size={14} /></button></div></div><div className="scenario-picker">{scenarios.map((scenario) => <button key={scenario.id} onClick={() => selectScenario(scenario.id)} className={cn(scenario.id === scenarioId && "active")}><span className="scenario-number">{String(scenarios.indexOf(scenario) + 1).padStart(2, "0")}</span><span><strong>{scenario.title}</strong><small>{scenario.duration}s · {scenario.events.length} events</small></span></button>)}</div><div className="simulation-timeline"><div className="timeline-top"><span>00:{String(runtimeTime).padStart(2, "0")}</span><span>00:{String(activeScenario.duration).padStart(2, "0")}</span></div><div className="timeline-track"><input aria-label="Scenario timeline" type="range" min="0" max={activeScenario.duration} value={runtimeTime} onChange={(event) => setRuntimeTime(Number(event.target.value))} /><span className="timeline-fill" style={{ width: `${(runtimeTime / activeScenario.duration) * 100}%` }} />{activeScenario.events.map((event) => <button key={event.id} className={cn("timeline-event", `timeline-${event.tone}`)} style={{ left: `${(event.time / activeScenario.duration) * 100}%` }} onClick={() => setRuntimeTime(event.time)} title={event.label} />)}</div><div className="timeline-controls"><div className="play-controls"><button className="primary-play" onClick={() => setSimulationRunning(!simulationRunning)}>{simulationRunning ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={resetRuntime}><RotateCcw size={14} /></button><button onClick={() => setRuntimeTime(Math.min(runtimeTime + 1, activeScenario.duration))}><StepForward size={14} /></button><button onClick={injectEvent}><Plus size={14} /> Inject event</button></div><label className="speed-control"><Gauge size={14} /> Speed <select value={runtimeSpeed} onChange={(event) => setRuntimeSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label></div></div><div className="simulation-body"><div className="simulation-state"><div className="state-orb"><span /><span /></div><div><span className="eyebrow">Live runtime state</span><strong>{activeEvent ? activeEvent.label : "Waiting for the first event"}</strong><small>{activeEvent ? activeEvent.detail : "Press play or select a point on the timeline."}</small></div></div><div className="simulation-events"><div className="events-heading"><span>Event stream</span><StatusPill tone="neutral">{runtimeEvents.length} observed</StatusPill></div>{runtimeEvents.length === 0 ? <div className="event-empty"><Radio size={17} /><span>No events have crossed the runtime yet.</span></div> : runtimeEvents.slice().reverse().map((event) => <button key={event.id} className="event-row" onClick={() => setRuntimeTime(event.time)}><span className={cn("event-marker", `event-marker-${event.tone}`)} /><span><strong>{event.label}</strong><small>{event.topic}</small></span><time>00:{String(event.time).padStart(2, "0")}</time></button>)}</div></div></div>}
          </div>
          <div className="context-ribbon"><div className="selection-detail"><span className={cn("selection-marker", `marker-${selectedNode.tone}`)} /><div><span className="eyebrow">Selected thread</span><strong>{selectedNode.label}</strong></div></div><div className="context-meta"><span><Code2 size={14} /> orren.{selectedNode.id}</span><span><Activity size={14} /> 3 listeners</span><span><TestTube2 size={14} /> 2 checks passing</span></div><Button className="context-action" onClick={() => setMode(mode === "simulate" ? "compose" : "simulate")}>{mode === "simulate" ? "Return to canvas" : "Simulate event"}<ArrowUpRight size={15} /></Button></div>
        </section>

        {loomOpen ? <><div className="panel-resizer right-resizer" onMouseDown={() => beginResize("right")} role="separator" aria-label="Resize conversation panel" /><aside className="loom-panel"><div className="loom-header"><div><span className="eyebrow">Conversation loom</span><h2>Studio presence <span className="loom-live"><span className="pulse-dot" /> live</span></h2></div><Button variant="ghost" size="icon" className="loom-close" onClick={() => setLoomOpen(false)}><X size={17} /></Button></div><div className="loom-participants"><Avatar initials="AM" tone="gold" /><Avatar initials="O" tone="green" /><Avatar initials="R" tone="blue" /><div><strong>Amara + 2 agents</strong><span>Working in the same thread</span></div></div><div className="loom-scroll"><div className="loom-message human"><div className="message-meta"><Avatar initials="AM" tone="gold" /><span>Amara Mensah</span><time>09:41</time></div><p>Let’s make the first visit feel like an invitation, not an onboarding form.</p><button className="message-anchor"><Sparkles size={13} /> linked to Human intention</button></div><div className="loom-message agent"><div className="message-meta"><Avatar initials="O" tone="green" /><span>Orren / semantic guide</span><time>09:42</time></div><p>I’ve reframed the opening as a <strong>welcoming threshold</strong>. Three realizations are ready to compare without changing the source.</p><div className="agent-options"><button onClick={() => setMode("preview")}><span className="option-swatch swatch-clear" /><span><strong>Clear</strong><small>Focus and welcome</small></span><ArrowUpRight size={14} /></button><button onClick={() => setMode("preview")}><span className="option-swatch swatch-living" /><span><strong>Living</strong><small>Atmosphere and flow</small></span><ArrowUpRight size={14} /></button></div></div><div className="loom-message agent soft"><div className="message-meta"><Avatar initials="R" tone="blue" /><span>Reviewer / responsibility</span><time>09:43</time></div><p><span className="inline-status"><Check size={12} /> 2 checks</span> No new permissions or sensitive data paths detected.</p></div>{sent && <div className="loom-message human"><div className="message-meta"><Avatar initials="AM" tone="gold" /><span>You</span><time>now</time></div><p>Show me the clearest version first, then let’s simulate a spoken welcome.</p></div>}</div><div className="loom-composer"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Ask the studio…" /><div className="composer-actions"><span><Plus size={14} /> Attach context</span><button onClick={sendMessage} aria-label="Send message"><Send size={16} /></button></div></div>        </aside></> : <button className="loom-reopen" onClick={() => setLoomOpen(true)}><MessageCircle size={17} /><span>Open loom</span></button>}
      </section>

      <footer className="bottom-status"><div><span className="status-ring" /><span>All systems flowing</span><span className="footer-separator" /><span>Local-first workspace</span></div><div><span>Last checkpoint 4m ago</span><span className="footer-separator" /><button><TerminalSquare size={14} /> Open command line</button></div></footer>
      {mikeOpen && <div className="mike-backdrop" onClick={() => setMikeOpen(false)}><aside className="mike-drawer" onClick={(event) => event.stopPropagation()}><div className="mike-heading"><div className="mike-avatar"><MessageCircle size={20} /></div><div><span className="eyebrow">Live communication bridge</span><h2>Mike <span><span className="pulse-dot" /> present</span></h2><p>Natural language for agents, Orren, and the terminal.</p></div><Button variant="ghost" size="icon" onClick={() => setMikeOpen(false)}><X size={17} /></Button></div><div className="mike-contract"><ShieldCheck size={15} /><span><strong>Architecture contract active</strong><small>Mike can suggest and stage commands. Nothing crosses into another subsystem without review.</small></span></div><div className="mike-context"><span className="eyebrow">Speaking to</span><div><button className={cn("mike-context-chip", mikeTarget === "orren" && "active")} onClick={() => setMikeTarget("orren")}><Bot size={14} /> Orren</button><button className={cn("mike-context-chip", mikeTarget === "terminal" && "active")} onClick={() => setMikeTarget("terminal")}><TerminalSquare size={14} /> Terminal</button><button className={cn("mike-context-chip", mikeTarget === "room" && "active")} onClick={() => setMikeTarget("room")}><UsersRound size={14} /> Agent room</button></div></div><div className="mike-thread"><div className="mike-message mike-user"><Avatar initials="AM" tone="gold" /><div><small>You · now</small><p>Run the semantic tests and show me the preview entry flow.</p></div></div><div className="mike-message mike-agent"><div className="mike-avatar small"><MessageCircle size={14} /></div><div><small>Mike · live bridge</small><p>I’ll ask Orren for the test command, stage it in Terminal, then return the result here. No source changes will be made.</p><div className="mike-command-card"><div><span className="eyebrow">Proposed terminal action</span><code>pnpm test:semantic && pnpm preview:entry</code></div><StatusPill tone={mikeStatus === "approved" ? "green" : "gold"}>{mikeStatus === "approved" ? "Approved" : mikeStatus === "staged" ? "Awaiting approval" : "Ready to stage"}</StatusPill></div><div className="mike-action-row"><button onClick={approveMike}><Check size={13} /> Approve & stage</button><button onClick={() => setMikeStatus("ready")}><X size={13} /> Decline</button></div></div></div>{miked && <div className="mike-message mike-user"><Avatar initials="AM" tone="gold" /><div><small>You · now</small><p>Show me how the music generator would be previewed without coupling it to the app runtime.</p></div></div>}</div><div className="mike-composer"><Textarea value={mikeMessage} onChange={(event) => setMikeMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMike(); } }} placeholder="Speak naturally… e.g. “Open the terminal and run…”" /><div className="composer-actions"><span><ShieldCheck size={13} /> Contract-aware</span><button onClick={sendMike} aria-label="Send to Mike"><Send size={16} /></button></div></div></aside></div>}
      {commandOpen && <div className="command-backdrop" onClick={() => setCommandOpen(false)}><div className="command-panel" onClick={(event) => event.stopPropagation()}><div className="command-heading"><div><span className="eyebrow">Ask the studio</span><h2>What would you like to bring into the light?</h2></div><Button variant="ghost" size="icon" onClick={() => setCommandOpen(false)}><X size={17} /></Button></div><Input autoFocus placeholder="Try “simulate a multilingual first visit”" /><div className="command-suggestions"><button onClick={() => { setMode("preview"); setCommandOpen(false); }}><Globe2 size={17} /><span><strong>Compare realizations</strong><small>See three expressions of the current intention</small></span><ArrowUpRight size={15} /></button><button onClick={() => { setMode("simulate"); setCommandOpen(false); }}><Play size={17} /><span><strong>Run a scenario</strong><small>Replay system behavior before release</small></span><ArrowUpRight size={15} /></button><button onClick={() => { setMode("inspect"); setCommandOpen(false); }}><ShieldCheck size={17} /><span><strong>Review responsibility</strong><small>Trace evidence, permissions, and change</small></span><ArrowUpRight size={15} /></button></div><div className="shortcut-reference"><div className="shortcut-heading"><span className="eyebrow">Shortcut reference</span><span>Cloud workspace · {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}</span></div><div className="shortcut-grid"><button onClick={() => { setActiveTool("code"); setCommandOpen(false); }}><span>Code</span><kbd>{navigator.platform.includes("Mac") ? "⌘ 1" : "Ctrl 1"}</kbd></button><button onClick={() => { setActiveTool("terminal"); setCommandOpen(false); }}><span>Terminal</span><kbd>{navigator.platform.includes("Mac") ? "⌘ 2" : "Ctrl 2"}</kbd></button><button onClick={() => { setActiveTool("source"); setCommandOpen(false); }}><span>Source control</span><kbd>{navigator.platform.includes("Mac") ? "⌘ 3" : "Ctrl 3"}</kbd></button><button onClick={() => { setLayoutMode("split"); setCommandOpen(false); }}><span>Split view</span><kbd>{navigator.platform.includes("Mac") ? "⌘ 4" : "Ctrl 4"}</kbd></button><button onClick={() => { setMode("preview"); setCommandOpen(false); }}><span>Preview</span><kbd>{navigator.platform.includes("Mac") ? "⌘ P" : "Ctrl P"}</kbd></button><button onClick={() => { setMikeOpen(true); setCommandOpen(false); }}><span>Open Mike</span><kbd>{navigator.platform.includes("Mac") ? "⌘ J" : "Ctrl J"}</kbd></button></div></div><div className="command-footer"><span><Command size={13} /> K</span><span>Press Enter to ask</span></div></div></div>}
    </StudioShell>
  );
}
