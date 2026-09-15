export type RuntimeLayer = "presentation" | "navigation" | "state" | "provider" | "service" | "api" | "persistence" | "lifecycle" | "runtime";
export type RuntimeHealth = "healthy" | "degraded" | "broken" | "unknown";
export type FeatureName = "shell" | "home" | "projects" | "navigation" | "lifecycle" | "studio" | "theme" | "runtime" | "unknown";

export type RuntimeElement = {
  id: string;
  label: string;
  layer: RuntimeLayer;
  source?: string;
  symbol?: string;
  feature?: FeatureName;
  runtimeId?: string;
  dependsOn?: string[];
  affects?: string[];
  detail?: string;
};

export type RuntimeRecord = RuntimeElement & {
  active: boolean;
  health: RuntimeHealth;
  changedAt: number;
  error?: string;
  version: number;
};

export type ChangeEvent = {
  id: string;
  type: "register" | "unregister" | "health_change" | "refresh";
  timestamp: number;
  from?: RuntimeHealth;
  to?: RuntimeHealth;
  moduleId?: string;
  consequence?: string;
};

export type RuntimeSnapshot = {
  records: RuntimeRecord[];
  revision: number;
  lastChange?: ChangeEvent;
};

type Listener = () => void;

class RuntimeRegistry {
  private records = new Map<string, RuntimeRecord>();
  private listeners = new Set<Listener>();
  private revision = 0;
  private changeLog: ChangeEvent[] = [];
  private snapshot: RuntimeSnapshot = { records: [], revision: 0 };

  register(element: RuntimeElement) {
    const previous = this.records.get(element.id);
    const version = previous ? previous.version + 1 : 1;
    const newRecord: RuntimeRecord = {
      ...previous,
      ...element,
      active: true,
      health: previous?.health ?? "healthy",
      changedAt: Date.now(),
      error: undefined,
      version,
    };
    this.records.set(element.id, newRecord);
    this.logChange({
      id: element.id,
      type: previous ? "refresh" : "register",
      timestamp: Date.now(),
      from: previous?.health,
      to: newRecord.health,
      moduleId: element.source,
      consequence: previous ? "Module instance replaced, runtime identity preserved" : "New runtime element registered",
    });
    this.publish();
    return () => {
      const current = this.records.get(element.id);
      if (current) {
        this.records.set(element.id, { ...current, active: false, changedAt: Date.now() });
        this.logChange({
          id: element.id,
          type: "unregister",
          timestamp: Date.now(),
          from: current.health,
          moduleId: current.source,
          consequence: "Runtime element unregistered",
        });
        this.publish();
      }
    };
  }

  report(id: string, health: RuntimeHealth, error?: string) {
    const current = this.records.get(id);
    if (!current) return;
    if (current.health === health && current.error === error) return;
    const version = current.version + 1;
    this.records.set(id, { ...current, health, error, changedAt: Date.now(), version });
    this.logChange({
      id,
      type: "health_change",
      timestamp: Date.now(),
      from: current.health,
      to: health,
      moduleId: current.source,
      consequence: error || `Health transition: ${current.health} -> ${health}`,
    });
    this.publish();
  }

  recover(id: string): boolean {
    const current = this.records.get(id);
    if (!current) return false;
    if (current.health === "healthy") return true;
    const version = current.version + 1;
    this.records.set(id, { ...current, health: "healthy", error: undefined, changedAt: Date.now(), version });
    this.logChange({
      id,
      type: "health_change",
      timestamp: Date.now(),
      from: current.health,
      to: "healthy",
      moduleId: current.source,
      consequence: "Explicit recovery - state preserved",
    });
    this.publish();
    return true;
  }

  getChangeLog(): ChangeEvent[] {
    return [...this.changeLog];
  }

  getLastChange(): ChangeEvent | undefined {
    return this.changeLog[this.changeLog.length - 1];
  }

  getByFeature(feature: FeatureName): RuntimeRecord[] {
    return Array.from(this.records.values())
      .filter((record) => record.feature === feature);
  }

  getRuntimeId(id: string): string | undefined {
    const record = this.records.get(id);
    return record?.runtimeId;
  }

  getDependencies(id: string): RuntimeRecord[] {
    const record = this.records.get(id);
    if (!record?.dependsOn) return [];
    return record.dependsOn
      .map((depId) => this.records.get(depId))
      .filter((r): r is RuntimeRecord => Boolean(r));
  }

  getDependents(id: string): RuntimeRecord[] {
    return Array.from(this.records.values())
      .filter((record) => record.dependsOn?.includes(id));
  }

  getAffectedBy(id: string): RuntimeRecord[] {
    const record = this.records.get(id);
    if (!record?.affects) return [];
    return record.affects
      .map((affectedId) => this.records.get(affectedId))
      .filter((r): r is RuntimeRecord => Boolean(r));
  }

  getSnapshot = (): RuntimeSnapshot => this.snapshot;
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  private logChange(event: ChangeEvent) {
    this.changeLog.push(event);
    if (this.changeLog.length > 100) this.changeLog.shift();
  }

  private publish() {
    this.revision += 1;
    this.snapshot = {
      records: Array.from(this.records.values()).sort((a, b) => a.label.localeCompare(b.label)),
      revision: this.revision,
      lastChange: this.changeLog[this.changeLog.length - 1],
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const runtimeRegistry = new RuntimeRegistry();
