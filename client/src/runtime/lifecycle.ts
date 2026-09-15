import type { ArtifactManifest, EffectEvent, LifecycleState } from "@shared/artifact";
export type LifecycleEvent = { type: "TICK"; dt: number } | { type: "LAUNCH" } | { type: "MEDIA" } | { type: "EXIT" } | { type: "RESET" };
export type LivingApp = { state: LifecycleState; clock: number; active: EffectEvent[] };
const order: LifecycleState[] = ["icon", "launching", "entry", "running", "media", "exiting", "exited"];
const durations: Record<LifecycleState, number> = { icon: 0, launching: 1.2, entry: 2.5, running: 4, media: 4, exiting: 1.5, exited: 0 };
export function createLivingApp(): LivingApp { return { state: "icon", clock: 0, active: [] }; }
export function step(app: LivingApp, manifest: ArtifactManifest, event: LifecycleEvent): LivingApp {
  if (event.type === "RESET") return createLivingApp();
  if (event.type === "LAUNCH" && (app.state === "icon" || app.state === "exited")) return { state: "launching", clock: 0, active: manifest.startup.filter((item) => item.time <= 0) };
  if (event.type === "MEDIA" && app.state === "running") return { ...app, state: "media", clock: 0 };
  if (event.type === "EXIT" && !["icon", "exiting", "exited"].includes(app.state)) return { state: "exiting", clock: 0, active: [...app.active, ...manifest.shutdown.filter((item) => item.time <= 0)] };
  if (event.type !== "TICK") return app;
  const clock = app.clock + event.dt;
  const stage = ["launching", "entry", "running"].includes(app.state) ? manifest.startup : app.state === "exiting" ? manifest.shutdown : [];
  const active = [...app.active, ...stage.filter((item) => item.time > app.clock && item.time <= clock)];
  if (clock >= durations[app.state] && app.state !== "icon" && app.state !== "exited") return { state: order[order.indexOf(app.state) + 1], clock: 0, active };
  return { ...app, clock, active };
}
