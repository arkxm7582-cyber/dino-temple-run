// =============================================================
// gameState.js  (Week 3 - Event Driven Architecture)
// =============================================================
// The game works like a "state machine":
//   - it is always in exactly one PHASE (menu, running, paused, ...)
//   - it only changes when an EVENT arrives
//
// An event (called an "action" here) is a small object such as:
//   { type: 'COIN_COLLECTED' }       the dino picked up a coin
//   { type: 'GATE_REACHED' }         the dino arrived at a fish gate
//   { type: 'ANSWER', index: 2 }     the player pressed answer button 3
//   { type: 'TICK', dt: 0.016 }      one frame of time passed
//   { type: 'LEVEL_UP', level: 1 }   the dino entered the next level
//
// gameReducer(state, action) takes the current state and an action and
// returns the NEW state. It never changes the old state object, never
// draws anything and never calls the internet. Because of that it is
// very easy to test (see tests/gameState.test.js).
// =============================================================
import { CHECKPOINT, SCORE, LEVELS } from './config.js';

// All the phases the game can be in
export const Phase = {
  MENU: 'MENU',             // main menu, no run going on
  RUNNING: 'RUNNING',       // the dino is running
  PAUSED: 'PAUSED',         // the player paused the game
  CHECKPOINT: 'CHECKPOINT', // stopped at a fish gate, question on screen
  GAME_OVER: 'GAME_OVER',   // no lives left (or the player ended the run)
};

// The state when the game first opens
export const initialState = {
  phase: Phase.MENU,
  run: null,        // numbers about the current run (see newRun below)
  checkpoint: null, // the fish question while at a gate (see newCheckpoint below)
  banner: null,     // a short message at the top of the screen
  bannerTime: 0,    // seconds until the banner disappears
  endReason: null,  // why the run ended: 'lives', 'api' or 'quit'
  endMessage: null, // extra text for the game over screen (e.g. the API error)
};

// The numbers for a brand new run.
// action = the START_RUN action: { level, dino, lives }
function newRun(action) {
  return {
    dino: action.dino,       // 'rex' or 'trike'
    startLevel: action.level, // the level chosen on the menu
    level: action.level,      // the level the dino is in now
    distance: 0,
    coins: 0,
    lives: action.lives,
    bonus: 0,       // points from correct fish answers
    correct: 0,     // how many fish questions were answered correctly
    wrong: 0,       // wrong answers + times the timer ran out
    gatesPassed: 0,
  };
}

// The fish question at a gate goes through these steps (status):
//   'loading'  -> waiting for the Fish API to send a puzzle
//   'question' -> the picture and 4 answer buttons are shown, timer running
//   'feedback' -> after a CORRECT answer: "Correct!" for a moment, then run on
//   'wrong'    -> after a WRONG answer (or time up): the fish pop-up closes and
//                 a "You lost a life" box shows the score and three buttons
//                 (Next puzzle / Replay / Main menu). The player decides.
// A wrong answer on the LAST life goes straight to the game over screen.
function newCheckpoint(attempt) {
  return {
    status: 'loading',
    attempt: attempt, // 1 = first try, 2 = second try after a wrong answer, ...
    puzzle: null,     // { image, options, correctIndex } from the Fish API
    timeLeft: 0,      // seconds left (for the question, then for the feedback)
    error: null,      // error message if the API failed
    feedback: null,   // { correct, chosen, timedOut, answer }
  };
}

// score = metres + coins x 10 + bonus points
export function getScore(run) {
  if (run === null) {
    return 0;
  }
  return Math.floor(run.distance) * SCORE.perMetre + run.coins * SCORE.perCoin + run.bonus;
}

// Checks the player's answer.
// index = the button that was pressed (0-3), or null if the time ran out.
function checkAnswer(state, index) {
  const cp = state.checkpoint;
  const isCorrect = index === cp.puzzle.correctIndex;
  const rightAnswer = cp.puzzle.options[cp.puzzle.correctIndex]; // the real number of fish

  const feedback = {
    correct: isCorrect,
    chosen: index,
    timedOut: index === null,
    answer: rightAnswer,
  };

  // ----- correct: extra points, show "Correct!" for a moment -----
  if (isCorrect) {
    const run = { ...state.run, correct: state.run.correct + 1, bonus: state.run.bonus + SCORE.correctAnswer };
    return {
      ...state,
      run: run,
      checkpoint: { ...cp, status: 'feedback', feedback: feedback, timeLeft: CHECKPOINT.feedbackTime },
    };
  }

  // ----- wrong (or time up): lose a life -----
  const run = { ...state.run, wrong: state.run.wrong + 1, lives: state.run.lives - 1 };

  // No lives left: the run is over, show the game over screen.
  if (run.lives <= 0) {
    let message = 'Wrong answer on your last life: it was ' + rightAnswer + ' fish.';
    if (index === null) {
      message = 'Time ran out on your last life: it was ' + rightAnswer + ' fish.';
    }
    return { ...state, run: run, phase: Phase.GAME_OVER, checkpoint: null, endReason: 'lives', endMessage: message };
  }

  // Still alive: close the fish pop-up and show the "You lost a life" box.
  return { ...state, run: run, checkpoint: { ...cp, status: 'wrong', feedback: feedback } };
}

// After the "Correct!" message: the gate opens and the run continues
// from the same spot.
function afterCorrectAnswer(state) {
  const run = { ...state.run, gatesPassed: state.run.gatesPassed + 1 };
  return { ...state, phase: Phase.RUNNING, checkpoint: null, run: run };
}

// =============================================================
// The reducer: one "case" for every type of event.
// =============================================================
export function gameReducer(state, action) {
  const cp = state.checkpoint;

  switch (action.type) {
    // ----- starting and leaving -----
    case 'START_RUN':
      return { ...initialState, phase: Phase.RUNNING, run: newRun(action) };

    case 'BACK_TO_MENU':
      return initialState;

    case 'END_RUN':
      // The player ended the run from the pause menu or from a fish gate
      // (for example when the Fish API is not working).
      if (state.phase !== Phase.PAUSED && state.phase !== Phase.CHECKPOINT) {
        return state;
      }
      return { ...state, phase: Phase.GAME_OVER, checkpoint: null, banner: null, endReason: 'quit' };

    // ----- time passing -----
    case 'TICK': {
      // While running: copy the distance from the Runner into the state,
      // and count down the time until the banner message disappears.
      if (state.phase === Phase.RUNNING) {
        const next = { ...state, run: { ...state.run, distance: action.distance } };
        next.bannerTime = state.bannerTime - action.dt;
        if (next.bannerTime <= 0) {
          next.banner = null;
        }
        return next;
      }

      // The timer only runs while a question or a feedback message is shown.
      if (state.phase !== Phase.CHECKPOINT) {
        return state;
      }
      if (cp.status !== 'question' && cp.status !== 'feedback') {
        return state;
      }

      const timeLeft = cp.timeLeft - action.dt;
      if (timeLeft > 0) {
        return { ...state, checkpoint: { ...cp, timeLeft: timeLeft } };
      }

      // Time is up!
      if (cp.status === 'question') {
        return checkAnswer(state, null); // no answer = wrong answer
      }
      return afterCorrectAnswer(state); // the "Correct!" message has been shown long enough
    }

    // ----- things the Runner reports -----
    case 'COIN_COLLECTED':
      if (state.phase !== Phase.RUNNING) {
        return state;
      }
      return { ...state, run: { ...state.run, coins: state.run.coins + 1 } };

    case 'HIT': {
      if (state.phase !== Phase.RUNNING) {
        return state;
      }
      const run = { ...state.run, lives: state.run.lives - 1 };
      if (run.lives <= 0) {
        return { ...state, run: run, phase: Phase.GAME_OVER, endReason: 'lives' };
      }
      return { ...state, run: run };
    }

    case 'GATE_AHEAD':
      return { ...state, banner: 'Fish gate ahead!', bannerTime: 10 };

    case 'LEVEL_UP': {
      // The Runner moved into the next level: bonus points and a message
      const run = { ...state.run, level: action.level, bonus: state.run.bonus + SCORE.levelComplete };
      const text = 'Level ' + (action.level + 1) + ': ' + LEVELS[action.level].name;
      return { ...state, run: run, banner: text, bannerTime: 3 };
    }

    case 'GATE_REACHED':
      if (state.phase !== Phase.RUNNING) {
        return state;
      }
      return { ...state, phase: Phase.CHECKPOINT, banner: null, checkpoint: newCheckpoint(1) };

    // ----- the Fish API -----
    case 'PUZZLE_LOADED':
      // If we are not waiting for a puzzle any more, ignore it (it came too late).
      if (cp === null || cp.status !== 'loading') {
        return state;
      }
      return {
        ...state,
        checkpoint: { ...cp, status: 'question', puzzle: action.puzzle, timeLeft: CHECKPOINT.questionTime },
      };

    case 'PUZZLE_FAILED':
      // The Fish API could not be reached. The gate can't be opened without
      // a puzzle, so the run ends straight away and the game over screen
      // shows the score and why it ended. (No life is taken for this.)
      if (cp === null || cp.status !== 'loading') {
        return state;
      }
      return {
        ...state,
        phase: Phase.GAME_OVER,
        checkpoint: null,
        banner: null,
        endReason: 'api',
        endMessage: action.message,
      };

    // ----- "Next puzzle" button in the "You lost a life" box -----
    case 'NEXT_PUZZLE':
      if (cp === null || cp.status !== 'wrong') {
        return state;
      }
      return { ...state, checkpoint: newCheckpoint(cp.attempt + 1) }; // loads a brand new puzzle

    // ----- the player's answer -----
    case 'ANSWER':
      if (cp === null || cp.status !== 'question') {
        return state; // not asking a question right now
      }
      if (action.index < 0 || action.index > 3) {
        return state; // not a valid button
      }
      return checkAnswer(state, action.index);

    // ----- pause -----
    case 'PAUSE':
      // You can only pause while running. Pausing during the fish question
      // is not allowed, otherwise the player could stop the timer.
      if (state.phase !== Phase.RUNNING) {
        return state;
      }
      return { ...state, phase: Phase.PAUSED };

    case 'RESUME':
      if (state.phase !== Phase.PAUSED) {
        return state;
      }
      return { ...state, phase: Phase.RUNNING };

    // Unknown event: nothing changes
    default:
      return state;
  }
}
