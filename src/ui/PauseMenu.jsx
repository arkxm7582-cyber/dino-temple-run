// =============================================================
// PauseMenu.jsx
// =============================================================
import { useGame } from './useGame.js';

export default function PauseMenu() {
  const { ctrl } = useGame();

  return (
    <div className="overlay">
      <div className="panel">
        <h2>Paused</h2>
        <button onClick={() => ctrl.togglePause()}>Resume</button>
        <button className="ghost" onClick={() => ctrl.goToMenu()}>End run and go to main menu</button>
        <small>Press P or Esc to resume.</small>
      </div>
    </div>
  );
}
