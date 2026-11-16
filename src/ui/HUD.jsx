import { useGame } from './useGame.js';
import { LEVELS, getDino } from '../game/config.js';

export default function HUD() {
  const { ctrl, game, score, toGate } = useGame();
  const run = game.run;

  const maxLives = getDino(run.dino).lives;
  const livesLeft = Math.max(0, run.lives);
  const hearts = '♥'.repeat(livesLeft) + '♡'.repeat(Math.max(0, maxLives - livesLeft));

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
