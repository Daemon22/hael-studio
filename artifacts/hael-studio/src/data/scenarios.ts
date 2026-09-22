import type { RuntimeScenario } from "@workspace/api-client-react";

export type CanonicalScenario = {
  id: string;
  title: string;
  description: string;
  duration: number;
  events: RuntimeScenario["events"];
};

export function normalizeScenarios(value: unknown): RuntimeScenario[] {
  if (Array.isArray(value)) return value as RuntimeScenario[];
  if (value && typeof value === "object") {
    const record = value as { scenarios?: RuntimeScenario[]; data?: RuntimeScenario[] };
    if (Array.isArray(record.scenarios)) return record.scenarios;
    if (Array.isArray(record.data)) return record.data;
  }
  return [];
}
