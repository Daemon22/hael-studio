import type { ReactNode } from "react";

export function MainCanvas({ children }: { children: ReactNode }) {
  return <section className="canvas-column">{children}</section>;
}

export default MainCanvas;