import type { ReactNode } from "react";

export function SidePanel({ children, open = true }: { children: ReactNode; open?: boolean }) {
  if (!open) return null;
  return <aside className="loom-panel">{children}</aside>;
}

export default SidePanel;