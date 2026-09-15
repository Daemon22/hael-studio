/**
 * State Engine - Separates live application state from replaceable UI layers
 * 
 * This allows the runtime to preserve state across Fast Refresh operations
 * where provider components may be recreated but the underlying state
 * should remain intact.
 */

import { useState, useEffect } from "react";
import type { StudioState, Mode } from "@/state/studioStore";
import type { ArtifactManifest, Checkpoint } from "@shared/artifact";
import { createLivingApp } from "./lifecycle";
import type { LivingApp } from "./lifecycle";

// StateEngine maintains the core application state independently of UI providers
export type EngineState = {
  mode: Mode;
  artifact: ArtifactManifest;
  selectedNodeId: string;
  version: number;
  lastUpdated: number;
};

// Extended engine state that includes all studio state for full preservation
export type FullEngineState = EngineState & {
  living: LivingApp;
  checkpoints: Checkpoint[];
};

type StateUpdate = Partial<EngineState> & { version?: number };

type Subscriber<T> = (state: T) => void;

export class StateEngine {
  private state: EngineState;
  private fullState: FullEngineState;
  private subscribers = new Set<Subscriber<EngineState>>();
  private fullSubscribers = new Set<Subscriber<FullEngineState>>();
  private pendingUpdate: StateUpdate | null = null;

  constructor(initialState: EngineState, initialFullState?: Partial<Omit<FullEngineState, keyof EngineState>>) {
    this.state = initialState;
    this.fullState = {
      ...initialState,
      living: initialFullState?.living || createLivingApp(),
      checkpoints: initialFullState?.checkpoints || [],
    };
  }

  getState(): EngineState {
    return { ...this.state };
  }

  getFullState(): FullEngineState {
    return { ...this.fullState };
  }

  getMode(): Mode {
    return this.state.mode;
  }

  getArtifact(): ArtifactManifest {
    return this.state.artifact;
  }

  getSelectedNodeId(): string {
    return this.state.selectedNodeId;
  }

  getLiving(): LivingApp {
    return this.fullState.living;
  }

  getCheckpoints(): Checkpoint[] {
    return [...this.fullState.checkpoints];
  }

  update(partial: StateUpdate): EngineState {
    const newState: EngineState = {
      ...this.state,
      ...partial,
      version: partial.version ?? this.state.version + 1,
      lastUpdated: Date.now(),
    };
    this.state = newState;
    this.fullState = { ...this.fullState, ...partial };
    this.notify();
    this.notifyFull();
    return newState;
  }

  patch(partial: Partial<Omit<EngineState, "version" | "lastUpdated">>): EngineState {
    return this.update({ ...partial, version: this.state.version + 1 });
  }

  // Update full state including living and checkpoints
  updateFull(partial: Partial<FullEngineState>): FullEngineState {
    const newFullState: FullEngineState = {
      ...this.fullState,
      ...partial,
      version: partial.version ?? this.fullState.version + 1,
      lastUpdated: Date.now(),
    };
    this.fullState = newFullState;
    this.state = {
      mode: newFullState.mode,
      artifact: newFullState.artifact,
      selectedNodeId: newFullState.selectedNodeId,
      version: newFullState.version,
      lastUpdated: newFullState.lastUpdated,
    };
    this.notify();
    this.notifyFull();
    return newFullState;
  }

  reset(replaceState: EngineState): EngineState {
    this.state = {
      ...replaceState,
      version: this.state.version + 1,
      lastUpdated: Date.now(),
    };
    this.notify();
    return this.state;
  }

  resetFull(replaceState: FullEngineState): FullEngineState {
    this.fullState = {
      ...replaceState,
      version: this.fullState.version + 1,
      lastUpdated: Date.now(),
    };
    this.state = {
      mode: replaceState.mode,
      artifact: replaceState.artifact,
      selectedNodeId: replaceState.selectedNodeId,
      version: this.fullState.version,
      lastUpdated: this.fullState.lastUpdated,
    };
    this.notify();
    this.notifyFull();
    return this.fullState;
  }

  stageUpdate(update: StateUpdate): void {
    this.pendingUpdate = update;
  }

  commitPending(): EngineState | null {
    if (!this.pendingUpdate) return null;
    const update = this.pendingUpdate;
    this.pendingUpdate = null;
    return this.update(update);
  }

  clearPending(): void {
    this.pendingUpdate = null;
  }

  subscribe(subscriber: Subscriber<EngineState>): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  subscribeFull(subscriber: Subscriber<FullEngineState>): () => void {
    this.fullSubscribers.add(subscriber);
    return () => this.fullSubscribers.delete(subscriber);
  }

  private notify(): void {
    this.subscribers.forEach((subscriber) => subscriber(this.state));
  }

  private notifyFull(): void {
    this.fullSubscribers.forEach((subscriber) => subscriber(this.fullState));
  }
}

// Create a singleton StateEngine instance that persists across Fast Refresh
// In Vite Fast Refresh, module-level variables survive when the module is preserved
let stateEngine: StateEngine | null = null;
let stateEngineInitialized = false;

export function getStateEngine(): StateEngine {
  if (!stateEngine) {
    throw new Error("StateEngine not initialized. Call initializeStateEngine() first.");
  }
  return stateEngine;
}

export function initializeStateEngine(initialState: EngineState, initialFullState?: Partial<Omit<FullEngineState, keyof EngineState>>): StateEngine {
  // Only initialize once - on Fast Refresh, this will return the existing instance
  if (!stateEngineInitialized) {
    stateEngine = new StateEngine(initialState, initialFullState);
    stateEngineInitialized = true;
  }
  return stateEngine!;
}

export function resetStateEngine(): void {
  stateEngine = null;
  stateEngineInitialized = false;
}

// Check if StateEngine is already initialized (for debugging)
export function isStateEngineInitialized(): boolean {
  return stateEngineInitialized;
}

// Helper to bridge between React reducer and StateEngine
export function useEngineState(engine: StateEngine): EngineState {
  const [state, setState] = useState<EngineState>(engine.getState());
  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    return () => unsubscribe();
  }, [engine]);
  return state;
}

// Helper for full state subscription
export function useFullEngineState(engine: StateEngine): FullEngineState {
  const [state, setState] = useState<FullEngineState>(engine.getFullState());
  useEffect(() => {
    const unsubscribe = engine.subscribeFull(setState);
    return () => unsubscribe();
  }, [engine]);
  return state;
}
