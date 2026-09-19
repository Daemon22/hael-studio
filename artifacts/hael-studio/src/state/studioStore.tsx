import { createContext, useContext, useEffect, useReducer, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { checkpoint, defaultManifest } from "@/shared/artifact";
import type { ArtifactManifest, Checkpoint } from "@/shared/artifact";
import { createLivingApp, step } from "@/runtime/lifecycle";
import type { LifecycleEvent, LivingApp } from "@/runtime/lifecycle";
import { initializeStateEngine, getStateEngine, useFullEngineState, StateEngine } from "@/runtime/stateEngine";
import type { EngineState, FullEngineState } from "@/runtime/stateEngine";
import { runtimeRegistry } from "@/runtime/registry";

export type Mode = "compose" | "simulate" | "inspect";
export type StudioEvent =
  | { type: "mode/change"; mode: Mode }
  | { type: "artifact/refine"; patch: Partial<ArtifactManifest> }
  | { type: "lifecycle"; event: LifecycleEvent }
  | { type: "checkpoint/save"; name: string }
  | { type: "checkpoint/restore"; id: string }
  | { type: "canvas/select"; nodeId: string };
export type StudioState = { mode: Mode; artifact: ArtifactManifest; living: LivingApp; checkpoints: Checkpoint[]; selectedNodeId: string };

const initialState: StudioState = { mode: "compose", artifact: defaultManifest, living: createLivingApp(), checkpoints: [], selectedNodeId: "intention" };

// Persistent state identifier for the studio runtime
const STUDIO_STATE_ID = "state.studio";

function reducer(state: StudioState, event: StudioEvent): StudioState {
  switch (event.type) {
    case "mode/change": return { ...state, mode: event.mode };
    case "artifact/refine": return { ...state, artifact: { ...state.artifact, ...event.patch, refinement: state.artifact.refinement + 1 } };
    case "lifecycle": return { ...state, living: step(state.living, state.artifact, event.event) };
    case "checkpoint/save": return { ...state, checkpoints: [...state.checkpoints, checkpoint(event.name, state.artifact)] };
    case "checkpoint/restore": { const found = state.checkpoints.find((item) => item.id === event.id); return found ? { ...state, artifact: found.manifest, living: createLivingApp() } : state; }
    case "canvas/select": return { ...state, selectedNodeId: event.nodeId };
  }
}

const StudioContext = createContext<{ state: StudioState; send: (event: StudioEvent) => void } | null>(null);

// Convert StudioState to FullEngineState for StateEngine
function studioToFullEngine(state: StudioState): FullEngineState {
  return {
    mode: state.mode,
    artifact: state.artifact,
    selectedNodeId: state.selectedNodeId,
    living: state.living,
    checkpoints: state.checkpoints,
    version: 0,
    lastUpdated: Date.now(),
  };
}

// Convert FullEngineState + event to StudioState
function fullEngineToStudio(fullState: FullEngineState, event?: StudioEvent): StudioState {
  // If we have a lifecycle event, apply it to the living state
  let living = fullState.living;
  if (event?.type === "lifecycle") {
    living = step(fullState.living, fullState.artifact, event.event);
  }
  return {
    mode: fullState.mode,
    artifact: fullState.artifact,
    living,
    checkpoints: fullState.checkpoints,
    selectedNodeId: fullState.selectedNodeId,
  };
}

// Initialize the durable StateEngine with FULL state (including living and checkpoints)
function getOrInitEngine(): StateEngine {
  const initialFullState = studioToFullEngine(initialState);
  const initialEngineState: EngineState = {
    mode: initialState.mode,
    artifact: initialState.artifact,
    selectedNodeId: initialState.selectedNodeId,
    version: 0,
    lastUpdated: Date.now(),
  };
  return initializeStateEngine(initialEngineState, {
    living: initialFullState.living,
    checkpoints: initialFullState.checkpoints,
  });
}

export function StudioProvider({ children }: { children: ReactNode }) {
  // Get the durable StateEngine (singleton across Fast Refresh)
  const engine = getOrInitEngine();
  
  // Subscribe to FULL state from engine
  const fullState = useFullEngineState(engine);
  
  // Build StudioState from full engine state
  // Note: We apply reducer logic for lifecycle events, but mode/artifact/selectedNodeId come from engine
  const [event, setEvent] = useReducer((e: StudioEvent | null, action: StudioEvent | null) => action, null);
  
  const state: StudioState = fullEngineToStudio(fullState, event || undefined);
  
  // Dispatch that updates engine with new state
  const send = (event: StudioEvent) => {
    setEvent(event);
    
    const currentFullState = engine.getFullState();
    const currentState: StudioState = fullEngineToStudio(currentFullState);
    const newState = reducer(currentState, event);
    
    // Update StateEngine with full new state
    engine.updateFull({
      mode: newState.mode,
      artifact: newState.artifact,
      selectedNodeId: newState.selectedNodeId,
      living: newState.living,
      checkpoints: newState.checkpoints,
    });
  };
  
  // Lifecycle timer - send TICK events
  useEffect(() => {
    if (["icon", "exited"].includes(state.living.state)) return;
    const timer = window.setInterval(() => send({ type: "lifecycle", event: { type: "TICK", dt: 0.1 } }), 100);
    return () => window.clearInterval(timer);
  }, [state.living.state]);
  
  // Register the studio state with runtime registry for observation
  useEffect(() => {
    const unregister = runtimeRegistry.register({
      id: "studio.store",
      label: "Studio state",
      layer: "state",
      source: "client/src/state/studioStore.tsx",
      symbol: "reducer",
      runtimeId: STUDIO_STATE_ID,
      feature: "studio",
      dependsOn: ["studio.provider", "lifecycle.engine"],
      detail: "Manifest, checkpoints, selection, mode, and running state. FULL state (living+checkpoints) persists across Fast Refresh via StateEngine.",
    });
    
    return () => {
      unregister();
    };
  }, []);
  
  return <StudioContext.Provider value={{ state, send }}>{children}</StudioContext.Provider>;
}
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("useStudio must be used inside StudioProvider");
  return context;
}
