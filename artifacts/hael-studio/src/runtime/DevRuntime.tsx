import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { runtimeRegistry } from "@/runtime/registry";
import type { RuntimeElement } from "@/runtime/registry";
import { changeTracker } from "./changeTracker";
import { DevRuntimeInspector } from "@/components/DevRuntimeInspector";
import { initializeRuntimeHmr, isHmrAvailable } from "./hmr";

const applicationModel: RuntimeElement[] = [
  { id: "shell", label: "HAEL application shell", layer: "presentation", source: "client/src/App.tsx", symbol: "App", runtimeId: "feature.shell", feature: "shell", detail: "The mounted browser application." },
  { id: "home", label: "Studio workspace", layer: "presentation", source: "client/src/pages/Home.tsx", symbol: "Home", runtimeId: "feature.home", feature: "home", dependsOn: ["route.home", "studio.provider", "lifecycle.engine"], detail: "The current interactive workspace surface." },
  { id: "projects", label: "Projects feature", layer: "presentation", source: "client/src/pages/Home.tsx", symbol: "Projects", runtimeId: "feature.projects", feature: "projects", dependsOn: ["studio.store", "lifecycle.engine"], affects: ["home", "navigation"], detail: "Projects management and visualization surface." },
  { id: "route.home", label: "Home route", layer: "navigation", source: "client/src/App.tsx", symbol: "Router", runtimeId: "route.home", feature: "navigation", dependsOn: ["shell"], detail: "Wouter route /." },
  { id: "navigation", label: "Navigation system", layer: "navigation", source: "client/src/components/ModeNav.tsx", symbol: "ModeNav", runtimeId: "feature.navigation", feature: "navigation", dependsOn: ["shell", "home"], detail: "Primary workspace mode navigation." },
  { id: "theme.provider", label: "ThemeProvider", layer: "provider", source: "client/src/contexts/ThemeContext.tsx", symbol: "ThemeProvider", runtimeId: "provider.theme", feature: "theme", dependsOn: ["shell"], detail: "Theme context provider. Replaces on Fast Refresh but shell identity preserved." },
  { id: "studio.provider", label: "StudioProvider", layer: "provider", source: "client/src/state/studioStore.tsx", symbol: "StudioProvider", runtimeId: "provider.studio", feature: "studio", dependsOn: ["lifecycle.engine"], detail: "Studio context provider. Replaces on Fast Refresh but state.studio (StateEngine) persists." },
  { id: "lifecycle.engine", label: "Lifecycle engine", layer: "lifecycle", source: "client/src/runtime/lifecycle.ts", symbol: "step", runtimeId: "lifecycle.engine", feature: "lifecycle", detail: "The power rail for the living application. Stable across module refreshes." },
  { id: "production.server", label: "Production static server", layer: "runtime", source: "server/index.ts", symbol: "startServer", runtimeId: "production.server", feature: "runtime", detail: "Express serves production assets; it is not the development runtime." },
];

export function useRuntimeElement(element: RuntimeElement) {
  useEffect(() => runtimeRegistry.register(element), [element]);
}

export default function DevRuntime({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unregister = applicationModel.map((element) => runtimeRegistry.register(element));
    const onError = (event: ErrorEvent) => runtimeRegistry.report("shell", "broken", event.error?.message || event.message || "Unknown runtime error");
    const onRejection = (event: PromiseRejectionEvent) => runtimeRegistry.report("shell", "broken", String(event.reason || "Unhandled promise rejection"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    
    // Initialize HMR tracking if available (DEV mode with hot support)
    let hmrDisposal: (() => void) | undefined;
    if (isHmrAvailable()) {
      hmrDisposal = initializeRuntimeHmr();
    }
    
    return () => { 
      unregister.forEach((remove) => remove()); 
      window.removeEventListener("error", onError); 
      window.removeEventListener("unhandledrejection", onRejection);
      if (hmrDisposal) hmrDisposal();
    };
  }, []);
  return <><DevRuntimeHealthBridge />{children}<DevRuntimeInspector /></>;
}

function DevRuntimeHealthBridge() {
  const snapshot = useSyncExternalStore(runtimeRegistry.subscribe, runtimeRegistry.getSnapshot, runtimeRegistry.getSnapshot);
  useEffect(() => {
    const records = new Map(snapshot.records.map((record) => [record.id, record]));
    for (const record of snapshot.records) {
      const failedDependency = record.dependsOn?.map((id) => records.get(id)).find((dependency) =>
        !dependency || !dependency.active || dependency.health === "broken" || dependency.health === "degraded",
      );
      if (failedDependency && record.health !== "broken") {
        const dependencyLabel = failedDependency?.label ?? record.dependsOn?.find((id) => !records.has(id)) ?? "unknown dependency";
        runtimeRegistry.report(record.id, "degraded", `Dependency health: ${dependencyLabel} is unavailable or unhealthy.`);
      } else if (!failedDependency && record.health === "degraded" && record.error?.startsWith("Dependency health:")) {
        runtimeRegistry.report(record.id, "healthy");
      }
    }
  }, [snapshot]);
  return null;
}

// Expose runtime objects to window for debugging in DEV mode
declare global {
  interface Window {
    runtimeRegistry?: typeof runtimeRegistry;
    changeTracker?: typeof changeTracker;
    getStateEngine?: typeof import("./stateEngine").getStateEngine;
    getFeatureVerticalSlice?: typeof import("./scenarios/projectsRegression").getFeatureVerticalSlice;
    runProjectsScenario?: typeof import("./scenarios/projectsRegression").runProjectsScenario;
    isHmrAvailable?: typeof import("./hmr").isHmrAvailable;
    getPendingHmrUpdates?: typeof import("./hmr").getPendingHmrUpdates;
  }
}
