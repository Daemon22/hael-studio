# HMR Integration Validation Instructions

## Implementation Summary

**What was changed:**
1. Fixed `hmr.ts` to use Vite's actual HMR API (`import.meta.hot.accept()` instead of incorrect `import.meta.hot.on()`)
2. Added proper HMR acceptance in `DevRuntime.tsx` with ChangeTracker integration
3. Added HMR acceptance in `studioStore.tsx` with console logging
4. Connected HMR events to ChangeTracker for automatic recording
5. Fixed the automatic re-registration logic to use correct disposal handling

## Manual Browser Testing Steps

### Step 1: Launch Application
1. Ensure dev server is running: `npm run dev`
2. Open browser to `http://localhost:3000`
3. Open DevTools → Console
4. Open DevRuntimeInspector (click "Live" button in bottom-right)

### Step 2: Verify Initial State
1. In console, run: `window.isHmrAvailable()` → should return `true`
2. In console, run: `window.getPendingHmrUpdates()` → should return `[]`
3. In DevRuntimeInspector, verify all 9 runtime elements are registered and healthy
4. Note the current version numbers for key elements (e.g., projects, home, studio.store)

### Step 3: Test HMR Detection
1. Edit `client/src/components/ModeNav.tsx` (add a harmless comment like `// HMR test`)
2. Save the file
3. In browser console, look for: `[DevRuntime] HMR update detected - DevRuntime module reloaded`
4. In console, run: `window.getPendingHmrUpdates()` → should show the update
5. In DevRuntimeInspector, check if the "navigation" element version incremented
6. In console, run: `window.changeTracker.getTraces()` → should show a new trace with type="refresh"

### Step 4: Test State Preservation
1. In DevRuntimeInspector, note the current `studio.store` state (mode, selectedNodeId)
2. Edit `client/src/pages/Home.tsx` (add a harmless comment)
3. Save the file
4. In browser console, verify: `[StudioProvider] HMR update detected - studioStore module reloaded`
5. In DevRuntimeInspector, verify `studio.store` state is preserved (mode should remain "compose", selectedNodeId should remain "intention")
6. Verify lifecycle.engine remains healthy

### Step 5: Test ChangeTracker Integration
1. In console, run: `window.changeTracker.getLastTrace()`
2. Should show a trace with:
   - type: "refresh"
   - source: the edited module path
   - consequence: describing the HMR event
3. Verify the trace has a proper timestamp

### Step 6: Test Failure/Recovery
1. In console, run: `window.runtimeRegistry.report("studio.store", "broken", "Test failure")`
2. In DevRuntimeInspector, verify "studio.store" shows as "broken"
3. Verify dependent elements (projects, home) show as "degraded"
4. In console, run: `window.runtimeRegistry.recover("studio.store")`
5. In DevRuntimeInspector, verify all elements return to "healthy"

## Expected Results

### Success Criteria
- ✅ HMR events are detected when modules are edited
- ✅ ChangeTracker automatically records HMR events
- ✅ Console logs show HMR detection messages
- ✅ Runtime element versions increment on HMR
- ✅ StateEngine state is preserved when studioStore.tsx is edited
- ✅ Failure propagation works correctly
- ✅ Recovery works correctly

### Failure Indicators
- ❌ No console logs when modules are edited
- ❌ ChangeTracker shows no new traces
- ❌ Runtime element versions don't increment
- ❌ StateEngine state resets when studioStore.tsx is edited
- ❌ No pending HMR updates detected

## Debugging Commands

```javascript
// Check HMR availability
window.isHmrAvailable()

// Check pending HMR updates
window.getPendingHmrUpdates()

// Check ChangeTracker traces
window.changeTracker.getTraces()
window.changeTracker.getLastTrace()

// Check runtime registry
window.runtimeRegistry.getSnapshot()

// Check StateEngine state
window.getStateEngine().getFullState()

// Run regression scenario
window.runProjectsScenario()
```

## Known Limitations

1. **Module-level HMR acceptance**: The current implementation adds HMR acceptance at the module level using `import.meta.hot.accept()`. This works for most cases but may not catch all HMR events.

2. **Vite Fast Refresh behavior**: The actual persistence of StateEngine across Fast Refresh depends on Vite's module preservation behavior, which is not guaranteed for all modules.

3. **Re-registration timing**: Automatic re-registration happens in the HMR callback, but the timing relative to component re-mounting may vary.

## Next Steps for Full Validation

1. **Automated browser testing**: Implement CDP/Edge validation harness for automated testing
2. **Module import analysis**: Derive runtime relationships from actual import statements
3. **State preservation testing**: Specific testing for studioStore.tsx editing scenarios
4. **Performance testing**: Measure HMR performance impact on large codebases

## Implementation Verification

The implementation has been verified to:
- ✅ Compile with TypeScript (no errors)
- ✅ Build successfully for production
- ✅ Use Vite's actual HMR API (`import.meta.hot.accept()`)
- ✅ Connect HMR events to ChangeTracker
- ✅ Add proper console logging for debugging
- ✅ Preserve existing architecture (no rewrites)
- ✅ Respect DEV-only gating (all HMR code gated by `import.meta.env.DEV && import.meta.hot`)
