# Hael Studio: Source of Truth and Next Steps

## Executive interpretation

The attached content is not asking for another isolated feature. It identifies the **root product problem**: Hael Studio’s visual ambition has outgrown a layout system that behaves like a fixed-width composition. The next phase must therefore establish a responsive, shared, component-based workspace before adding more surface area.

Hael Studio is a **cloud intelligence workspace for making, inspecting, simulating, and communicating about complete applications and media**. It combines the recognizable foundations of an IDE with a semantic live canvas, runtime preview, effect timeline, agent collaboration, and Mike as a natural-language communication bridge. The canvas is not the whole product; it is the layer that makes the engineering system understandable, inspectable, and craftable.

> The most important next move is not adding another mode. It is creating one responsive workspace architecture in which every mode, agent, preview, and runtime behaves coherently across desktop, tablet, and phone.

## What the source content establishes

| Source signal | Product meaning | Required response |
|---|---|---|
| Fixed-width placement clips on narrow screens | The current layout is compositionally authored but structurally brittle | Replace positional assumptions with fluid grid, flex, and container-aware layout |
| The mode bar is clipped and redrawn inconsistently | Navigation is not a shared product primitive | Build one responsive `ModeNav` used everywhere |
| Mike occupies too much navigation space | Agent communication should be ambient, not a separate destination | Move Mike to a persistent mic/waveform affordance with a lightweight popover |
| Preview controls float over content without an anchor | Runtime configuration lacks a clear interaction container | Use a docked inspector or bottom sheet with scrim, focus management, and escape behavior |
| Ghost text appears through Inspect | Layering is leaking implementation details into the experience | Establish explicit z-index, opacity, and surface contracts |
| Semantic chips scatter across the canvas | The canvas has meaning but not enough spatial discipline | Use anchor zones, collision-aware placement, and responsive grouping |
| Several desktop/app versions are expected | The product needs shared contracts, not identical shells | Keep runtime, artifact, timeline, agent, and snapshot models portable |

## What Hael Studio is for

Hael Studio should help a person or team move through a complete creative-engineering loop:

1. **Compose** an intention, code, system, design, or media artifact.
2. **Understand** how the pieces relate through the semantic canvas.
3. **Communicate** with agents and teammates through Mike without abandoning the work surface.
4. **Preview** the whole artifact from identity and entry through interaction, media, and exit.
5. **Simulate** runtime events, audio, video, animation, and lifecycle transitions.
6. **Inspect** code, effects, responsibility, Git changes, and runtime evidence.
7. **Compare and restore** named effect and design passes.
8. **Release** a crafted result with confidence that the experience works at the dimensions and conditions where people will actually use it.

The product’s distinctive promise is therefore not “AI writes code.” It is **a workspace where intention, implementation, runtime behavior, and human communication remain visible as one coherent system**.

## Priority order for the next build

### P0 — Rebuild the responsive workspace shell

This must happen before expanding the number of modes. The shell should use a shared responsive layout with a desktop three-field composition, a tablet two-field composition, and a mobile single-field composition. The left project rail and right Conversation Loom should become collapsible drawers on smaller screens. The central canvas should always remain the primary reading surface.

The mode bar should become one shared component with three visible primary modes—**Compose, Preview, and Inspect**—while Simulate, Run scenario, Split view, and other utilities move into an overflow menu or contextual toolbar. The component must preserve keyboard navigation, a visible active state, focus rings, and a mobile fade-edge or overflow affordance.

### P1 — Make Mike ambient and useful

Mike should no longer consume a full mode tab. The persistent affordance should be a small microphone or waveform control in the compose/runtime bar. Its states should be visually distinct: idle, listening, suggestion ready, approval required, executing, and complete. Activating it should open a lightweight anchored popover or drawer containing the live transcript, target agent, proposed Orren action, permissions, and approve/reject controls.

This keeps natural-language communication available at all times without displacing the editor, preview, or canvas. It also reflects the source content’s most important interaction correction: **Mike is a bridge, not a destination**.

### P1 — Establish anchored runtime configuration

Device, language, persona, artifact, and runtime controls should not float over headings. On desktop they should appear in a docked Preview inspector; on mobile they should use a bottom sheet with a scrim and a clear close/escape path. The sheet must trap focus, close on escape, and return focus to its trigger.

This is especially important because Hael Studio previews complete experiences, not only static screens. Runtime configuration needs to feel like an intentional instrument panel rather than a loose modal pasted over the canvas.

### P1 — Create a disciplined canvas placement system

The semantic chips should be placed through named anchor zones—such as upper-left intention, upper-right system, center relationship, lower-left language, lower-right events, and bottom realization—rather than arbitrary coordinates. At narrow widths, chips should become a compact relationship list or a stacked constellation with collision-aware spacing. The graph remains expressive, but the user should never feel that elements are falling into empty space.

### P1 — Fix surface layering and content integrity

The Inspect view needs explicit surface isolation so canvas title text cannot bleed through code or inspector content. Each major surface should define its own background, opacity, backdrop, z-index, and stacking context. Decorative imagery must remain behind semantic and engineering content.

### P2 — Make the web version a credible first product

The web version should be treated as a complete cloud workspace with honest capability labels. Each feature should visibly communicate whether it is **live**, **simulated**, **connected**, or **planned**. The first release should support responsive creation, runtime preview, media behavior, timeline inspection, Mike interaction simulation, project navigation, and clear artifact states without pretending that unconnected services are already live.

Windows and Android can later receive platform-specific shells, but they should inherit shared artifact manifests, effect events, snapshot data, permission contracts, and runtime lifecycle definitions.

## Recommended implementation sequence

| Sequence | Build unit | Success condition |
|---:|---|---|
| 1 | Shared responsive `StudioShell` and `ModeNav` | No clipping or duplicate mode navigation at desktop, tablet, or mobile widths |
| 2 | Responsive rail and Loom drawers | Side surfaces collapse without losing context or focus |
| 3 | Anchored Mike popover | Mike is always available but never occupies a primary mode slot |
| 4 | Preview inspector/bottom sheet | Runtime controls have a clear anchor, scrim, escape behavior, and responsive placement |
| 5 | Canvas anchor and collision system | Semantic nodes remain legible and grouped at all breakpoints |
| 6 | Inspect surface isolation | No ghost text, opacity bleed, or z-index leakage |
| 7 | Responsive runtime/media QA | Application, video, music, animation, timeline, and snapshot flows remain usable on narrow screens |
| 8 | Capability truth labels and product polish | Users can distinguish live, simulated, connected, and planned behavior |

## Decisions to avoid

Do not add more top-level modes until the shared navigation has been corrected. Do not solve mobile clipping by shrinking desktop controls indefinitely. Do not turn Mike into another conversation page. Do not use additional decorative images to compensate for weak hierarchy. Do not allow simulated controls to imply live integrations. Do not make future desktop or Android versions diverge by inventing separate runtime semantics.

## Product north star

> **Hael Studio is the intelligence workspace where people can craft an entire experience, see how it behaves, speak to the systems shaping it, and refine every detail without losing the architecture underneath.**

The next milestone is not “more interface.” It is **one coherent, responsive, truthful interface** that makes the existing depth usable everywhere.
