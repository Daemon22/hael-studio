import type { ReactNode } from "react";

export function StudioShell({ children }: { children: ReactNode }) {
  return <main className="studio-shell">{children}</main>;
}

export default StudioShell;