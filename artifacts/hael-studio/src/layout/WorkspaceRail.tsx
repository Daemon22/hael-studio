import type { ReactNode } from "react";

export function WorkspaceRail({ children }: { children: ReactNode }) {
  return <aside className="constellation-rail">{children}</aside>;
}

export default WorkspaceRail;