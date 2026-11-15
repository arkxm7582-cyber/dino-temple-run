// =============================================================
// HUD.jsx  ("heads-up display")
// =============================================================
// The information shown at the top of the screen during a run.
// =============================================================
import { useGame } from './useGame.js';
import { LEVELS, getDino } from '../game/config.js';

export default function HUD() {
  const { ctrl, game, score, toGate } = useGame();
  const run = game.run;

  // One full heart for each life left, one empty heart for each life lost.
  // The number of hearts depends on the dinosaur (T-Rex 3, Triceratops 4).
  const maxLives = getDino(run.dino).lives;
  const livesLeft = Math.max(0, run.lives);
  const hearts = '♥'.repeat(livesLeft) + '♡'.repeat(Math.max(0, maxLives - livesLeft));

  // The bar of information stays in the same place all the time.
  // The banner ("Fish gate ahead!") appears UNDER the bar, so the bar
  // never moves when a message pops up.
  return (
    <div className="hud">
      <div className="hud-bar">
        <span>Lv {run.level + 1}: {LEVELS[run.level].name}</span>
        <span>Score {score}</span>
        <span>{Math.floor(run.distance)} m</span>
        <span>Coins {run.coins}</span>
        <span className="bad">{hearts}</span>
        <span>Gate {toGate} m</span>
        <button onClick={() => ctrl.togglePause()} aria-label="Pause">II</button>
      </div>

      {game.banner !== null && <div className="banner">{game.banner}</div>}
    </div>
  );
}
