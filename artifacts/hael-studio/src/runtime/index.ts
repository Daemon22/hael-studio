/**
 * HAEL Studio Runtime Library
 * 
 * Provides the Live Construction Environment infrastructure.
 * 
 * Core components:
 * - RuntimeRegistry: Central registry for all runtime elements
 * - StateEngine: Separates live state from UI providers
 * - ChangeTracker: Tracks change-to-consequence relationships
 * - Lifecycle: Application lifecycle management
 * 
 * Development-only: All runtime instrumentation is gated by DEV mode
 */

export {
  runtimeRegistry,
} from "./registry";
export type {
  RuntimeLayer,
  RuntimeHealth,
  FeatureName,
  RuntimeElement,
  RuntimeRecord,
  RuntimeSnapshot,
  ChangeEvent,
} from "./registry";

export {
  getStateEngine,
  initializeStateEngine,
  resetStateEngine,
  useEngineState,
  useFullEngineState,
} from "./stateEngine";
export type { EngineState, FullEngineState } from "./stateEngine";

export { changeTracker } from "./changeTracker";

export { createLivingApp, step } from "./lifecycle";
export type { LivingApp, LifecycleEvent } from "./lifecycle";

export { useRuntimeElement } from "./DevRuntime";
export { default as DevRuntime } from "./DevRuntime";

// HMR integration
export {
  registerHmrModule,
  getPendingHmrUpdates,
  clearPendingHmrUpdates,
  setupAutoReRegistration,
  setupStateEngineHmrTracking,
  initializeRuntimeHmr,
  isHmrAvailable,
} from "./hmr";
