import { useGame } from './useGame.js';
import { getDino } from '../game/config.js';

export default function LostLifeBox() {
  const { ctrl, game, score } = useGame();
  const run = game.run;
  const feedback = game.checkpoint.feedback;

  // "Time is up!" or "Wrong answer!" at the top
  let title = 'Wrong answer!';
  if (feedback.timedOut) {
    title = 'Time is up!';
  }

  // hearts: full for lives left, empty for lives lost
  const maxLives = getDino(run.dino).lives;
  const hearts = '♥'.repeat(run.lives) + '♡'.repeat(maxLives - run.lives);

  let livesText = 'You have ' + run.lives + ' lives left.';
  if (run.lives === 1) {
    livesText = 'Careful: this is your last life!';
  }

  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="bad">{title}</h2>
        <p className="center">There were <b>{feedback.answer}</b> fish in the picture.</p>

        <p className="center big-hearts bad">{hearts}</p>
        <p className="center">You lost a life. {livesText}</p>

        <div className="stats">
          <span>Score <b>{score}</b></span>
          <span>Distance <b>{Math.floor(run.distance)} m</b></span>
          <span>Coins <b>{run.coins}</b></span>
        </div>

        <div className="button-row">
          <button onClick={() => ctrl.nextPuzzle()}>Next puzzle</button>
          <button className="ghost" onClick={() => ctrl.startRun()}>Replay</button>
          <button className="ghost" onClick={() => ctrl.goToMenu()}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
