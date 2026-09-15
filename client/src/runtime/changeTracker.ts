/**
 * Change-to-Consequence Tracker
 * 
 * Tracks development changes and their immediate runtime consequences.
 * This provides runtime awareness of what changed and what the effect was.
 */

import { runtimeRegistry } from "./registry";
import type { RuntimeRecord, ChangeEvent } from "./registry";

interface ChangeTrace {
  id: string;
  changeId: string;
  source: string;
  type: "edit" | "refresh" | "error" | "recovery";
  timestamp: number;
  consequence: string;
  affectedIds: string[];
  healthImpact: Map<string, { from: string; to: string }>;
  resolved: boolean;
  resolutionTime?: number;
}

class ChangeTracker {
  private traces: ChangeTrace[] = [];
  private activeTrace: ChangeTrace | null = null;
  private pendingChanges = new Set<string>();

  recordChange(event: ChangeEvent): ChangeTrace {
    const trace: ChangeTrace = {
      id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      changeId: event.id,
      source: event.moduleId || "unknown",
      type: this.mapEventToType(event),
      timestamp: event.timestamp,
      consequence: event.consequence || "",
      affectedIds: [],
      healthImpact: new Map(),
      resolved: false,
    };

    this.traces.push(trace);
    this.activeTrace = trace;

    // Cleanup old traces
    if (this.traces.length > 50) {
      this.traces.shift();
    }

    return trace;
  }

  updateTrace(traceId: string, updates: Partial<ChangeTrace>): ChangeTrace | null {
    const trace = this.traces.find((t) => t.id === traceId);
    if (!trace) return null;
    Object.assign(trace, updates);
    return trace;
  }

  resolveTrace(traceId: string): ChangeTrace | null {
    const trace = this.updateTrace(traceId, {
      resolved: true,
      resolutionTime: Date.now(),
    });
    if (trace && this.activeTrace?.id === traceId) {
      this.activeTrace = null;
    }
    return trace;
  }

  getActiveTrace(): ChangeTrace | null {
    return this.activeTrace;
  }

  getTraces(): ChangeTrace[] {
    return [...this.traces];
  }

  getLastTrace(): ChangeTrace | null {
    return this.traces[this.traces.length - 1] || null;
  }

  getTraceForId(id: string): ChangeTrace | null {
    return this.traces.find((t) => t.changeId === id && t.affectedIds.includes(id)) || null;
  }

  getTracesAffectingId(id: string): ChangeTrace[] {
    return this.traces.filter((t) => t.affectedIds.includes(id));
  }

  analyzeConsequence(record: RuntimeRecord): { type: string; message: string } {
    if (record.health === "broken") {
      return {
        type: "error",
        message: `Runtime element '${record.id}' is broken: ${record.error || "Unknown error"}`,
      };
    }
    if (record.health === "degraded") {
      return {
        type: "degradation",
        message: `Runtime element '${record.id}' is degraded: a dependency may be broken`,
      };
    }
    return {
      type: "healthy",
      message: `Runtime element '${record.id}' is healthy`,
    };
  }

  getFaultPropagation(startId: string): string[] {
    const propagation: string[] = [startId];
    const visited = new Set<string>([startId]);
    const snapshot = runtimeRegistry.getSnapshot();

    // BFS through dependents to find propagation chain
    const queue = [startId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const dependents = snapshot.records.filter((r) => r.dependsOn?.includes(currentId));
      for (const dependent of dependents) {
        if (!visited.has(dependent.id) && dependent.health !== "healthy") {
          visited.add(dependent.id);
          propagation.push(dependent.id);
          queue.push(dependent.id);
        }
      }
    }

    return propagation;
  }

  getFaultPropagationPath(startId: string): string {
    const chain = this.getFaultPropagation(startId);
    const snapshot = runtimeRegistry.getSnapshot();
    const labels = chain.map((id) => {
      const record = snapshot.records.find((r) => r.id === id);
      return record ? record.label : id;
    });
    return labels.join(" → ");
  }

  getRecoveryPath(brokenId: string): string[] {
    const snapshot = runtimeRegistry.getSnapshot();
    const record = snapshot.records.find((r) => r.id === brokenId);
    if (!record) return [];

    // Find all records that depend on this broken one
    const affected = snapshot.records.filter((r) => r.dependsOn?.includes(brokenId));
    return [brokenId, ...affected.map((r) => r.id)];
  }

  stagePendingChange(moduleId: string): void {
    this.pendingChanges.add(moduleId);
  }

  clearPendingChange(moduleId: string): void {
    this.pendingChanges.delete(moduleId);
  }

  hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  getPendingChanges(): string[] {
    return Array.from(this.pendingChanges);
  }

  private mapEventToType(event: ChangeEvent): "edit" | "refresh" | "error" | "recovery" {
    switch (event.type) {
      case "register":
        return "edit";
      case "refresh":
        return "refresh";
      case "unregister":
        return "refresh";
      case "health_change":
        if (event.to === "healthy" && event.from !== "healthy") {
          return "recovery";
        }
        if (event.to === "broken" || event.to === "degraded") {
          return "error";
        }
        return "edit";
      default:
        return "edit";
    }
  }
}

export const changeTracker = new ChangeTracker();
