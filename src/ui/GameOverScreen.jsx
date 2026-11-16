import { useGame } from './useGame.js';
import { LEVELS, getDino } from '../game/config.js';

export default function GameOverScreen() {
  const { ctrl, game, score, best, records } = useGame();
  const run = game.run;

  // The title and the line under it depend on why the run ended
  let title = 'Game over';
  let reason = 'You ran out of lives. ' + (game.endMessage || '');
  if (game.endReason === 'api') {
    title = 'Run ended';
    reason = 'The Fish API could not be reached, so the gate could not open. ' + (game.endMessage || '');
  } else if (game.endReason === 'quit') {
    title = 'Run ended';
    reason = 'You ended the run.';
  }
  if (score > 0 && score >= best) {
    title = 'New best score!';
  }

  // Where would this score be in the hall of fame?
  let rank = 1;
  for (const entry of records.hallOfFame) {
    if (entry.score > score) {
      rank = rank + 1;
    }
  }

  const questions = run.correct + run.wrong;

  return (
    <div className="overlay">
      <div className="panel">
        <h2>{title}</h2>
        <h1>{score} {score === 1 ? 'point' : 'points'}</h1>
        <p className={'center' + (game.endReason === 'api' ? ' bad' : '')}>{reason}</p>
        <p className="center">Rank #{rank} in the hall of fame</p>

        <div className="stats">
          <span>Dinosaur <b>{getDino(run.dino).name}</b></span>
          <span>Level reached <b>{run.level + 1}. {LEVELS[run.level].name}</b></span>
          <span>Distance <b>{Math.floor(run.distance)} m</b></span>
          <span>Coins <b>{run.coins}</b></span>
          <span>Fish right <b>{run.correct} / {questions}</b></span>
          <span>Gates passed <b>{run.gatesPassed}</b></span>
        </div>

        <div className="button-row">
          <button onClick={() => ctrl.startRun()}>Play again</button>
          <button className="ghost" onClick={() => ctrl.goToMenu('play')}>Main menu</button>
          <button className="ghost" onClick={() => ctrl.goToMenu('fame')}>Hall of fame</button>
        </div>
      </div>
    </div>
  );
}
