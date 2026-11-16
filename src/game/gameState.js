import { CHECKPOINT, SCORE, LEVELS } from './config.js';

// All the phases the game can be in
export const Phase = {
  MENU: 'MENU',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  CHECKPOINT: 'CHECKPOINT',
  GAME_OVER: 'GAME_OVER',
};

export const initialState = {
  phase: Phase.MENU,
  run: null,
  checkpoint: null,
  banner: null,
  bannerTime: 0,
  endReason: null,
  endMessage: null,
};

function newRun(action) {
  return {
    dino: action.dino,
    startLevel: action.level,
    level: action.level,
    distance: 0,
    coins: 0,
    lives: action.lives,
    bonus: 0,
    correct: 0,
    wrong: 0,
    gatesPassed: 0,
  };
}

function newCheckpoint(attempt) {
  return {
    status: 'loading',
    attempt: attempt,
    puzzle: null,
    timeLeft: 0,
    error: null,
    feedback: null,
  };
}

// score = metres + coins x 10 + bonus points
export function getScore(run) {
  if (run === null) {
    return 0;
  }
  return Math.floor(run.distance) * SCORE.perMetre + run.coins * SCORE.perCoin + run.bonus;
}

function checkAnswer(state, index) {
  const cp = state.checkpoint;
  const isCorrect = index === cp.puzzle.correctIndex;
  const rightAnswer = cp.puzzle.options[cp.puzzle.correctIndex];

  const feedback = {
    correct: isCorrect,
    chosen: index,
    timedOut: index === null,
    answer: rightAnswer,
  };

  if (isCorrect) {
    const run = { ...state.run, correct: state.run.correct + 1, bonus: state.run.bonus + SCORE.correctAnswer };
    return {
      ...state,
      run: run,
      checkpoint: { ...cp, status: 'feedback', feedback: feedback, timeLeft: CHECKPOINT.feedbackTime },
    };
  }

  const run = { ...state.run, wrong: state.run.wrong + 1, lives: state.run.lives - 1 };

  // No lives left: the run is over, show the game over screen.
  if (run.lives <= 0) {
    let message = 'Wrong answer on your last life: it was ' + rightAnswer + ' fish.';
    if (index === null) {
      message = 'Time ran out on your last life: it was ' + rightAnswer + ' fish.';
    }
    return { ...state, run: run, phase: Phase.GAME_OVER, checkpoint: null, endReason: 'lives', endMessage: message };
  }

  return { ...state, run: run, checkpoint: { ...cp, status: 'wrong', feedback: feedback } };
}

function afterCorrectAnswer(state) {
  const run = { ...state.run, gatesPassed: state.run.gatesPassed + 1 };
  return { ...state, phase: Phase.RUNNING, checkpoint: null, run: run };
}

export function gameReducer(state, action) {
  const cp = state.checkpoint;

  switch (action.type) {
    case 'START_RUN':
      return { ...initialState, phase: Phase.RUNNING, run: newRun(action) };

    case 'BACK_TO_MENU':
      return initialState;

    case 'END_RUN':
      if (state.phase !== Phase.PAUSED && state.phase !== Phase.CHECKPOINT) {
        return state;
      }
      return { ...state, phase: Phase.GAME_OVER, checkpoint: null, banner: null, endReason: 'quit' };

    case 'TICK': {
      if (state.phase === Phase.RUNNING) {
        const next = { ...state, run: { ...state.run, distance: action.distance } };
        next.bannerTime = state.bannerTime - action.dt;
        if (next.bannerTime <= 0) {
          next.banner = null;
        }
        return next;
      }

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
        return checkAnswer(state, null);
      }
      return afterCorrectAnswer(state);
    }

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
      const run = { ...state.run, level: action.level, bonus: state.run.bonus + SCORE.levelComplete };
      const text = 'Level ' + (action.level + 1) + ': ' + LEVELS[action.level].name;
      return { ...state, run: run, banner: text, bannerTime: 3 };
    }

    case 'GATE_REACHED':
      if (state.phase !== Phase.RUNNING) {
        return state;
      }
      return { ...state, phase: Phase.CHECKPOINT, banner: null, checkpoint: newCheckpoint(1) };

    case 'PUZZLE_LOADED':
      if (cp === null || cp.status !== 'loading') {
        return state;
      }
      return {
        ...state,
        checkpoint: { ...cp, status: 'question', puzzle: action.puzzle, timeLeft: CHECKPOINT.questionTime },
      };

    case 'PUZZLE_FAILED':
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

    case 'NEXT_PUZZLE':
      if (cp === null || cp.status !== 'wrong') {
        return state;
      }
      return { ...state, checkpoint: newCheckpoint(cp.attempt + 1) };

    case 'ANSWER':
      if (cp === null || cp.status !== 'question') {
        return state;
      }
      if (action.index < 0 || action.index > 3) {
        return state;
      }
      return checkAnswer(state, action.index);

    case 'PAUSE':
      if (state.phase !== Phase.RUNNING) {
        return state;
      }
      return { ...state, phase: Phase.PAUSED };

    case 'RESUME':
      if (state.phase !== Phase.PAUSED) {
        return state;
      }
      return { ...state, phase: Phase.RUNNING };

    default:
      return state;
  }
}
