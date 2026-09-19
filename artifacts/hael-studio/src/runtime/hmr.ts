/**
 * HMR Integration - Connects runtime to Vite Hot Module Replacement
 * 
 * This module provides automatic detection of module changes during development
 * and triggers appropriate runtime responses.
 * 
 * Development-only: All HMR code is gated by import.meta.env.DEV and import.meta.hot
 */

import { runtimeRegistry } from "./registry";
import { changeTracker } from "./changeTracker";
import { getStateEngine } from "./stateEngine";

// Track which modules have been registered for HMR
const registeredModules = new Set<string>();

// Track pending HMR updates
interface HmrUpdate {
  moduleId: string;
  timestamp: number;
  type: "update" | "prereplace" | "dispose";
}

const pendingUpdates: HmrUpdate[] = [];

/**
 * Register a module for HMR tracking
 * When the module is edited, the callback will be triggered
 */
export function registerHmrModule(moduleId: string, onUpdate: () => void): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) {
    return () => {};
  }
  
  if (registeredModules.has(moduleId)) {
    return () => {};
  }
  
  registeredModules.add(moduleId);
  
  // Listen for HMR events on this module
  import.meta.hot.on(moduleId, (event) => {
    const update: HmrUpdate = {
      moduleId,
      timestamp: Date.now(),
      type: event.type as "update" | "prereplace" | "dispose",
    };
    pendingUpdates.push(update);
    
    // Record the change in ChangeTracker
    const record = runtimeRegistry.getSnapshot().records.find((r) => r.source === moduleId);
    if (record) {
      changeTracker.recordChange({
        id: record.id,
        type: "refresh",
        timestamp: Date.now(),
        from: record.health,
        moduleId,
        consequence: `HMR ${event.type} event detected for ${moduleId}`,
      });
    }
    
    // Trigger callback
    onUpdate();
    
    // Cleanup old updates
    if (pendingUpdates.length > 50) {
      pendingUpdates.shift();
    }
  });
  
  return () => {
    registeredModules.delete(moduleId);
  };
}

/**
 * Get pending HMR updates
 */
export function getPendingHmrUpdates(): HmrUpdate[] {
  return [...pendingUpdates];
}

/**
 * Clear pending HMR updates
 */
export function clearPendingHmrUpdates(): void {
  pendingUpdates.length = 0;
}

/**
 * Setup automatic re-registration for runtime elements on HMR
 * 
 * This ensures that when a module containing a runtime element is edited,
 * the element re-registers with the same runtimeId, preserving identity.
 */
export function setupAutoReRegistration(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) {
    return () => {};
  }
  
  const snapshot = runtimeRegistry.getSnapshot();
  const disposals: (() => void)[] = [];
  
  // For each registered element with a source, set up HMR tracking
  for (const record of snapshot.records) {
    if (record.source) {
      const disposal = registerHmrModule(record.source, () => {
        // On HMR update, re-register with the same runtimeId
        const newRecord = runtimeRegistry.register({
          id: record.id,
          label: record.label,
          layer: record.layer,
          source: record.source,
          symbol: record.symbol,
          feature: record.feature,
          runtimeId: record.runtimeId,
          dependsOn: record.dependsOn,
          affects: record.affects,
          detail: record.detail,
        });
        
        runtimeRegistry.report(record.id, "healthy", "Re-registered after HMR update");
        
        // Track the re-registration
        changeTracker.recordChange({
          id: record.id,
          type: "refresh",
          timestamp: Date.now(),
          from: "degraded",
          to: "healthy",
          moduleId: record.source,
          consequence: `Module re-registered with same runtimeId: ${record.runtimeId || record.id}`,
        });
        
        // Store disposal for cleanup
        disposals.push(newRecord);
      });
      disposals.push(disposal);
    }
  }
  
  return () => {
    disposals.forEach((d) => d());
  };
}

/**
 * Setup HMR tracking for StateEngine
 * 
 * When studioStore.tsx is edited, we need to ensure StateEngine state is preserved.
 * This is handled by the StateEngine singleton pattern, but we track it here.
 */
export function setupStateEngineHmrTracking(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) {
    return () => {};
  }
  
  // Track state before HMR
  const engine = getStateEngine();
  const stateBefore = engine.getFullState();
  
  // Set up HMR callback for studioStore module
  const disposal = registerHmrModule("client/src/state/studioStore.tsx", () => {
    // After HMR, verify StateEngine preserved state
    const stateAfter = engine.getFullState();
    
    if (stateAfter.version > stateBefore.version) {
      // State was updated, this is expected
      changeTracker.recordChange({
        id: "state.studio",
        type: "refresh",
        timestamp: Date.now(),
        from: "healthy",
        to: "healthy",
        moduleId: "client/src/state/studioStore.tsx",
        consequence: `StateEngine preserved across HMR. Version: ${stateBefore.version} -> ${stateAfter.version}`,
      });
    } else if (stateAfter.mode === stateBefore.mode && stateAfter.selectedNodeId === stateBefore.selectedNodeId) {
      // State preserved
      changeTracker.recordChange({
        id: "state.studio",
        type: "refresh",
        timestamp: Date.now(),
        moduleId: "client/src/state/studioStore.tsx",
        consequence: `StateEngine state preserved across HMR. Living and checkpoints maintained.`,
      });
    } else {
      // State was lost - this is a problem
      changeTracker.recordChange({
        id: "state.studio",
        type: "refresh",
        timestamp: Date.now(),
        from: "healthy",
        to: "degraded",
        moduleId: "client/src/state/studioStore.tsx",
        consequence: `WARNING: StateEngine state may have been lost during HMR`,
      });
    }
  });
  
  return disposal;
}

/**
 * Initialize all HMR tracking for the runtime
 * Call this once during application startup in DEV mode
 */
export function initializeRuntimeHmr(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) {
    return () => {};
  }
  
  const disposals: (() => void)[] = [
    setupAutoReRegistration(),
    setupStateEngineHmrTracking(),
  ];
  
  return () => {
    disposals.forEach((d) => d());
  };
}

/**
 * Check if HMR is available
 */
export function isHmrAvailable(): boolean {
  return import.meta.env.DEV && !!import.meta.hot;
}
