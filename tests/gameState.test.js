// Tests for game/gameState.js: send actions in, check the new state.
import { describe, it, expect } from 'vitest';
import { gameReducer, initialState, Phase, getScore } from '../src/game/gameState.js';
import { CHECKPOINT, SCORE, LEVELS } from '../src/game/config.js';

const RUN = { lives: 3 };
const START = { type: 'START_RUN', level: 0, dino: 'rex', lives: 3 };

const puzzle = { image: 'data:image/png;base64,xyz', options: [5, 7, 6, 8], correctIndex: 1 };

// Plays a list of actions one after another.
function play(...actions) {
  return actions.reduce(gameReducer, initialState);
}

// A state where the fish question is on screen.
const atQuestion = () => play(START, { type: 'GATE_REACHED' }, { type: 'PUZZLE_LOADED', puzzle });

describe('gameReducer', () => {
  it('starts a run with full lives', () => {
    const s = play(START);
    expect(s.phase).toBe(Phase.RUNNING);
    expect(s.run.lives).toBe(RUN.lives);
  });

  it('counts coins and loses lives on hits, ending the game at 0 lives', () => {
    let s = play(START, { type: 'COIN_COLLECTED' }, { type: 'HIT' });
    expect(s.run.coins).toBe(1);
    expect(s.run.lives).toBe(RUN.lives - 1);
    for (let i = 1; i < RUN.lives; i++) s = gameReducer(s, { type: 'HIT' });
    expect(s.phase).toBe(Phase.GAME_OVER);
  });

  it('reaching a gate starts loading a puzzle, then shows the question', () => {
    let s = play(START, { type: 'GATE_REACHED' });
    expect(s.phase).toBe(Phase.CHECKPOINT);
    expect(s.checkpoint.status).toBe('loading');
    s = gameReducer(s, { type: 'PUZZLE_LOADED', puzzle });
    expect(s.checkpoint.status).toBe('question');
    expect(s.checkpoint.timeLeft).toBe(CHECKPOINT.questionTime);
  });

  it('a correct answer gives points and then continues the run', () => {
    let s = gameReducer(atQuestion(), { type: 'ANSWER', index: 1 });
    expect(s.checkpoint.feedback.correct).toBe(true);
    expect(s.run.bonus).toBe(SCORE.correctAnswer);
    s = gameReducer(s, { type: 'TICK', dt: CHECKPOINT.feedbackTime + 0.1 });
    expect(s.phase).toBe(Phase.RUNNING);
    expect(s.run.gatesPassed).toBe(1);
  });

  it('a wrong answer costs a life and shows the "lost a life" box, then Next puzzle loads a new one', () => {
    let s = gameReducer(atQuestion(), { type: 'ANSWER', index: 0 });
    expect(s.run.lives).toBe(RUN.lives - 1);
    expect(s.checkpoint.status).toBe('wrong');
    expect(s.checkpoint.feedback.answer).toBe(7);
    s = gameReducer(s, { type: 'TICK', dt: 60 });
    expect(s.checkpoint.status).toBe('wrong'); // waits for the player, no timer
    s = gameReducer(s, { type: 'NEXT_PUZZLE' });
    expect(s.checkpoint.status).toBe('loading');
    expect(s.checkpoint.attempt).toBe(2);
  });

  it('running out of time counts as a wrong answer', () => {
    const s = gameReducer(atQuestion(), { type: 'TICK', dt: CHECKPOINT.questionTime + 1 });
    expect(s.checkpoint.feedback.timedOut).toBe(true);
    expect(s.run.lives).toBe(RUN.lives - 1);
  });

  it('an API error ends the run straight away (no life lost) with the reason', () => {
    const s = play(START, { type: 'GATE_REACHED' }, { type: 'PUZZLE_FAILED', message: 'offline' });
    expect(s.phase).toBe(Phase.GAME_OVER);
    expect(s.endReason).toBe('api');
    expect(s.endMessage).toBe('offline');
    expect(s.run.lives).toBe(RUN.lives);
  });

  it('losing the last life on a fish question goes to game over', () => {
    let s = play({ ...START, lives: 1 }, { type: 'GATE_REACHED' }, { type: 'PUZZLE_LOADED', puzzle }, { type: 'ANSWER', index: 0 });
    s = gameReducer(s, { type: 'TICK', dt: CHECKPOINT.feedbackTime + 0.1 });
    expect(s.phase).toBe(Phase.GAME_OVER);
    expect(s.endReason).toBe('lives');
  });

  it('a run can be ended from a fish gate (e.g. when the API is down)', () => {
    const s = play(START, { type: 'GATE_REACHED' }, { type: 'END_RUN' });
    expect(s.phase).toBe(Phase.GAME_OVER);
  });

  it('ignores a puzzle that arrives when it is no longer wanted', () => {
    const s = play(START, { type: 'PUZZLE_LOADED', puzzle });
    expect(s.checkpoint).toBe(null);
  });

  it('can pause while running but not during the fish question', () => {
    expect(play(START, { type: 'PAUSE' }).phase).toBe(Phase.PAUSED);
    expect(gameReducer(atQuestion(), { type: 'PAUSE' }).phase).toBe(Phase.CHECKPOINT);
  });

  it('LEVEL_UP changes the level, gives bonus points and shows a banner', () => {
    const s = play(START, { type: 'LEVEL_UP', level: 1 });
    expect(s.run.level).toBe(1);
    expect(s.run.bonus).toBe(SCORE.levelComplete);
    expect(s.banner).toContain(LEVELS[1].name);
  });

  it('the number of lives comes from the chosen dinosaur', () => {
    expect(play({ ...START, dino: 'trike', lives: 4 }).run.lives).toBe(4);
  });

  it('score = metres + coins + bonus', () => {
    const run = { distance: 120.7, coins: 3, bonus: 200 };
    expect(getScore(run)).toBe(120 + 3 * SCORE.perCoin + 200);
  });
});
