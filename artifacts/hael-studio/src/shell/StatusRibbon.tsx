import type { ReactNode } from "react";

export function StatusRibbon({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`studio-data-notice${error ? " error" : ""}`} role="status" data-testid="workspace-data-status">{children}</div>;
}

export default StatusRibbon;