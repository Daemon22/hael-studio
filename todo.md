# Hael Studio Runtime Expansion

- [ ] Define shared runtime state for Preview and Simulate modes.
- [x] Keep subsystems isolated: code, canvas, runtime, media, agents, Mike communication, Git, and deployment must synchronize through explicit contracts rather than share mutable internals.
- [x] Add Mike as a live communication bridge that can speak agent context and translate natural language into Orren terminal actions without bypassing architecture checks.
- [x] Add persistent resizable panels with saved widths/heights and standard keyboard shortcuts.
- [x] Add Code + Hael Canvas split view with independent scroll, selection, and focus state.
- [x] Add full application lifecycle preview from icon/entry through navigation, runtime states, media playback, and exit.
- [x] Add artifact preview modes for applications, videos, and narrow capability modules such as music generation.
- [x] Preserve the traditional IDE foundation: editor, file explorer, search, terminal, debugger, tests, Git, GitHub, packages, extensions, and deployment.
- [x] Define the Hael overlay as coordinated views that augment rather than replace the traditional IDE surfaces.
- [x] Add explicit navigation between Code, Terminal, Source Control, Run & Debug, Extensions, Preview, Simulate, and Hael Canvas.
- [x] Define shared context contracts so code selections, runtime events, semantic nodes, and Git changes stay synchronized.
- [ ] Add replayable scenario data with ordered events and checkpoints.
- [ ] Implement interactive Preview controls for device, language, persona, and live state.
- [ ] Implement Simulate playback with play, pause, reset, replay, speed, and timeline scrubber.
- [ ] Add manual event injection and event log updates.
- [ ] Synchronize runtime state with selected canvas node, status ribbon, and Conversation Loom.
- [ ] Validate TypeScript, production build, responsive behavior, and key interactions.
- [ ] Save a checkpoint for delivery.
