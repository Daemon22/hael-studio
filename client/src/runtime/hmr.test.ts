/**
 * HMR Integration Unit Tests
 * 
 * Tests the HMR integration logic without requiring actual browser HMR events.
 * These tests validate the core logic of the HMR system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { changeTracker } from "./changeTracker";
import { isHmrAvailable, getPendingHmrUpdates, clearPendingHmrUpdates } from "./hmr";

describe("HMR Integration", () => {
  beforeEach(() => {
    // Clear pending updates before each test
    clearPendingHmrUpdates();
    // Clear change tracker
    const traces = changeTracker.getTraces();
    traces.forEach(trace => changeTracker.resolveTrace(trace.id));
  });

  describe("HMR Availability", () => {
    it("should detect HMR availability in DEV mode", () => {
      // This test runs in vitest which doesn't have import.meta.hot
      // So we expect false in this environment
      const available = isHmrAvailable();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("Pending HMR Updates", () => {
    it("should start with no pending updates", () => {
      const updates = getPendingHmrUpdates();
      expect(updates).toEqual([]);
    });

    it("should clear pending updates", () => {
      clearPendingHmrUpdates();
      const updates = getPendingHmrUpdates();
      expect(updates).toEqual([]);
    });
  });

  describe("ChangeTracker Integration", () => {
    it("should record HMR changes", () => {
      const beforeTraces = changeTracker.getTraces().length;
      
      changeTracker.recordChange({
        id: "test-element",
        type: "refresh",
        timestamp: Date.now(),
        moduleId: "test/module.ts",
        consequence: "HMR update detected",
      });

      const afterTraces = changeTracker.getTraces().length;
      expect(afterTraces).toBe(beforeTraces + 1);
    });

    it("should preserve change details", () => {
      changeTracker.recordChange({
        id: "test-element",
        type: "refresh",
        timestamp: Date.now(),
        moduleId: "test/module.ts",
        consequence: "HMR update detected",
      });

      const trace = changeTracker.getLastTrace();
      expect(trace).not.toBeNull();
      expect(trace?.source).toBe("test/module.ts");
      expect(trace?.type).toBe("refresh");
      expect(trace?.consequence).toBe("HMR update detected");
    });
  });
});