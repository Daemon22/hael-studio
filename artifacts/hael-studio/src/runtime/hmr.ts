/** Development-only bridge between Vite updates and stable runtime identities. */
import { runtimeRegistry } from "./registry";
import { changeTracker } from "./changeTracker";
import { getStateEngine } from "./stateEngine";

type HmrHandler = {
  updates: Set<() => void>;
  beforeUpdates: Set<() => void>;
  pending: boolean;
  before: (payload: ViteUpdatePayload) => void;
  after: () => void;
};
const registeredModules = new Map<string, HmrHandler>();
interface HmrUpdate {
  moduleId: string;
  timestamp: number;
  type: "update" | "prereplace" | "dispose";
}
const pendingUpdates: HmrUpdate[] = [];
type ViteUpdatePayload = { updates?: Array<{ path?: string; acceptedPath?: string }> };

function normalizeModuleId(moduleId: string): string {
  const normalized = moduleId.replace(/\\/g, "/").split("?")[0] ?? moduleId;
  const sourceIndex = normalized.lastIndexOf("/src/");
  if (sourceIndex >= 0) return normalized.slice(sourceIndex);
  return normalized.startsWith("src/") ? `/${normalized}` : normalized;
}

export function registerHmrModule(moduleId: string, onUpdate: () => void, onBeforeUpdate?: () => void): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) return () => {};

  const target = normalizeModuleId(moduleId);
  const isTargetUpdate = (payload: ViteUpdatePayload) => (payload.updates ?? []).some((update) =>
    [update.path, update.acceptedPath].some((path) => typeof path === "string" && normalizeModuleId(path) === target),
  );
  let handler = registeredModules.get(target);
  if (!handler) {
    handler = {
      updates: new Set(),
      beforeUpdates: new Set(),
      pending: false,
      before: (payload) => {
        if (!isTargetUpdate(payload)) return;
        const current = registeredModules.get(target);
        if (!current) return;
        current.pending = true;
        current.beforeUpdates.forEach((callback) => callback());
      },
      after: () => {
        const current = registeredModules.get(target);
        if (!current?.pending) return;
        current.pending = false;
        const event: HmrUpdate = { moduleId: target, timestamp: Date.now(), type: "update" };
        pendingUpdates.push(event);
        if (pendingUpdates.length > 50) pendingUpdates.shift();
        runtimeRegistry.getSnapshot().records
          .filter((record) => normalizeModuleId(record.source ?? "") === target)
          .forEach((record) => {
            changeTracker.recordChange({
            id: record.id,
            type: "refresh",
            timestamp: event.timestamp,
            from: record.health,
            to: record.health,
            moduleId: target,
            consequence: `Vite replaced ${target}; runtime identity and linked dependents were retained.`,
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("hael:runtime", { detail: {
                eventType: "hmr_update", runtimeId: record.runtimeId ?? record.id,
                detail: `Vite updated ${target}; stable runtime identity was retained.`,
              } }));
            }
          });
        current.updates.forEach((callback) => callback());
      },
    };
    registeredModules.set(target, handler);
    import.meta.hot.on("vite:beforeUpdate", handler.before);
    import.meta.hot.on("vite:afterUpdate", handler.after);
  }
  handler.updates.add(onUpdate);
  if (onBeforeUpdate) handler.beforeUpdates.add(onBeforeUpdate);
  return () => {
    const current = registeredModules.get(target);
    if (!current) return;
    current.updates.delete(onUpdate);
    if (onBeforeUpdate) current.beforeUpdates.delete(onBeforeUpdate);
    if (!current.updates.size && !current.beforeUpdates.size) {
      registeredModules.delete(target);
      import.meta.hot?.off("vite:beforeUpdate", current.before);
      import.meta.hot?.off("vite:afterUpdate", current.after);
    }
  };
}

export function getPendingHmrUpdates(): HmrUpdate[] {
  return [...pendingUpdates];
}

export function clearPendingHmrUpdates(): void {
  pendingUpdates.length = 0;
}

export function setupAutoReRegistration(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) return () => {};

  const disposals: (() => void)[] = [];
  const refreshedRegistrations = new Map<string, () => void>();
  for (const record of runtimeRegistry.getSnapshot().records) {
    if (!record.source) continue;
    const disposal = registerHmrModule(record.source, () => {
      refreshedRegistrations.get(record.id)?.();
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
      refreshedRegistrations.set(record.id, unregister);
      runtimeRegistry.report(record.id, "healthy");
    });
    disposals.push(disposal);
  }
  return () => {
    disposals.forEach((dispose) => dispose());
    refreshedRegistrations.forEach((dispose) => dispose());
    refreshedRegistrations.clear();
  };
}

export function setupStateEngineHmrTracking(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) return () => {};

  const engine = getStateEngine();
  let stateBefore: ReturnType<typeof engine.getFullState> | undefined;
  return registerHmrModule("client/src/state/studioStore.tsx", () => {
    const stateAfter = engine.getFullState();
    if (stateBefore && stateAfter.version > stateBefore.version) {
      changeTracker.recordChange({
        id: "state.studio",
        type: "refresh",
        timestamp: Date.now(),
        from: "healthy",
        to: "healthy",
        moduleId: "client/src/state/studioStore.tsx",
        consequence: `StateEngine preserved across HMR (version ${stateBefore.version} → ${stateAfter.version}).`,
      });
    } else if (stateBefore && stateAfter.mode === stateBefore.mode && stateAfter.selectedNodeId === stateBefore.selectedNodeId) {
      changeTracker.recordChange({
        id: "state.studio",
        type: "refresh",
        timestamp: Date.now(),
        moduleId: "client/src/state/studioStore.tsx",
        consequence: "StateEngine selection and live state were preserved across HMR.",
      });
    } else if (stateBefore) {
      changeTracker.recordChange({
        id: "state.studio",
        type: "refresh",
        timestamp: Date.now(),
        from: "healthy",
        to: "degraded",
        moduleId: "client/src/state/studioStore.tsx",
        consequence: "StateEngine state changed during HMR and needs inspection.",
      });
    }
  }, () => { stateBefore = engine.getFullState(); });
}

export function initializeRuntimeHmr(): () => void {
  if (!import.meta.env.DEV || !import.meta.hot) return () => {};
  const disposals = [setupAutoReRegistration(), setupStateEngineHmrTracking()];
  return () => disposals.forEach((dispose) => dispose());
}

export function isHmrAvailable(): boolean {
  return import.meta.env.DEV && !!import.meta.hot;
}
