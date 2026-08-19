/* Hael Studio — Luminous Codex Workspace. This page keeps semantic intent, live preview, simulation, and accountable agents in one warm, dimensional canvas. */
import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const markUrl = "/manus-storage/hael-studio-mark_792fa113.png";
const canvasArt = "/manus-storage/hael-studio-canvas-art_368e3674.jpg";

type Mode = "compose" | "preview" | "simulate" | "inspect";

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
  const selectedNode
 = useMemo(() => nodes.find((node) => node.id === selected) ?? nodes[0], [selected]);
  const activeMode = modeMeta[mode];
  const ModeIcon = activeMode.icon;

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

  return (
    <main className="studio-shell">
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

      <section className="workspace-grid">
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

        <section className="canvas-column">
          <div className="canvas-toolbar"><div className="mode-switcher">{(Object.keys(modeMeta) as Mode[]).map((key) => { const MetaIcon = modeMeta[key].icon; return <button key={key} onClick={() => setMode(key)} className={cn("mode-button", mode === key && "active")}><MetaIcon size={15} />{modeMeta[key].label}</button>; })}</div><div className="canvas-actions"><StatusPill tone="green"><span className="pulse-dot" /> Live canvas</StatusPill><Button variant="ghost" size="sm" className="canvas-utility" onClick={() => setSimulationRunning(!simulationRunning)}><Play size={14} /> {simulationRunning ? "Pause" : "Run scenario"}</Button><Button variant="ghost" size="icon" className="canvas-utility" onClick={() => setCommandOpen(true)}><Command size={17} /></Button></div></div>
          <div className="mode-intro"><div><span className="eyebrow">Current mode</span><h1><ModeIcon size={22} />{activeMode.label}</h1><p>{activeMode.caption}</p></div><div className="canvas-zoom"><span>100%</span><button>−</button><button>+</button></div></div>
          <div className={cn("live-canvas", `canvas-${mode}`)}>
            <div className="canvas-art" style={{ backgroundImage: `url(${canvasArt})` }} />
            <div className="canvas-vignette" />
            <div className="constellation-lines"><span className="line line-one" /><span className="line line-two" /><span className="line line-three" /><span className="orbit orbit-one" /><span className="orbit orbit-two" /></div>
            <div className="canvas-stamp"><span className="stamp-icon"><Sparkles size={15} /></span><span>Intention / 05</span><span className="stamp-divider" /><span>v0.8.4</span></div>
            <div className="canvas-title"><span className="eyebrow">Illuminated intention · 05</span><h2>A river where knowledge<br /><em>can remember itself.</em></h2><p>Research, language, and living systems converge into one generous interface.</p><div className="codex-caption"><span>✦</span> semantic manuscript / 09 dimensions</div></div>
            {nodes.map((node) => <NodeCard key={node.id} node={node} selected={node.id === selected} onSelect={() => setSelected(node.id)} />)}
            <div className="codex-seal"><span>HAEL</span><small>FIELD / 05</small></div><div className="canvas-signal"><div className="signal-orb"><span /><span /><span /></div><div><strong>{simulationRunning ? "Scenario in motion" : "System is listening"}</strong><small>{simulationRunning ? "conversation.turn.complete" : "5 semantic threads connected"}</small></div><button onClick={() => setSimulationRunning(!simulationRunning)}>{simulationRunning ? <X size={14} /> : <Play size={14} />}</button></div>
            {mode === "preview" && <div className="preview-runtime"><div className="runtime-toolbar"><div className="runtime-route"><span className="runtime-traffic"><i /><i /><i /></span><span>lineage.gqobonco.studio</span><StatusPill tone="green"><span className="pulse-dot" /> runtime ready</StatusPill></div><div className="runtime-toolbar-actions"><button onClick={replayScenario}><RotateCcw size={13} /> Replay</button><button onClick={() => setMode("simulate")}><Play size={13} /> Simulate</button></div></div><div className="runtime-controls"><label>Device<select value={device} onChange={(event) => setDevice(event.target.value)}><option>Desktop</option><option>Tablet</option><option>Mobile</option></select></label><label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>isiXhosa</option><option>English</option><option>Orren</option></select></label><label>Persona<select value={persona} onChange={(event) => setPersona(event.target.value)}><option>Researcher</option><option>First-time visitor</option><option>Reviewer</option></select></label></div><div className="preview-runtime-body"><div className="preview-identity"><span className="eyebrow">A living research archive</span><span className="preview-runtime-state"><span className="pulse-dot" /> {activeEvent ? activeEvent.label : "Awaiting first signal"}</span></div><h3>Knowledge does not disappear.<br /><em>It changes hands.</em></h3><p>Welcome, {persona.toLowerCase()}. This threshold is speaking in <strong>{language}</strong>.</p><div className="preview-runtime-card"><div className="preview-orbit"><span /><span /><span /></div><div><span className="eyebrow">Current runtime state</span><strong>{activeEvent ? activeEvent.detail : "The experience is ready to receive a visitor."}</strong><small>{device} · {language} · {persona}</small></div></div><div className="preview-progress"><span style={{ width: `${Math.max(8, (runtimeTime / activeScenario.duration) * 100)}%` }} /></div><div className="preview-runtime-footer"><small>{Math.round((runtimeTime / activeScenario.duration) * 100)}% of scenario elapsed</small><button onClick={() => setMode("simulate")}><Activity size={13} /> View live events</button></div></div></div>}
            {mode === "simulate" && <div className="simulation-pane"><div className="simulation-head"><div><span className="eyebrow">Replayable runtime / {String(scenarios.findIndex((scenario) => scenario.id === scenarioId) + 1).padStart(2, "0")}</span><h3>{activeScenario.title}</h3><p>{activeScenario.description}</p></div><div className="simulation-head-actions"><StatusPill tone={simulationRunning ? "green" : "gold"}>{simulationRunning ? "Playing" : runtimeTime >= activeScenario.duration ? "Complete" : "Paused"}</StatusPill><button onClick={resetRuntime} title="Reset scenario"><RotateCcw size={14} /></button></div></div><div className="scenario-picker">{scenarios.map((scenario) => <button key={scenario.id} onClick={() => selectScenario(scenario.id)} className={cn(scenario.id === scenarioId && "active")}><span className="scenario-number">{String(scenarios.indexOf(scenario) + 1).padStart(2, "0")}</span><span><strong>{scenario.title}</strong><small>{scenario.duration}s · {scenario.events.length} events</small></span></button>)}</div><div className="simulation-timeline"><div className="timeline-top"><span>00:{String(runtimeTime).padStart(2, "0")}</span><span>00:{String(activeScenario.duration).padStart(2, "0")}</span></div><div className="timeline-track"><input aria-label="Scenario timeline" type="range" min="0" max={activeScenario.duration} value={runtimeTime} onChange={(event) => setRuntimeTime(Number(event.target.value))} /><span className="timeline-fill" style={{ width: `${(runtimeTime / activeScenario.duration) * 100}%` }} />{activeScenario.events.map((event) => <button key={event.id} className={cn("timeline-event", `timeline-${event.tone}`)} style={{ left: `${(event.time / activeScenario.duration) * 100}%` }} onClick={() => setRuntimeTime(event.time)} title={event.label} />)}</div><div className="timeline-controls"><div className="play-controls"><button className="primary-play" onClick={() => setSimulationRunning(!simulationRunning)}>{simulationRunning ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={resetRuntime}><RotateCcw size={14} /></button><button onClick={() => setRuntimeTime(Math.min(runtimeTime + 1, activeScenario.duration))}><StepForward size={14} /></button><button onClick={injectEvent}><Plus size={14} /> Inject event</button></div><label className="speed-control"><Gauge size={14} /> Speed <select value={runtimeSpeed} onChange={(event) => setRuntimeSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label></div></div><div className="simulation-body"><div className="simulation-state"><div className="state-orb"><span /><span /></div><div><span className="eyebrow">Live runtime state</span><strong>{activeEvent ? activeEvent.label : "Waiting for the first event"}</strong><small>{activeEvent ? activeEvent.detail : "Press play or select a point on the timeline."}</small></div></div><div className="simulation-events"><div className="events-heading"><span>Event stream</span><StatusPill tone="neutral">{runtimeEvents.length} observed</StatusPill></div>{runtimeEvents.length === 0 ? <div className="event-empty"><Radio size={17} /><span>No events have crossed the runtime yet.</span></div> : runtimeEvents.slice().reverse().map((event) => <button key={event.id} className="event-row" onClick={() => setRuntimeTime(event.time)}><span className={cn("event-marker", `event-marker-${event.tone}`)} /><span><strong>{event.label}</strong><small>{event.topic}</small></span><time>00:{String(event.time).padStart(2, "0")}</time></button>)}</div></div></div>}
          </div>
          <div className="context-ribbon"><div className="selection-detail"><span className={cn("selection-marker", `marker-${selectedNode.tone}`)} /><div><span className="eyebrow">Selected thread</span><strong>{selectedNode.label}</strong></div></div><div className="context-meta"><span><Code2 size={14} /> orren.{selectedNode.id}</span><span><Activity size={14} /> 3 listeners</span><span><TestTube2 size={14} /> 2 checks passing</span></div><Button className="context-action" onClick={() => setMode(mode === "simulate" ? "compose" : "simulate")}>{mode === "simulate" ? "Return to canvas" : "Simulate event"}<ArrowUpRight size={15} /></Button></div>
        </section>

        {loomOpen ? <aside className="loom-panel"><div className="loom-header"><div><span className="eyebrow">Conversation loom</span><h2>Studio presence <span className="loom-live"><span className="pulse-dot" /> live</span></h2></div><Button variant="ghost" size="icon" className="loom-close" onClick={() => setLoomOpen(false)}><X size={17} /></Button></div><div className="loom-participants"><Avatar initials="AM" tone="gold" /><Avatar initials="O" tone="green" /><Avatar initials="R" tone="blue" /><div><strong>Amara + 2 agents</strong><span>Working in the same thread</span></div></div><div className="loom-scroll"><div className="loom-message human"><div className="message-meta"><Avatar initials="AM" tone="gold" /><span>Amara Mensah</span><time>09:41</time></div><p>Let’s make the first visit feel like an invitation, not an onboarding form.</p><button className="message-anchor"><Sparkles size={13} /> linked to Human intention</button></div><div className="loom-message agent"><div className="message-meta"><Avatar initials="O" tone="green" /><span>Orren / semantic guide</span><time>09:42</time></div><p>I’ve reframed the opening as a <strong>welcoming threshold</strong>. Three realizations are ready to compare without changing the source.</p><div className="agent-options"><button onClick={() => setMode("preview")}><span className="option-swatch swatch-clear" /><span><strong>Clear</strong><small>Focus and welcome</small></span><ArrowUpRight size={14} /></button><button onClick={() => setMode("preview")}><span className="option-swatch swatch-living" /><span><strong>Living</strong><small>Atmosphere and flow</small></span><ArrowUpRight size={14} /></button></div></div><div className="loom-message agent soft"><div className="message-meta"><Avatar initials="R" tone="blue" /><span>Reviewer / responsibility</span><time>09:43</time></div><p><span className="inline-status"><Check size={12} /> 2 checks</span> No new permissions or sensitive data paths detected.</p></div>{sent && <div className="loom-message human"><div className="message-meta"><Avatar initials="AM" tone="gold" /><span>You</span><time>now</time></div><p>Show me the clearest version first, then let’s simulate a spoken welcome.</p></div>}</div><div className="loom-composer"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Ask the studio…" /><div className="composer-actions"><span><Plus size={14} /> Attach context</span><button onClick={sendMessage} aria-label="Send message"><Send size={16} /></button></div></div></aside> : <button className="loom-reopen" onClick={() => setLoomOpen(true)}><MessageCircle size={17} /><span>Open loom</span></button>}
      </section>

      <footer className="bottom-status"><div><span className="status-ring" /><span>All systems flowing</span><span className="footer-separator" /><span>Local-first workspace</span></div><div><span>Last checkpoint 4m ago</span><span className="footer-separator" /><button><TerminalSquare size={14} /> Open command line</button></div></footer>
      {commandOpen && <div className="command-backdrop" onClick={() => setCommandOpen(false)}><div className="command-panel" onClick={(event) => event.stopPropagation()}><div className="command-heading"><div><span className="eyebrow">Ask the studio</span><h2>What would you like to bring into the light?</h2></div><Button variant="ghost" size="icon" onClick={() => setCommandOpen(false)}><X size={17} /></Button></div><Input autoFocus placeholder="Try “simulate a multilingual first visit”" /><div className="command-suggestions"><button onClick={() => { setMode("preview"); setCommandOpen(false); }}><Globe2 size={17} /><span><strong>Compare realizations</strong><small>See three expressions of the current intention</small></span><ArrowUpRight size={15} /></button><button onClick={() => { setMode("simulate"); setCommandOpen(false); }}><Play size={17} /><span><strong>Run a scenario</strong><small>Replay system behavior before release</small></span><ArrowUpRight size={15} /></button><button onClick={() => { setMode("inspect"); setCommandOpen(false); }}><ShieldCheck size={17} /><span><strong>Review responsibility</strong><small>Trace evidence, permissions, and change</small></span><ArrowUpRight size={15} /></button></div><div className="command-footer"><span><Command size={13} /> K</span><span>Press Enter to ask</span></div></div></div>}
    </main>
  );
}
