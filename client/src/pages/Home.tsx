/* Hael Studio — Luminous Codex Workspace. This page keeps semantic intent, live preview, simulation, and accountable agents in one warm, dimensional canvas. */
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
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
  Network,
  Play,
  Plus,
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

type Node = {
  id: string;
  label: string;
  detail: string;
  x: string;
  y: string;
  tone: "gold" | "green" | "mist" | "ember";
  icon: typeof Sparkles;
};

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

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selected) ?? nodes[0], [selected]);
  const activeMode = modeMeta[mode];
  const ModeIcon = activeMode.icon;

  function sendMessage() {
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
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
        <aside className="constellation-rail">
          <div className="rail-heading"><div><span className="eyebrow">Your studio</span><h2>Constellation</h2></div><Button variant="ghost" size="icon" className="rail-more"><MoreHorizontal size={18} /></Button></div>
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
            {mode === "preview" && <div className="preview-frame"><div className="preview-frame-top"><span /><span /><span /><small>lineage.gqobonco.studio</small></div><div className="preview-body"><span className="eyebrow">A living research archive</span><h3>Knowledge does not disappear.<br /><em>It changes hands.</em></h3><div className="preview-progress"><span style={{ width: "68%" }} /></div><small>68% of the semantic experience realized</small></div></div>}
            {mode === "simulate" && <div className="scenario-panel"><div className="scenario-head"><div><span className="eyebrow">Scenario / 03</span><strong>Multilingual first visit</strong></div><StatusPill tone="gold">Playing</StatusPill></div><div className="scenario-track"><span className="track-fill" /><span className="track-point one" /><span className="track-point two" /><span className="track-point three" /></div><div className="scenario-events"><span><i className="event-green" />Presence detected</span><span><i className="event-gold" />Language: isiXhosa</span><span><i className="event-blue" />Agent listening</span></div></div>}
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
