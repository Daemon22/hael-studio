# Real Browser HMR Test Protocol

## Vite HMR API Correction

**Previous Error**: The previous implementation incorrectly replaced `import.meta.hot.on()` with `import.meta.hot.accept()`.

**Correct Understanding**:
- `import.meta.hot.accept()` is for **self-accepting modules** (modules that handle their own HMR updates)
- `import.meta.hot.on()` is for **listening to global HMR events** like `'vite:beforeUpdate'` and `'vite:afterUpdate'`

**Current Implementation**: Uses `import.meta.hot.on('vite:beforeUpdate')` and `import.meta.hot.on('vite:afterUpdate')` to observe all module changes globally, which is the correct approach for Hael Studio's use case.

## Browser Testing Protocol

### Step 1: Launch Application
```bash
npm run dev
```
Open browser to `http://localhost:3000`
Open DevTools → Console

### Step 2: Establish Baseline
```javascript
// In browser console
const baseline = window.captureHmrBaseline();
console.log('Baseline captured:', baseline);
```

Expected baseline should show:
- All 9 runtime elements registered
- StateEngine state: mode="compose", selectedNodeId="intention"
- ChangeTracker count: minimal (initial registration events)
- Pending HMR count: 0

### Step 3: Test HMR Detection - Harmless Edit
1. Edit `client/src/components/ModeNav.tsx`
2. Add a harmless comment: `// HMR test v1`
3. Save the file
4. Watch browser console for HMR events

Expected console output:
- Vite HMR logs (automatic)
- No custom HMR logs from our system (we use global listeners)

### Step 4: Inspect HMR State
```javascript
// In browser console
const comparison = window.compareHmrBaseline(baseline);
console.log('HMR comparison:', comparison);
```

Expected observations:
- `newHmrUpdates` should be > 0 if our listeners caught the event
- `runtimeChanges` should show version increments for affected elements
- `newTraces` should show ChangeTracker recorded the event

### Step 5: Test Critical State Preservation (studioStore.tsx)
1. Establish new baseline: `const baseline2 = window.captureHmrBaseline();`
2. Edit `client/src/state/studioStore.tsx`
3. Add a harmless comment: `// State preservation test`
4. Save the file
5. Compare: `const comparison2 = window.compareHmrBaseline(baseline2);`

Critical verification:
- Application should remain running (no full reload)
- StateEngine should exist: `window.getStateEngine()`
- State values should be preserved: mode="compose", selectedNodeId="intention"
- Runtime identities should be preserved
- No duplicate registrations

### Step 6: Test Automatic Re-registration
1. Focus on "navigation" element (from ModeNav.tsx)
2. Note its version: baseline.runtimeRecords.find(r => r.id === "navigation").version
3. Edit ModeNav.tsx again with different comment
4. Check if navigation version incremented
5. Verify runtimeId remained "feature.navigation"

### Step 7: Test Failure and Recovery
```javascript
// In browser console
window.runtimeRegistry.report("studio.store", "broken", "Test failure");
```

Expected:
- DevRuntimeInspector should show "studio.store" as broken
- Dependent elements (projects, home) should show as degraded
- Console logs should show propagation

Recovery:
```javascript
window.runtimeRegistry.recover("studio.store");
```

Expected:
- All elements should return to healthy
- No corruption of unrelated state

### Step 8: Verify HMR After Recovery
1. Make another harmless edit to any module
2. Verify HMR still works
3. Check for listener accumulation

## Acceptance Criteria

### HMR Observation
- ✅ Real file modification produces actual Vite HMR event
- ✅ Our global listeners catch the event via `vite:beforeUpdate` or `vite:afterUpdate`
- ✅ Event payload contains module path information

### Change Tracking
- ✅ Real event reaches ChangeTracker without manual `recordChange()` call
- ✅ ChangeTracker trace shows correct module ID and event type

### Runtime Update
- ✅ Affected runtime element is correctly identified via module path matching
- ✅ Version increments on re-registration

### State Preservation
- ✅ StateEngine state survives HMR when studioStore.tsx is edited
- ✅ Application remains running without full reload
- ✅ Runtime identities remain stable

### Identity Preservation
- ✅ Runtime IDs do not duplicate or unexpectedly change
- ✅ No unexpected registration count increases

### Cleanup
- ✅ Repeated HMR updates do not accumulate duplicate listeners
- ✅ Cleanup functions properly remove listeners

### Recovery
- ✅ Controlled failure can be detected and recovered
- ✅ Recovery does not corrupt unrelated runtime state

## Diagnostic Commands

```javascript
// Check HMR availability
window.isHmrAvailable()

// Check pending HMR updates
window.getPendingHmrUpdates()

// Check ChangeTracker traces
window.changeTracker.getTraces()

// Check runtime registry
window.runtimeRegistry.getSnapshot()

// Check StateEngine state
window.getStateEngine().getFullState()

// Capture baseline for comparison
const baseline = window.captureHmrBaseline();

// Compare after HMR
const comparison = window.compareHmrBaseline(baseline);
```

## Expected vs Actual

If any step fails, document:
1. What was expected
2. What actually happened
3. Console error messages
4. Browser behavior (reload vs HMR)
5. State before and after comparison

This will identify the exact architectural gap that needs to be addressed.