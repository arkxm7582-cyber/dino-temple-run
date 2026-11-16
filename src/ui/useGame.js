import { createContext, useContext, useSyncExternalStore } from 'react';

export const GameContext = createContext(null);

export function useGame() {
  const ctrl = useContext(GameContext);
  const snapshot = useSyncExternalStore(ctrl.subscribe, ctrl.getSnapshot);
  return { ctrl: ctrl, ...snapshot };
}
