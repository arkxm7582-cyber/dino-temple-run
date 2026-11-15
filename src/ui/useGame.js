// =============================================================
// useGame.js
// =============================================================
// A React "context" lets every component reach the one GameController
// without passing it through every component by hand.
//
// In a component:
//   const { ctrl, game, score } = useGame();
//     ctrl  -> the GameController, to call methods like ctrl.startRun()
//     game  -> the current game state (phase, run, checkpoint, ...)
//     score, user, best, toGate -> other data from makeSnapshot()
//
// useSyncExternalStore makes React redraw the component every time
// the controller calls notify().
// =============================================================
import { createContext, useContext, useSyncExternalStore } from 'react';

export const GameContext = createContext(null);

export function useGame() {
  const ctrl = useContext(GameContext);
  const snapshot = useSyncExternalStore(ctrl.subscribe, ctrl.getSnapshot);
  return { ctrl: ctrl, ...snapshot };
}
