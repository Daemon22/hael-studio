/* Hael Studio visual system: the shell owns the responsive frame; feature surfaces remain independent inside it. */
import type { ReactNode } from "react";

export function StudioShell({ children }: { children: ReactNode }) {
  return <main className="studio-shell">{children}</main>;
}
