// =============================================================
// FishQuestion.jsx
// =============================================================
// The pop-up at a fish gate. What it shows depends on checkpoint.status:
//   'loading'  -> "Getting a puzzle..."
//   'question' -> the picture, the timer and 4 answer buttons
//   'feedback' -> after a correct answer: the right button green + "Correct!"
// If the Fish API fails, the game closes this pop-up by itself and shows
// the game over screen. There is also always a button to end the run,
// so the player is never stuck while the API is slow.
// =============================================================
import { useGame } from './useGame.js';

export default function FishQuestion() {
  const { ctrl, game } = useGame();
  const cp = game.checkpoint;

  let title = 'Fish gate ' + (game.run.gatesPassed + 1);
  if (cp.attempt > 1) {
    title = title + ' (try ' + cp.attempt + ')';
  }

  return (
    <div className="overlay">
      <div className="panel wide">
        <h2>{title}</h2>

        {cp.status === 'loading' && <p>Getting a puzzle from the Fish API...</p>}

        {cp.puzzle !== null && (
          <>
            <p>
              How many fish are in the picture? (Treasure chests don't count.)
              {cp.status === 'question' && <b> {Math.ceil(cp.timeLeft)} s left</b>}
            </p>
            <img src={cp.puzzle.image} alt="Fish puzzle from the Fish API" />
            <AnswerButtons cp={cp} onAnswer={(i) => ctrl.answer(i)} />
          </>
        )}

        {cp.feedback !== null && <FeedbackMessage feedback={cp.feedback} />}

        <button className="ghost" onClick={() => ctrl.goToMenu()}>End run and go to main menu</button>
      </div>
    </div>
  );
}

// The 4 answer buttons. After answering, the right one turns green and
// the wrong choice turns red.
function AnswerButtons({ cp, onAnswer }) {
  const answered = cp.status === 'feedback';

  return (
    <div className="answers">
      {cp.puzzle.options.map((number, i) => {
        let colour = '';
        if (answered && i === cp.puzzle.correctIndex) {
          colour = 'right';
        } else if (answered && i === cp.feedback.chosen) {
          colour = 'wrong';
        }

        return (
          <button key={i} className={colour} disabled={answered} onClick={() => onAnswer(i)}>
            {i + 1}) {number}
          </button>
        );
      })}
    </div>
  );
}

// Only shown after a CORRECT answer. (A wrong answer closes this pop-up
// and shows LostLifeBox.jsx instead.)
function FeedbackMessage({ feedback }) {
  if (feedback.correct) {
    return <p className="good">Correct! The gate is opening.</p>;
  }
  return null;
}
