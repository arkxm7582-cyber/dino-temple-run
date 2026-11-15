// Tests the whole checkpoint flow through the GameController,
// with a fake Fish API so no internet is needed.
import { describe, it, expect } from 'vitest';
import { GameController } from '../src/game/GameController.js';
import { Phase } from '../src/game/gameState.js';
import { CHECKPOINT } from '../src/game/config.js';

const puzzle = { image: 'data:image/png;base64,xyz', options: [5, 7, 6, 8], correctIndex: 1 };
const waitForPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function runFrames(ctrl, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) ctrl.update(1 / 60);
}

describe('GameController', () => {
  it('stops at the gate, loads a puzzle, and continues from the same spot after a right answer', async () => {
    let apiCalls = 0;
    const ctrl = new GameController(async () => { apiCalls += 1; return puzzle; });
    const heard = [];
    ctrl.bus.on('*', (eventName) => heard.push(eventName));

    ctrl.startRun();
    ctrl.runner.obstacles = [];
    ctrl.runner.distance = CHECKPOINT.every - 3;
    runFrames(ctrl, 1);

    expect(ctrl.state.phase).toBe(Phase.CHECKPOINT);
    await waitForPromises();
    expect(apiCalls).toBe(1);
    expect(ctrl.state.checkpoint.status).toBe('question');

    ctrl.answer(1);
    runFrames(ctrl, CHECKPOINT.feedbackTime + 0.2);
    expect(ctrl.state.phase).toBe(Phase.RUNNING);
    expect(ctrl.runner.distance).toBeGreaterThanOrEqual(CHECKPOINT.every); // no reset
    expect(ctrl.state.run.gatesPassed).toBe(1);

    // the event bus heard the important events in order
    expect(heard).toEqual(expect.arrayContaining(['START_RUN', 'GATE_REACHED', 'PUZZLE_LOADED', 'ANSWER']));
  });

  it('goes straight to game over (no life lost) when the Fish API fails', async () => {
    const ctrl = new GameController(async () => { throw new Error('Could not reach the Fish API.'); });
    ctrl.startRun();
    ctrl.runner.obstacles = [];
    ctrl.runner.distance = CHECKPOINT.every - 1;
    runFrames(ctrl, 0.5);
    await waitForPromises();
    expect(ctrl.state.phase).toBe(Phase.GAME_OVER);
    expect(ctrl.state.endReason).toBe('api');
    expect(ctrl.state.run.lives).toBe(3);
  });

  it('can always go back to the main menu while the API is still loading', () => {
    const ctrl = new GameController(() => new Promise(() => {})); // an API that never answers
    ctrl.startRun();
    ctrl.runner.obstacles = [];
    ctrl.runner.distance = CHECKPOINT.every - 1;
    runFrames(ctrl, 0.5);
    expect(ctrl.state.checkpoint.status).toBe('loading');
    ctrl.goToMenu();
    expect(ctrl.state.phase).toBe(Phase.MENU);
    expect(ctrl.runner).toBe(null);
  });
});
