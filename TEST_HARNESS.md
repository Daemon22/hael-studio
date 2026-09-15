# HAEL Studio - Test Harness & Validation Guide

## Purpose

This document provides instructions for manually testing the Live Construction Environment in a real browser. Since automated CDP/Edge harness does not exist in the codebase, this guide enables validation through manual testing.

---

## Prerequisites

- Node.js installed
- `npm run dev` starts development server
- Modern browser (Chrome, Edge, Firefox) with DevTools
- Familiarity with Vite Fast Refresh behavior

---

## Test 1: StateEngine Integration (P0 Item 1)

### Objective
Verify that StudioProvider state survives Fast Refresh when studioStore.tsx is edited.

### Setup
1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:5173`
3. Open DevTools → Console
4. Open DevRuntimeInspector (click "Live" button in bottom-right)

### Steps
1. **Verify initial state**:
   - Confirm application loads
   - In inspector, select "studio.store"
   - Verify: mode=compose, selectedNodeId=intention, artifact exists
   - Note: runtimeId should be "state.studio"

2. **Trigger lifecycle**:
   - Wait for lifecycle to progress from icon → launching → entry → running
   - Or click around to ensure state is active

3. **Edit studioStore.tsx**:
   - Open `client/src/state/studioStore.tsx` in your editor
   - Add a harmless comment (e.g., `// test` at the top)
   - Save the file

4. **Observe Fast Refresh**:
   - Browser should update without full reload
   - Application should remain functional

5. **Verify state preservation**:
   - In DevRuntimeInspector, select "studio.store"
   - Check mode: Should be **compose** (not reset)
   - Check selectedNodeId: Should be **intention** (not reset)
   - Check runtimeId: Should be **state.studio** (same as before)
   - Check version: Should be **>= 1** (incremented)

### Expected Result
✅ **PASS**: All state preserved across Fast Refresh
❌ **FAIL**: State was reset (mode, selectedNodeId lost)

### Debugging
If FAIL:
- Check console for errors
- Verify `isHmrAvailable()` returns true
- Check if StateEngine singleton is preserved (add `console.log(getStateEngine())` in studioStore.tsx)

---

## Test 2: Automatic Re-registration (P0 Item 3)

### Objective
Verify that runtime elements re-register with same runtimeId on Fast Refresh.

### Setup
1. Start dev server
2. Open DevRuntimeInspector
3. Select "projects" element
4. Note runtimeId: Should be "feature.projects"

### Steps
1. **Edit Home.tsx** (where Projects element is defined):
   - Open `client/src/pages/Home.tsx`
   - Add a harmless comment
   - Save

2. **Observe Fast Refresh**:
   - Application updates without reload

3. **Verify re-registration**:
   - In DevRuntimeInspector, check "projects" element
   - runtimeId should still be **"feature.projects"**
   - version should be **incremented**
   - health should be **healthy**
   - Last change should show "Re-registered after HMR update"

### Expected Result
✅ **PASS**: runtimeId preserved, version incremented
❌ **FAIL**: runtimeId changed or element missing

### Debugging
If FAIL:
- Check if `setupAutoReRegistration()` is called
- Verify HMR hooks are registered for Home.tsx
- Check console for HMR event logs

---

## Test 3: ChangeTracker HMR Detection (P0 Item 2)

### Objective
Verify that ChangeTracker automatically records HMR events.

### Setup
1. Start dev server
2. Open DevRuntimeInspector
3. Note current change log is empty (or has initialization entries)

### Steps
1. **Edit any registered module**:
   - Edit `client/src/components/ModeNav.tsx`
   - Add a comment, save

2. **Check ChangeTracker**:
   - In DevRuntimeInspector, look for change information
   - Or check: `changeTracker.getTraces()` in console

3. **Verify trace**:
   - Should have a trace with type="refresh"
   - Should reference the edited module
   - Should have timestamp

### Expected Result
✅ **PASS**: ChangeTracker has HMR trace
❌ **FAIL**: No trace found

### Debugging
If FAIL:
- Check if `initializeRuntimeHmr()` is called
- Verify `import.meta.hot` is available
- Check if `registerHmrModule()` is working

---

## Test 4: Full Canonical Scenario (P0 Items 1-4 Combined)

### This tests the complete workflow from objective #5

### Steps

1. **Open application**
   - Start dev server
   - Open browser
   - ✅ Verify: Application loads, all elements registered

2. **Confirm Projects feature is live**
   - Open DevRuntimeInspector
   - Select "projects" or use feature view
   - ✅ Verify: Projects exists, health=healthy

3. **Inspect runtime identity**
   - Select "projects" in inspector
   - ✅ Verify: runtimeId="feature.projects"

4. **Inspect source**
   - In inspector detail view
   - ✅ Verify: source="client/src/pages/Home.tsx"

5. **Inspect dependencies**
   - In inspector detail view
   - ✅ Verify: dependsOn=["studio.store", "lifecycle.engine"]

6. **Move app into non-initial lifecycle state**
   - Wait for lifecycle to progress to "running"
   - Or trigger interactions
   - ✅ Verify: lifecycle.state !== "icon"

7. **Edit Projects presentation module**
   - Edit `client/src/pages/Home.tsx`
   - Add a harmless comment
   - Save
   - ✅ Verify: Fast Refresh occurs (no full reload)

8. **Verify lifecycle intact**
   - In inspector, check lifecycle.engine
   - ✅ Verify: health=healthy, state preserved

9. **Verify runtime identity stable**
   - Select "projects" in inspector
   - ✅ Verify: runtimeId still "feature.projects"

10. **Verify feature healthy**
    - Check projects health
    - ✅ Verify: health=healthy or degraded (not broken)

11. **Verify ChangeTracker records change**
    - Check change info in inspector
    - ✅ Verify: Change recorded with type="refresh"

12. **Verify affected entities identified**
    - Check projects dependencies
    - ✅ Verify: Dependencies still visible

13. **Fix/revert change**
    - Remove the comment from Home.tsx
    - Save
    - ✅ Verify: Fast Refresh, state preserved

14. **Verify recovery**
    - Check all elements
    - ✅ Verify: No broken elements

15. **Verify unrelated state survives**
    - Check shell, lifecycle.engine, theme.provider
    - ✅ Verify: All healthy, state intact

### Scoring
- 15/15 = ✅ **PASS** - Full Live Construction Environment
- 10-14/15 = ⚠️ **PARTIAL** - Mostly working
- <10/15 = ❌ **FAIL** - Significant gaps

---

## Test 5: Fault Propagation (P0 Item 6)

### Objective
Verify that faults propagate through dependency graph.

### Setup
1. Start dev server
2. Open DevRuntimeInspector
3. Note all elements are healthy

### Steps
1. **Inject fault manually**:
   - In console: `runtimeRegistry.report("studio.store", "broken", "Test fault")`

2. **Verify fault appears**:
   - ✅ Verify: studio.store health=broken
   - ✅ Verify: Overall health shows broken

3. **Verify propagation**:
   - Check "projects" (depends on studio.store)
   - ✅ Verify: projects health=degraded
   - Check "home" (depends on studio.store)
   - ✅ Verify: home health=degraded

4. **Verify inspector shows propagation**:
   - Select studio.store
   - Check "Affected" section
   - ✅ Verify: Shows projects, home as affected

5. **Recover**:
   - In console: `runtimeRegistry.recover("studio.store")`
   - ✅ Verify: studio.store health=healthy
   - ✅ Verify: projects/home return to healthy

### Expected Result
✅ **PASS**: Fault propagates and recovers
❌ **FAIL**: Fault doesn't propagate or propagate incorrectly

---

## Test 6: Runtime Identity Across Full Workflow

### Objective
Verify runtimeId remains stable through multiple Fast Refresh cycles.

### Steps
1. Start dev server
2. Note runtimeId for key elements:
   - shell: "feature.shell"
   - home: "feature.home"
   - projects: "feature.projects"
   - studio.store: "state.studio"
   - lifecycle.engine: "lifecycle.engine"

3. **Edit ModeNav.tsx**:
   - Add comment, save
   - ✅ Verify: navigation runtimeId still "feature.navigation"

4. **Edit Home.tsx**:
   - Add comment, save
   - ✅ Verify: home runtimeId still "feature.home"
   - ✅ Verify: projects runtimeId still "feature.projects"

5. **Edit studioStore.tsx**:
   - Add comment, save
   - ✅ Verify: studio.store runtimeId still "state.studio"

6. **Multiple rapid edits**:
   - Edit several files in quick succession
   - ✅ Verify: All runtimeIds preserved

### Expected Result
✅ **PASS**: All runtimeIds stable
❌ **FAIL**: Any runtimeId changed or lost

---

## Console Helpers

Add these to console for debugging:

```javascript
// Get current state
const engine = window.getStateEngine?.();
engine?.getFullState();

// Check HMR status
window.isHmrAvailable?.();

// Get pending HMR updates
window.getPendingHmrUpdates?.();

// Check runtime registry
const registry = window.runtimeRegistry;
registry.getSnapshot();

// Get change traces
const tracker = window.changeTracker;
tracker.getTraces();

// Get feature vertical slice
window.getFeatureVerticalSlice?.("projects");

// Run regression scenario
window.runProjectsScenario?.();
```

---

## Expected Results Summary

| Test | P0 Item | Expected | Actual |
|------|---------|----------|--------|
| StateEngine Integration | 1 | PASS | ⬜ |
| HMR Detection | 2 | PASS | ⬜ |
| Auto Re-registration | 3 | PASS | ⬜ |
| Full Canonical Scenario | All | PASS | ⬜ |
| Fault Propagation | 6 | PASS | ⬜ |
| Runtime Identity | All | PASS | ⬜ |

---

## How to Record Results

Create a `TEST_RESULTS.md` file with:

```markdown
# Test Results - [Date]

## Environment
- Browser: [Chrome/Edge/Firefox] [Version]
- Node: [Version]
- OS: [Windows/macOS/Linux]

## Results

### Test 1: StateEngine Integration
- Status: PASS/FAIL
- Notes: [details]

### Test 2: Automatic Re-registration
- Status: PASS/FAIL
- Notes: [details]

### Test 3: ChangeTracker HMR Detection
- Status: PASS/FAIL
- Notes: [details]

### Test 4: Full Canonical Scenario
- Score: [X/15]
- Notes: [details]

### Test 5: Fault Propagation
- Status: PASS/FAIL
- Notes: [details]

### Test 6: Runtime Identity
- Status: PASS/FAIL
- Notes: [details]

## Overall Status
- [ ] YES - All tests PASS
- [ ] PARTIALLY - Some tests PASS
- [ ] NO - Most tests FAIL
```

---

## After Testing

1. **If all PASS**: Update `ARCHITECTURAL_REPORT` answer to **YES**
2. **If PARTIALLY**: Document which items failed and why
3. **If NO**: Identify root causes and fix

Update `INTEGRATION_AUDIT.md` with actual browser test results.

---

## Notes

- All HMR code is gated by `import.meta.env.DEV && import.meta.hot`
- In production builds, HMR code is tree-shaken away
- StateEngine singleton relies on Vite preserving module state on Fast Refresh
- If module is fully reloaded (not preserved), singleton may be reset
