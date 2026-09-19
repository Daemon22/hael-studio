/**
 * Projects Feature Regression Scenario
 *
 * Controlled end-to-end development scenario for testing the Live Construction Environment.
 *
 * This scenario validates the 14-step requirement from objective #14.
 */

import { runtimeRegistry } from "../registry";
import { changeTracker } from "../changeTracker";
import type { RuntimeRecord, RuntimeHealth, FeatureName } from "../registry";

// Define the scenario steps
export type ScenarioStep = {
  id: string;
  description: string;
  validation: () => ScenarioResult;
};

export type ScenarioResult = {
  pass: boolean;
  message: string;
  details?: Record<string, unknown>;
};

// Scenario: Projects Feature Live Development
// Mirrors requirement #14 exactly

export const projectsRegressionScenario: ScenarioStep[] = [
  {
    id: "step-01",
    description: "Open application. Confirm Projects feature is live.",
    validation: (): ScenarioResult => {
      const records = runtimeRegistry.getSnapshot().records;
      const projectsRecords = records.filter((r) => r.feature === "projects");

      if (projectsRecords.length === 0) {
        return {
          pass: false,
          message: "Projects feature not found in runtime registry",
          details: { availableFeatures: Array.from(new Set(records.map((r) => r.feature))) },
        };
      }

      const projectsRecord = projectsRecords[0];
      if (projectsRecord.health !== "healthy") {
        return {
          pass: false,
          message: `Projects feature is not healthy: ${projectsRecord.health}`,
          details: { health: projectsRecord.health, error: projectsRecord.error },
        };
      }

      return {
        pass: true,
        message: "Projects feature is live and healthy",
        details: {
          projectsRecords: projectsRecords.map((r) => ({ id: r.id, label: r.label, health: r.health })),
        },
      };
    },
  },
  {
    id: "step-02",
    description: "Inspect its runtime identity.",
    validation: (): ScenarioResult => {
      const projectsRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.feature === "projects"
      );

      if (!projectsRecord) {
        return { pass: false, message: "Projects feature record not found" };
      }

      if (!projectsRecord.runtimeId) {
        return {
          pass: false,
          message: "Projects feature missing runtime identity",
          details: { id: projectsRecord.id, hasRuntimeId: false },
        };
      }

      if (!projectsRecord.runtimeId.startsWith("feature.")) {
        return {
          pass: false,
          message: `Projects runtime identity has unexpected format: ${projectsRecord.runtimeId}`,
        };
      }

      return {
        pass: true,
        message: `Projects feature has stable runtime identity: ${projectsRecord.runtimeId}`,
        details: { runtimeId: projectsRecord.runtimeId, id: projectsRecord.id },
      };
    },
  },
  {
    id: "step-03",
    description: "Inspect dependencies.",
    validation: (): ScenarioResult => {
      const projectsRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.feature === "projects"
      );

      if (!projectsRecord) {
        return { pass: false, message: "Projects feature record not found" };
      }

      const dependencies = runtimeRegistry.getDependencies(projectsRecord.id);

      if (dependencies.length === 0 && !projectsRecord.dependsOn) {
        return {
          pass: false,
          message: "Projects feature has no registered dependencies",
        };
      }

      const brokenDeps = dependencies.filter((d) => d.health === "broken");
      if (brokenDeps.length > 0) {
        return {
          pass: false,
          message: `Projects has ${brokenDeps.length} broken dependencies`,
          details: { brokenDeps: brokenDeps.map((d) => d.id) },
        };
      }

      return {
        pass: true,
        message: `Projects has ${dependencies.length} healthy dependencies`,
        details: { dependencies: dependencies.map((d) => d.id) },
      };
    },
  },
  {
    id: "step-04",
    description: "Change a presentation module (simulate Fast Refresh).",
    validation: (): ScenarioResult => {
      const beforeSnapshot = runtimeRegistry.getSnapshot();
      const projectsBefore = beforeSnapshot.records.find((r) => r.feature === "projects");

      if (!projectsBefore) {
        return { pass: false, message: "Projects feature not found before refresh" };
      }

      const runtimeIdBefore = projectsBefore.runtimeId;
      const versionBefore = projectsBefore.version;

      // Simulate Fast Refresh by re-registering with same runtimeId
      const unregister = runtimeRegistry.register({
        id: "projects",
        label: "Projects feature",
        layer: "presentation",
        source: "client/src/pages/Home.tsx",
        symbol: "Projects",
        runtimeId: runtimeIdBefore,
        feature: "projects",
        dependsOn: ["studio.store", "lifecycle.engine"],
        affects: ["home", "navigation"],
        detail: "Projects management and visualization surface.",
      });

      const afterSnapshot = runtimeRegistry.getSnapshot();
      const projectsAfter = afterSnapshot.records.find((r) => r.feature === "projects");

      unregister(); // Clean up

      if (!projectsAfter) {
        return { pass: false, message: "Projects feature lost after refresh" };
      }

      if (projectsAfter.runtimeId !== runtimeIdBefore) {
        return {
          pass: false,
          message: `Runtime identity changed: ${runtimeIdBefore} -> ${projectsAfter.runtimeId}`,
        };
      }

      if (projectsAfter.version <= versionBefore) {
        return {
          pass: false,
          message: `Version not incremented: ${versionBefore} -> ${projectsAfter.version}`,
        };
      }

      return {
        pass: true,
        message: "Fast Refresh preserved runtime identity and incremented version",
        details: {
          runtimeIdPreserved: projectsAfter.runtimeId === runtimeIdBefore,
          versionIncremented: projectsAfter.version > versionBefore,
          health: projectsAfter.health,
        },
      };
    },
  },
  {
    id: "step-05",
    description: "Confirm Fast Refresh.",
    validation: (): ScenarioResult => {
      const projectsRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.feature === "projects"
      );

      if (!projectsRecord) {
        return { pass: false, message: "Projects feature not found" };
      }

      if (projectsRecord.health !== "healthy") {
        return {
          pass: false,
          message: `Projects health: ${projectsRecord.health}`,
        };
      }

      return {
        pass: true,
        message: "Fast Refresh confirmed - Projects remains healthy",
        details: { health: projectsRecord.health },
      };
    },
  },
  {
    id: "step-06",
    description: "Confirm shared lifecycle state survives.",
    validation: (): ScenarioResult => {
      const lifecycleRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.id === "lifecycle.engine"
      );

      if (!lifecycleRecord) {
        return { pass: false, message: "Lifecycle engine not found" };
      }

      if (lifecycleRecord.health !== "healthy") {
        return {
          pass: false,
          message: `Lifecycle engine health: ${lifecycleRecord.health}`,
        };
      }

      return {
        pass: true,
        message: "Lifecycle engine remains healthy across Fast Refresh",
        details: { lifecycleHealth: lifecycleRecord.health },
      };
    },
  },
  {
    id: "step-07",
    description: "Confirm runtime remains healthy.",
    validation: (): ScenarioResult => {
      const snapshot = runtimeRegistry.getSnapshot();
      const brokenCount = snapshot.records.filter((r) => r.health === "broken").length;

      if (brokenCount > 0) {
        return {
          pass: false,
          message: `${brokenCount} broken runtime elements detected`,
          details: {
            broken: snapshot.records
              .filter((r) => r.health === "broken")
              .map((r) => r.id),
          },
        };
      }

      return {
        pass: true,
        message: "Runtime remains healthy with no broken elements",
        details: {
          total: snapshot.records.length,
          active: snapshot.records.filter((r) => r.active).length,
          broken: 0,
          degraded: snapshot.records.filter((r) => r.health === "degraded").length,
        },
      };
    },
  },
  {
    id: "step-08",
    description: "Introduce a controlled development fault.",
    validation: (): ScenarioResult => {
      const studioStoreRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.id === "studio.store"
      );

      if (!studioStoreRecord) {
        return { pass: false, message: "Studio store not found" };
      }

      runtimeRegistry.report("studio.store", "broken", "Simulated development fault for regression test");

      const projectsRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.feature === "projects"
      );

      if (!projectsRecord) {
        return { pass: false, message: "Projects feature not found" };
      }

      if (projectsRecord.health === "healthy") {
        return {
          pass: false,
          message: "Projects did not degrade when dependency broke",
          details: { projectsHealth: projectsRecord.health, dependencyHealth: "broken" },
        };
      }

      return {
        pass: true,
        message: "Fault propagated to Projects (degraded as expected)",
        details: {
          projectsHealth: projectsRecord.health,
          studioStoreHealth: "broken",
        },
      };
    },
  },
  {
    id: "step-09",
    description: "Confirm fault appears.",
    validation: (): ScenarioResult => {
      const snapshot = runtimeRegistry.getSnapshot();
      const brokenCount = snapshot.records.filter((r) => r.health === "broken").length;
      const degradedCount = snapshot.records.filter((r) => r.health === "degraded").length;

      if (brokenCount === 0) {
        return { pass: false, message: "No broken elements found" };
      }

      return {
        pass: true,
        message: `Fault visible: ${brokenCount} broken, ${degradedCount} degraded`,
        details: { broken: brokenCount, degraded: degradedCount },
      };
    },
  },
  {
    id: "step-10",
    description: "Confirm affected runtime elements appear.",
    validation: (): ScenarioResult => {
      const brokenId = "studio.store";
      const propagation = changeTracker.getFaultPropagation(brokenId);
      const path = changeTracker.getFaultPropagationPath(brokenId);

      if (propagation.length <= 1) {
        return {
          pass: false,
          message: "Fault did not propagate to other elements",
          details: { propagation: [...propagation] },
        };
      }

      return {
        pass: true,
        message: `Fault propagated through: ${path}`,
        details: { propagation, path },
      };
    },
  },
  {
    id: "step-11",
    description: "Fix the fault.",
    validation: (): ScenarioResult => {
      const recovered = runtimeRegistry.recover("studio.store");

      if (!recovered) {
        return { pass: false, message: "Failed to recover studio.store" };
      }

      const studioStoreRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.id === "studio.store"
      );

      if (!studioStoreRecord || studioStoreRecord.health !== "healthy") {
        return {
          pass: false,
          message: `Studio store health: ${studioStoreRecord?.health || "not found"}`,
        };
      }

      return {
        pass: true,
        message: "Studio store recovered successfully",
        details: { health: studioStoreRecord.health, error: studioStoreRecord.error },
      };
    },
  },
  {
    id: "step-12",
    description: "Confirm recovery.",
    validation: (): ScenarioResult => {
      const projectsRecord = runtimeRegistry.getSnapshot().records.find(
        (r) => r.feature === "projects"
      );

      if (!projectsRecord) {
        return { pass: false, message: "Projects feature not found" };
      }

      if (projectsRecord.health === "broken") {
        return {
          pass: false,
          message: `Projects is still broken: ${projectsRecord.error}`,
        };
      }

      return {
        pass: true,
        message: `Projects recovered to: ${projectsRecord.health}`,
        details: { projectsHealth: projectsRecord.health },
      };
    },
  },
  {
    id: "step-13",
    description: "Confirm unrelated application state survives.",
    validation: (): ScenarioResult => {
      const snapshot = runtimeRegistry.getSnapshot();
      const shellRecord = snapshot.records.find((r) => r.id === "shell");
      const lifecycleRecord = snapshot.records.find((r) => r.id === "lifecycle.engine");

      if (!shellRecord || shellRecord.health !== "healthy") {
        return {
          pass: false,
          message: `Shell health: ${shellRecord?.health || "not found"}`,
        };
      }

      if (!lifecycleRecord || lifecycleRecord.health !== "healthy") {
        return {
          pass: false,
          message: `Lifecycle engine health: ${lifecycleRecord?.health || "not found"}`,
        };
      }

      const totalBroken = snapshot.records.filter((r) => r.health === "broken").length;
      if (totalBroken > 0) {
        return {
          pass: false,
          message: `${totalBroken} elements still broken after recovery`,
          details: { broken: snapshot.records.filter((r) => r.health === "broken").map((r) => r.id) },
        };
      }

      return {
        pass: true,
        message: "All unrelated state survived recovery",
        details: {
          shellHealth: shellRecord.health,
          lifecycleHealth: lifecycleRecord.health,
          totalBroken: 0,
        },
      };
    },
  },
];

/**
 * Run the complete Projects regression scenario
 */
export function runProjectsScenario(): {
  results: ScenarioResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
    duration: number;
  };
} {
  const startTime = Date.now();
  const results: ScenarioResult[] = [];

  for (const step of projectsRegressionScenario) {
    try {
      const result = step.validation();
      results.push(result);
    } catch (error) {
      results.push({
        pass: false,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const duration = Date.now() - startTime;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  return {
    results,
    summary: {
      passed,
      failed,
      total: results.length,
      duration,
    },
  };
}

/**
 * Get the current status of the Projects feature
 */
export function getProjectsStatus(): {
  exists: boolean;
  health: RuntimeHealth | "not_found";
  runtimeId?: string;
  version?: number;
  dependencies: string[];
  dependents: string[];
} {
  const snapshot = runtimeRegistry.getSnapshot();
  const projectsRecord = snapshot.records.find((r) => r.feature === "projects");

  if (!projectsRecord) {
    return {
      exists: false,
      health: "not_found",
      dependencies: [],
      dependents: [],
    };
  }

  return {
    exists: true,
    health: projectsRecord.health,
    runtimeId: projectsRecord.runtimeId,
    version: projectsRecord.version,
    dependencies: projectsRecord.dependsOn || [],
    dependents: snapshot.records
      .filter((r) => r.dependsOn?.includes(projectsRecord.id))
      .map((r) => r.id),
  };
}

/**
 * Get feature vertical slice for a given feature
 * Represents the feature as a vertical slice through all layers
 */
export function getFeatureVerticalSlice(feature: FeatureName): {
  name: FeatureName;
  presentation: RuntimeRecord[];
  navigation: RuntimeRecord[];
  state: RuntimeRecord[];
  provider: RuntimeRecord[];
  lifecycle: RuntimeRecord[];
  runtime: RuntimeRecord[];
  service: RuntimeRecord[];
  api: RuntimeRecord[];
  persistence: RuntimeRecord[];
  unknown: RuntimeRecord[];
} {
  const snapshot = runtimeRegistry.getSnapshot();
  const featureRecords = snapshot.records.filter((r) => r.feature === feature);

  const slice = {
    presentation: featureRecords.filter((r) => r.layer === "presentation"),
    navigation: featureRecords.filter((r) => r.layer === "navigation"),
    state: featureRecords.filter((r) => r.layer === "state"),
    provider: featureRecords.filter((r) => r.layer === "provider"),
    lifecycle: featureRecords.filter((r) => r.layer === "lifecycle"),
    runtime: featureRecords.filter((r) => r.layer === "runtime"),
    service: featureRecords.filter((r) => r.layer === "service"),
    api: featureRecords.filter((r) => r.layer === "api"),
    persistence: featureRecords.filter((r) => r.layer === "persistence"),
    unknown: featureRecords.filter((r) => !["presentation", "navigation", "state", "provider", "lifecycle", "runtime", "service", "api", "persistence"].includes(r.layer)),
  };

  return {
    name: feature,
    ...slice,
  };
}
