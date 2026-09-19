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

// Track which modules have been registered for HMR observation
const registeredModules = new Map<string, () => void>();

// Track pending HMR updates
interface HmrUpdate {
  moduleId: string;
  timestamp: number;
  type: "beforeUpdate" | "afterUpdate" | "error";
  payload?: any;
}

const pendingUpdates: HmrUpdate[] = [];

// Track module-specific callbacks
const moduleCallbacks = new Map<string, Set<() => void>>();

/**
 * Register a module for HMR observation using Vite's global HMR events
 * We use import.meta.hot.on() to listen to global HMR events, not accept()
 */
export function registerHmrModule(moduleId: string, onUpdate: () => void): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) {
    return () => {};
  }
  
  if (registeredModules.has(moduleId)) {
    return () => {};
  }
  
  registeredModules.set(moduleId, () => {
    // Add callback to the set for this module
    if (!moduleCallbacks.has(moduleId)) {
      moduleCallbacks.set(moduleId, new Set());
    }
    moduleCallbacks.get(moduleId)!.add(onUpdate);
  });
  
  // Immediately add the callback
  if (!moduleCallbacks.has(moduleId)) {
    moduleCallbacks.set(moduleId, new Set());
  }
  moduleCallbacks.get(moduleId)!.add(onUpdate);
  
  return () => {
    const callbacks = moduleCallbacks.get(moduleId);
    if (callbacks) {
      callbacks.delete(onUpdate);
      if (callbacks.size === 0) {
        moduleCallbacks.delete(moduleId);
        registeredModules.delete(moduleId);
      }
    }
  };
}

/**
 * Initialize global HMR event listeners
 * This should be called once at application startup
 */
let globalListenersInitialized = false;

export function initializeGlobalHmrListeners(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot || globalListenersInitialized) {
    return () => {};
  }
  
  globalListenersInitialized = true;
  
  const beforeUpdateListener = (payload: any) => {
    const updates = payload.updates || [];
    for (const update of updates) {
      const moduleId = update.path || update.url;
      const callbacks = moduleCallbacks.get(moduleId);
      if (callbacks) {
        const hmrUpdate: HmrUpdate = {
          moduleId,
          timestamp: Date.now(),
          type: "beforeUpdate",
          payload,
        };
        pendingUpdates.push(hmrUpdate);
        
        // Record the change in ChangeTracker
        const record = runtimeRegistry.getSnapshot().records.find((r) => r.source === moduleId);
        if (record) {
          changeTracker.recordChange({
            id: record.id,
            type: "refresh",
            timestamp: Date.now(),
            from: record.health,
            moduleId,
            consequence: `HMR beforeUpdate detected for ${moduleId}`,
          });
        }
        
        // Trigger all callbacks for this module
        callbacks.forEach(callback => callback());
        
        // Cleanup old updates
        if (pendingUpdates.length > 50) {
          pendingUpdates.shift();
        }
      }
    }
  };
  
  const afterUpdateListener = (payload: any) => {
    const updates = payload.updates || [];
    for (const update of updates) {
      const moduleId = update.path || update.url;
      const callbacks = moduleCallbacks.get(moduleId);
      if (callbacks) {
        const hmrUpdate: HmrUpdate = {
          moduleId,
          timestamp: Date.now(),
          type: "afterUpdate",
          payload,
        };
        pendingUpdates.push(hmrUpdate);
        
        // Record the change in ChangeTracker
        const record = runtimeRegistry.getSnapshot().records.find((r) => r.source === moduleId);
        if (record) {
          changeTracker.recordChange({
            id: record.id,
            type: "refresh",
            timestamp: Date.now(),
            from: record.health,
            moduleId,
            consequence: `HMR afterUpdate detected for ${moduleId}`,
          });
        }
        
        // Trigger all callbacks for this module
        callbacks.forEach(callback => callback());
        
        // Cleanup old updates
        if (pendingUpdates.length > 50) {
          pendingUpdates.shift();
        }
      }
    }
  };
  
  const errorListener = (payload: any) => {
    const moduleId = payload.path || payload.url;
    const callbacks = moduleCallbacks.get(moduleId);
    if (callbacks) {
      const hmrUpdate: HmrUpdate = {
        moduleId,
        timestamp: Date.now(),
        type: "error",
        payload,
      };
      pendingUpdates.push(hmrUpdate);
      
      // Record the error in ChangeTracker
      const record = runtimeRegistry.getSnapshot().records.find((r) => r.source === moduleId);
      if (record) {
        changeTracker.recordChange({
          id: record.id,
          type: "refresh",
          timestamp: Date.now(),
          from: record.health,
          moduleId,
          consequence: `HMR error detected for ${moduleId}: ${payload?.err?.message || 'Unknown error'}`,
        });
      }
      
      // Trigger all callbacks for this module
      callbacks.forEach(callback => callback());
      
      // Cleanup old updates
      if (pendingUpdates.length > 50) {
        pendingUpdates.shift();
      }
    }
  };
  
  // Register the listeners with Vite's global HMR events
  const hot = import.meta.hot;
  if (hot && hot.on) {
    hot.on('vite:beforeUpdate', beforeUpdateListener);
    hot.on('vite:afterUpdate', afterUpdateListener);
    hot.on('vite:error', errorListener);
  }
  
  // Return cleanup function
  return () => {
    const hot = import.meta.hot;
    if (hot && hot.off) {
      hot.off('vite:beforeUpdate', beforeUpdateListener);
      hot.off('vite:afterUpdate', afterUpdateListener);
      hot.off('vite:error', errorListener);
    }
    globalListenersInitialized = false;
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
        const unregister = runtimeRegistry.register({
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
        disposals.push(unregister);
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
    initializeGlobalHmrListeners(),
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