import { gameReducer, initialState, Phase, getScore } from './gameState.js';
import { Runner } from './Runner.js';
import { EventBus } from './EventBus.js';
import { getFishPuzzle } from '../services/fishApi.js';
import * as auth from '../services/auth.js';
import * as records from '../services/records.js';
import { getDino } from './config.js';

export class GameController {
  constructor(getPuzzle = getFishPuzzle) {
    this.getPuzzle = getPuzzle;
    this.bus = new EventBus();
    this.state = initialState;
    this.runner = null;
    this.renderer = null;

    this.requestNumber = 0;
    this.menuTab = 'play';

    // Is somebody already logged in? (from sessionStorage)
    this.user = auth.currentUser();
    this.loadPlayerData();

    // React components that want to know when something changes
    this.listeners = new Set();
    this.lastNotify = 0;
    this.snapshot = this.makeSnapshot();
  }

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => {
    return this.snapshot;
  };

  makeSnapshot() {
    let metresToGate = 0;
    if (this.runner !== null) {
      metresToGate = Math.round(this.runner.nextGateAt - this.runner.distance);
    }
    return {
      game: this.state,
      score: getScore(this.state.run),
      user: this.user,
      progress: this.progress,
      menuTab: this.menuTab,
      records: this.records,
      best: this.records.stats.bestScore,
      toGate: metresToGate,
    };
  }

  notify(isTick = false) {
    const now = performance.now();
    if (isTick && now - this.lastNotify < 100) {
      return;
    }
    this.lastNotify = now;
    this.snapshot = this.makeSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  dispatch(action) {
    const before = this.state;
    const after = gameReducer(before, action);
    this.state = after;

    // We just started waiting for a puzzle -> ask the Fish API
    const wasLoading = before.checkpoint !== null && before.checkpoint.status === 'loading';
    const isLoading = after.checkpoint !== null && after.checkpoint.status === 'loading';
    if (isLoading && !wasLoading) {
      this.loadPuzzle();
    }

    if (before.phase === Phase.CHECKPOINT && after.phase === Phase.RUNNING) {
      const enteredNewLevel = this.runner.leaveGate();
      if (enteredNewLevel) {
        this.dispatch({ type: 'LEVEL_UP', level: this.runner.levelIndex });
        this.unlockLevel(this.runner.levelIndex);
      }
    }

    // The game just ended -> save the score
    if (before.phase !== Phase.GAME_OVER && after.phase === Phase.GAME_OVER) {
      this.saveScore();
    }

    if (action.type !== 'TICK') {
      this.bus.emit(action.type, action);
    }

    this.notify(action.type === 'TICK');
  }

  async loadPuzzle() {
    this.requestNumber = this.requestNumber + 1;
    const myNumber = this.requestNumber;

    try {
      const puzzle = await this.getPuzzle();
      if (myNumber === this.requestNumber) {
        this.dispatch({ type: 'PUZZLE_LOADED', puzzle: puzzle });
      }
    } catch (error) {
      if (myNumber === this.requestNumber) {
        this.dispatch({ type: 'PUZZLE_FAILED', message: error.message });
      }
    }
  }

  saveScore() {
    const run = this.state.run;
    if (this.user === null || run === null) {
      return;
    }
    records.saveGame({
      name: this.user,
      score: getScore(run),
      distance: Math.floor(run.distance),
      coins: run.coins,
      correct: run.correct,
      wrong: run.wrong,
      level: run.level,
      dino: run.dino,
    });
    this.refreshRecords();
  }

  loadPlayerData() {
    if (this.user === null) {
      this.progress = { unlockedLevel: 0, level: 0, dino: 'rex' };
    } else {
      this.progress = records.loadProgress(this.user);
    }
    this.refreshRecords();
  }

  refreshRecords() {
    let stats = records.getPlayerStats('');
    if (this.user !== null) {
      stats = records.getPlayerStats(this.user);
    }
    this.records = {
      hallOfFame: records.getHallOfFame(),
      recentGames: records.getRecentGames(),
      stats: stats,
    };
  }

  // Remember the highest level this player has reached
  unlockLevel(levelIndex) {
    if (this.user !== null && levelIndex > this.progress.unlockedLevel) {
      this.progress = { ...this.progress, unlockedLevel: levelIndex };
      records.saveProgress(this.user, this.progress);
    }
  }

  chooseDino(dinoId) {
    this.progress = { ...this.progress, dino: dinoId };
    records.saveProgress(this.user, this.progress);
    this.notify();
  }

  chooseLevel(levelIndex) {
    if (levelIndex > this.progress.unlockedLevel) {
      return;
    }
    this.progress = { ...this.progress, level: levelIndex };
    records.saveProgress(this.user, this.progress);
    this.notify();
  }

  // Starts a run with the level and dinosaur chosen on the menu.
  startRun() {
    const dino = getDino(this.progress.dino);
    const level = Math.min(this.progress.level, this.progress.unlockedLevel);
    this.runner = new Runner({ level: level, dino: dino.id });
    this.requestNumber = this.requestNumber + 1;
    this.dispatch({ type: 'START_RUN', level: level, dino: dino.id, lives: dino.lives });
  }

  goToMenu(tab = 'play') {
    this.menuTab = tab;
    this.dispatch({ type: 'END_RUN' });
    this.requestNumber = this.requestNumber + 1;
    this.runner = null;
    this.dispatch({ type: 'BACK_TO_MENU' });
  }

  answer(index) {
    this.dispatch({ type: 'ANSWER', index: index });
  }

  nextPuzzle() {
    this.dispatch({ type: 'NEXT_PUZZLE' });
  }

  togglePause() {
    if (this.state.phase === Phase.PAUSED) {
      this.dispatch({ type: 'RESUME' });
    } else {
      this.dispatch({ type: 'PAUSE' });
    }
  }

  async signUp(name, pin, remember) {
    const username = await auth.signUp(name, pin, remember);
    this.setUser(username);
  }

  async logIn(name, pin, remember) {
    const username = await auth.logIn(name, pin, remember);
    this.setUser(username);
  }

  logOut() {
    auth.logOut();
    this.setUser(null);
    this.goToMenu();
  }

  setUser(name) {
    this.user = name;
    this.loadPlayerData();
    this.notify();
  }

  handleInput(move) {
    if (move === 'pause') {
      this.togglePause();
      return;
    }

    if (this.state.phase !== Phase.RUNNING) {
      return;
    }

    if (move === 'left') this.runner.moveLeft();
    if (move === 'right') this.runner.moveRight();
    if (move === 'jump') this.runner.jump();
    if (move === 'slide') this.runner.slide();
  }

  attachRenderer(renderer) {
    this.renderer = renderer;
    // The renderer listens for 'HIT' events to shake the camera.
    this.stopShake = this.bus.on('HIT', () => renderer.shake());
  }

  detachRenderer() {
    if (this.stopShake) {
      this.stopShake();
    }
    this.renderer = null;
  }

  start() {
    let lastTime = null;

    const frame = (time) => {
      this.frameId = requestAnimationFrame(frame);

      let dt = 0;
      if (lastTime !== null) {
        dt = Math.min(0.05, (time - lastTime) / 1000);
      }
      lastTime = time;

      this.update(dt);
    };

    this.frameId = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.frameId);
  }

  update(dt) {
    const phase = this.state.phase;

    if (this.runner !== null && (phase === Phase.RUNNING || phase === Phase.CHECKPOINT)) {
      const events = this.runner.update(dt);

      this.dispatch({ type: 'TICK', dt: dt, distance: this.runner.distance });

      for (const eventName of events) {
        this.dispatch({ type: eventName });
      }
    }

    if (this.renderer !== null) {
      const menuChoice = { level: this.progress.level, dino: this.progress.dino };
      if (phase === Phase.PAUSED || phase === Phase.GAME_OVER) {
        this.renderer.render(0, this.runner, menuChoice);
      } else {
        this.renderer.render(dt, this.runner, menuChoice);
      }
    }
  }
}
