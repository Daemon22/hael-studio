/* Hael Studio visual system: one calm, responsive command surface keeps every mode discoverable without crowding the canvas. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Activity, Braces, Check, ChevronDown, Command, Eye, Mic, Play, Search, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "compose" | "preview" | "simulate" | "inspect";
type CommandItem = { id: string; label: string; description: string; shortcut: string; group: string; icon: typeof Eye; action: () => void };

type ModeNavProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  layoutMode: "canvas" | "split";
  onSplitView: () => void;
  onRunScenario: () => void;
  onMike: () => void;
  onCommand: () => void;
  simulationRunning: boolean;
};

const primaryModes = [
  { id: "compose" as const, label: "Compose", icon: WandSparkles },
  { id: "preview" as const, label: "Preview", icon: Eye },
  { id: "inspect" as const, label: "Inspect", icon: Search },
];

export function ModeNav({ mode, onModeChange, layoutMode, onSplitView, onRunScenario, onMike, onCommand, simulationRunning }: ModeNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";

  const commands = useMemo<CommandItem[]>(() => [
    { id: "simulate", label: "Open Simulate", description: "Replay runtime events and lifecycle behavior", shortcut: `${mod} ⇧ S`, group: "Workspace", icon: Activity, action: () => onModeChange("simulate") },
    { id: "scenario", label: simulationRunning ? "Pause scenario" : "Run scenario", description: "Start or pause the active replayable scenario", shortcut: `${mod} R`, group: "Workspace", icon: Play, action: onRunScenario },
    { id: "split", label: layoutMode === "split" ? "Return to Canvas" : "Open Split view", description: "Pair the semantic canvas with the code editor", shortcut: `${mod} \\`, group: "Workspace", icon: Braces, action: onSplitView },
    { id: "communication", label: "Open live communication", description: "Speak naturally with agents and Orren", shortcut: `${mod} J`, group: "Communication", icon: Mic, action: onMike },
  ], [layoutMode, mod, onMike, onModeChange, onRunScenario, onSplitView, simulationRunning]);

  const filtered = commands.filter((command) => `${command.label} ${command.description} ${command.group}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!menuOpen) return;
    setActiveIndex(0);
    requestAnimationFrame(() => searchRef.current?.focus());
    const onOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeMenu(); };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(Math.max(0, index), Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function closeMenu() {
    setMenuOpen(false); setQuery(""); requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function execute(command: CommandItem) {
    command.action(); closeMenu();
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => filtered.length ? (index + 1) % filtered.length : 0); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => filtered.length ? (index - 1 + filtered.length) % filtered.length : 0); }
    if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); execute(filtered[activeIndex]); }
    if (event.key === "Escape") { event.preventDefault(); closeMenu(); }
  }

  return (
    <nav className="mode-nav" aria-label="Hael Studio workspace modes">
      <div className="mode-nav-primary" role="tablist" aria-label="Primary workspace modes">
        {primaryModes.map(({ id, label, icon: Icon }) => <button key={id} className={cn("mode-nav-item", mode === id && "active")} onClick={() => onModeChange(id)} role="tab" aria-selected={mode === id}><Icon size={14} /> <span>{label}</span></button>)}
      </div>
      <div className="mode-command-wrap" ref={menuRef}>
        <button ref={triggerRef} className={cn("mode-nav-command-trigger", menuOpen && "active")} onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen}><Command size={14} /><span className="command-trigger-label">Commands</span><kbd>{mod} K</kbd><ChevronDown size={13} /></button>
        {menuOpen && <div className="mode-command-menu" role="menu" aria-label="Workspace commands" onKeyDown={onMenuKeyDown}>
          <div className="command-menu-search"><Search size={14} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" aria-label="Search workspace commands" /><kbd>Esc</kbd></div>
          <div className="command-menu-list">{filtered.length ? filtered.map((command, index) => { const Icon = command.icon; return <button key={command.id} className={cn("command-menu-item", index === activeIndex && "active")} role="menuitem" onMouseEnter={() => setActiveIndex(index)} onClick={() => execute(command)}><span className="command-item-icon"><Icon size={14} /></span><span className="command-item-copy"><strong>{command.label}</strong><small>{command.description}</small></span><span className="command-item-meta"><span>{command.group}</span><kbd>{command.shortcut}</kbd>{index === activeIndex && <Check size={12} />}</span></button>; }) : <div className="command-menu-empty"><Search size={16} /><span>No matching command</span><small>Try “simulate”, “split”, or “communication”.</small></div>}</div>
          <div className="command-menu-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Run</span><span><kbd>Esc</kbd> Close</span></div>
        </div>}
      </div>
      <div className="mode-nav-utilities"><button className="mode-nav-utility mic-trigger" onClick={onMike} aria-label="Open live communication bridge"><Mic size={15} /><span className="pulse-dot" /></button><button className="mode-nav-utility" onClick={onCommand} aria-label="Open shortcut palette"><Command size={16} /></button></div>
    </nav>
  );
}
