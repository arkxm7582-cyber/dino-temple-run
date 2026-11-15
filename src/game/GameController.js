// =============================================================
// GameController.js
// =============================================================
// The GameController is the "glue" of the game. It is the only class
// that knows about all the other parts. The other parts do not know
// about each other, which keeps them independent (low coupling):
//
//   Runner       (game/Runner.js)        moves the dino, finds collisions
//   gameReducer  (game/gameState.js)     the rules and phases
//   EventBus     (game/EventBus.js)      tells listeners what happened
//   Renderer     (render/Renderer.js)    draws the 3D scene
//   fishApi      (services/fishApi.js)   gets puzzles from the internet
//   auth, records (services/...)         login, saved games and progress
//   React screens (ui/Screens.jsx)       read the data and call methods here
//
// Example of one event from start to finish:
//   1. runner.update() returns 'HIT'
//   2. dispatch({ type: 'HIT' }) asks gameReducer for the new state (one life less)
//   3. bus.emit('HIT') tells every listener -> the Renderer shakes the camera
//   4. notify() tells React -> the hearts on screen are redrawn
// =============================================================
import { gameReducer, initialState, Phase, getScore } from './gameState.js';
import { Runner } from './Runner.js';
import { EventBus } from './EventBus.js';
import { getFishPuzzle } from '../services/fishApi.js';
import * as auth from '../services/auth.js';
import * as records from '../services/records.js';
import { getDino } from './config.js';

export class GameController {
  // The function that gets a puzzle is passed in. Normally it is the real
  // Fish API, but the tests pass a fake one so they don't need the internet.
  constructor(getPuzzle = getFishPuzzle) {
    this.getPuzzle = getPuzzle;
    this.bus = new EventBus();
    this.state = initialState;
    this.runner = null;   // a new Runner is made for every run
    this.renderer = null; // set by attachRenderer()

    // Counts the puzzle requests. If an old request answers late (for
    // example after the player left the gate) its answer is ignored.
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

  // ===========================================================
  // Connection to React
  // React calls subscribe() once and getSnapshot() to read the data.
  // (They are arrow functions so "this" still works when React calls them.)
  // ===========================================================
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => {
    return this.snapshot;
  };

  // Everything the screens need to show, in one object.
  makeSnapshot() {
    let metresToGate = 0;
    if (this.runner !== null) {
      metresToGate = Math.round(this.runner.nextGateAt - this.runner.distance);
    }
    return {
      game: this.state,
      score: getScore(this.state.run),
      user: this.user,
      progress: this.progress, // unlocked level, chosen level and dino
      menuTab: this.menuTab,   // which menu tab to open first
      records: this.records,   // hall of fame, recent games, my stats
      best: this.records.stats.bestScore,
      toGate: metresToGate,
    };
  }

  // Tell React that something changed so the screen is redrawn.
  // TICK events happen 60 times a second, which is more often than needed,
  // so for those we only redraw every 100 milliseconds.
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

  // ===========================================================
  // dispatch() - EVERY event in the game goes through here.
  // ===========================================================
  dispatch(action) {
    const before = this.state;
    const after = gameReducer(before, action);
    this.state = after;

    // The reducer is not allowed to do "side effects" (internet, saving,
    // moving the Runner), so they are done here by comparing before/after.

    // We just started waiting for a puzzle -> ask the Fish API
    const wasLoading = before.checkpoint !== null && before.checkpoint.status === 'loading';
    const isLoading = after.checkpoint !== null && after.checkpoint.status === 'loading';
    if (isLoading && !wasLoading) {
      this.loadPuzzle();
    }

    // The fish question was answered correctly -> open the gate and run on.
    // If that was the last gate of the level, move to the next level.
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

    // Tell the EventBus listeners (TICK is too frequent to be useful there)
    if (action.type !== 'TICK') {
      this.bus.emit(action.type, action);
    }

    this.notify(action.type === 'TICK');
  }

  // Asks the Fish API for a puzzle. This takes time (it goes over the
  // internet), so it is "async". When the answer comes back it becomes
  // another event: PUZZLE_LOADED or PUZZLE_FAILED.
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

  // Saves the finished game in the history (who played, score, level, ...)
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

  // ===========================================================
  // Player data: progress (unlocked levels, chosen dino) and records
  // ===========================================================

  loadPlayerData() {
    if (this.user === null) {
      this.progress = { unlockedLevel: 0, level: 0, dino: 'rex' };
    } else {
      this.progress = records.loadProgress(this.user);
    }
    this.refreshRecords();
  }

  // Reads the hall of fame, recent games and stats again from storage.
  // (Done only when something changes, not every frame, because reading
  // storage is slow compared to the game loop.)
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
      return; // still locked
    }
    this.progress = { ...this.progress, level: levelIndex };
    records.saveProgress(this.user, this.progress);
    this.notify();
  }

  // ===========================================================
  // Methods called by the buttons on the screens
  // ===========================================================

  // Starts a run with the level and dinosaur chosen on the menu.
  startRun() {
    const dino = getDino(this.progress.dino);
    const level = Math.min(this.progress.level, this.progress.unlockedLevel);
    this.runner = new Runner({ level: level, dino: dino.id });
    this.requestNumber = this.requestNumber + 1; // ignore a puzzle still loading from an old run
    this.dispatch({ type: 'START_RUN', level: level, dino: dino.id, lives: dino.lives });
  }

  // Go back to the main menu from anywhere (fish gate, pause, game over).
  // tab = which menu tab to open ('play', 'fame', 'stats' or 'help').
  goToMenu(tab = 'play') {
    this.menuTab = tab;
    this.dispatch({ type: 'END_RUN' }); // if a run was going on, this ends it and saves the score
    this.requestNumber = this.requestNumber + 1; // ignore a puzzle that is still loading
    this.runner = null;
    this.dispatch({ type: 'BACK_TO_MENU' });
  }

  answer(index) {
    this.dispatch({ type: 'ANSWER', index: index });
  }

  // "Next puzzle" in the "You lost a life" box: try the same gate again
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

  // ----- login (the real work is in services/auth.js) -----
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

  // ----- keyboard and swipe input -----
  // move is one of: 'left', 'right', 'jump', 'slide', 'pause'
  handleInput(move) {
    if (move === 'pause') {
      this.togglePause();
      return;
    }

    // moving only works while running
    if (this.state.phase !== Phase.RUNNING) {
      return;
    }

    if (move === 'left') this.runner.moveLeft();
    if (move === 'right') this.runner.moveRight();
    if (move === 'jump') this.runner.jump();
    if (move === 'slide') this.runner.slide();
  }

  // ===========================================================
  // The game loop
  // ===========================================================

  attachRenderer(renderer) {
    this.renderer = renderer;
    // The renderer listens for 'HIT' events to shake the camera.
    this.stopShake = this.bus.on('HIT', () => renderer.shake());
  }

  detachRenderer() {
    if (this.stopShake) {
      this.stopShake(); // stop listening
    }
    this.renderer = null;
  }

  // Starts the loop. requestAnimationFrame asks the browser to call our
  // function before the next screen refresh (about 60 times per second).
  start() {
    let lastTime = null;

    const frame = (time) => {
      this.frameId = requestAnimationFrame(frame); // ask for the next frame straight away

      // dt = seconds since the last frame. It is capped at 0.05 so that one
      // slow frame can't make the dino move so far it skips an obstacle.
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

  // One frame of the game.
  update(dt) {
    const phase = this.state.phase;

    if (this.runner !== null && (phase === Phase.RUNNING || phase === Phase.CHECKPOINT)) {
      // 1. move the world
      const events = this.runner.update(dt);

      // 2. time passed (updates the distance and the fish timer)
      this.dispatch({ type: 'TICK', dt: dt, distance: this.runner.distance });

      // 3. one event for each thing that happened (HIT, COIN_COLLECTED, ...)
      for (const eventName of events) {
        this.dispatch({ type: eventName });
      }
    }

    // 4. draw the picture (frozen while paused or game over).
    //    On the menu there is no runner, so the renderer is told which
    //    level and dino are chosen, to show them in the background.
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
