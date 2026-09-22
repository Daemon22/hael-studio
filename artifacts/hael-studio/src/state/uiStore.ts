import { useSyncExternalStore } from "react";

type UiMode = "overview" | "detail" | "command";

type UIState = {
  selectedNodeId: string;
  loomOpen: boolean;
  commandOpen: boolean;
  simulationRunning: boolean;
  activePanel: UiMode;
};

type UIActions = {
  setSelectedNodeId: (nodeId: string) => void;
  setLoomOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setSimulationRunning: (running: boolean) => void;
  setActivePanel: (mode: UiMode) => void;
};

const initialState: UIState = {
  selectedNodeId: "intention",
  loomOpen: true,
  commandOpen: false,
  simulationRunning: false,
  activePanel: "overview",
};

let state: UIState = initialState;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateState(partial: Partial<UIState>) {
  state = { ...state, ...partial };
  notify();
}

export const uiStoreActions: UIActions = {
  setSelectedNodeId: (selectedNodeId) => updateState({ selectedNodeId }),
  setLoomOpen: (loomOpen) => updateState({ loomOpen }),
  setCommandOpen: (commandOpen) => updateState({ commandOpen }),
  setSimulationRunning: (simulationRunning) => updateState({ simulationRunning }),
  setActivePanel: (activePanel) => updateState({ activePanel }),
};

export function useUiStore() {
  const snapshot = useSyncExternalStore(
    (subscribe) => {
      listeners.add(subscribe);
      return () => listeners.delete(subscribe);
    },
    () => state,
    () => state,
  );

  return { ...snapshot, ...uiStoreActions };
}