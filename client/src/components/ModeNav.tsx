/* Hael Studio visual system: one calm, responsive mode rail that keeps engineering and creative modes discoverable without crowding the canvas. */
import { Activity, Braces, ChevronDown, Command, Eye, MessageCircle, Play, Search, Sparkles, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "compose" | "preview" | "simulate" | "inspect";

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
  return (
    <nav className="mode-nav" aria-label="Hael Studio workspace modes">
      <div className="mode-nav-primary" role="tablist" aria-label="Primary workspace modes">
        {primaryModes.map(({ id, label, icon: Icon }) => (
          <button key={id} className={cn("mode-nav-item", mode === id && "active")} onClick={() => onModeChange(id)} role="tab" aria-selected={mode === id}>
            <Icon size={14} /> <span>{label}</span>
          </button>
        ))}
      </div>
      <details className="mode-nav-overflow">
        <summary><Activity size={14} /><span>More</span><ChevronDown size={13} /></summary>
        <div className="mode-nav-menu">
          <button onClick={() => onModeChange("simulate")}><Play size={14} /> Simulate</button>
          <button onClick={onRunScenario}><Activity size={14} /> {simulationRunning ? "Pause scenario" : "Run scenario"}</button>
          <button onClick={onSplitView} className={layoutMode === "split" ? "selected" : ""}><Braces size={14} /> {layoutMode === "split" ? "Canvas + Code" : "Split view"}</button>
        </div>
      </details>
      <div className="mode-nav-utilities">
        <button className="mode-nav-utility mike-trigger" onClick={onMike} aria-label="Open Mike live communication"><MessageCircle size={15} /><span className="pulse-dot" /></button>
        <button className="mode-nav-utility" onClick={onCommand} aria-label="Open shortcut palette"><Command size={16} /></button>
      </div>
    </nav>
  );
}
