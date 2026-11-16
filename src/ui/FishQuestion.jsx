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

function FeedbackMessage({ feedback }) {
  if (feedback.correct) {
    return <p className="good">Correct! The gate is opening.</p>;
  }
  return null;
}
