// =============================================================
// Runner.js
// =============================================================
// This class is the "world" of one run: the dinosaur, the obstacles,
// the coins and the fish gates.
//
// It only does the maths (movement, gravity, collisions). It does NOT
// draw anything and it does NOT use React. Keeping it separate means:
//   - it can be tested on its own (see tests/runner.test.js)
//   - the Renderer can simply read the numbers and draw them
//
// How positions work:
//   this.distance = how far the dino has run from the start (metres)
//   obstacle.at   = where an obstacle is on the track (metres)
//   so an obstacle is (obstacle.at - this.distance) metres ahead of the dino
// =============================================================
import {
  PLAYER, CHECKPOINT, OBSTACLES, LANE_WIDTH, LEVELS, GATES_PER_LEVEL, SPEED_UP_PER_100M, laneToX, getDino,
} from './config.js';

// Every obstacle and coin gets its own id number.
// The Renderer uses the id to know which 3D model belongs to which object.
let nextId = 1;

export class Runner {
  // options:
  //   level  = which level to start in (0, 1 or 2)
  //   dino   = 'rex' or 'trike' (changes jump height and lane speed)
  //   random = normally Math.random; tests can pass their own function
  //            so that the obstacles are predictable
  constructor(options = {}) {
    this.random = options.random || Math.random;
    this.dino = getDino(options.dino);
    this.levelIndex = options.level || 0;
    this.gatesInLevel = 0;        // fish gates passed in the current level
    this.levelStartDistance = 0;  // where the current level started

    this.distance = 0; // metres run so far
    this.speed = 0;    // current speed (m/s)

    // Everything about the dinosaur
    this.player = {
      lane: 1,          // which lane it wants to be in (0, 1 or 2)
      x: 0,             // where it actually is sideways (moves smoothly to the lane)
      y: 0,             // height above the floor (0 = on the ground)
      vy: 0,            // vertical speed (positive = going up)
      jumping: false,
      sliding: false,
      slideTimer: 0,    // seconds of sliding left
      hurtTimer: 0,     // seconds left of "just got hit" (dino flashes)
    };

    this.obstacles = []; // list of { id, type, lane, at, hit }
    this.coins = [];     // list of { id, lane, at, taken }

    // The fish gates
    this.nextGateAt = CHECKPOINT.every;                // where the next gate is
    this.gates = [{ at: this.nextGateAt, open: false }]; // gates the renderer should draw
    this.atGate = false; // true while the dino is stopped at a gate
    this.warned = false; // true once "Fish gate ahead" has been sent for this gate

    // Where the next row of obstacles will be placed
    this.nextRowAt = 50;
    this.spawnAhead();
  }

  // ===========================================================
  // Controls - called when the player presses a key or swipes.
  // Each one returns true if the move happened, false if not.
  // ===========================================================

  moveLeft() {
    if (this.player.lane === 0) {
      return false; // already in the left lane
    }
    this.player.lane = this.player.lane - 1;
    return true;
  }

  moveRight() {
    if (this.player.lane === 2) {
      return false; // already in the right lane
    }
    this.player.lane = this.player.lane + 1;
    return true;
  }

  jump() {
    const p = this.player;
    if (p.jumping) {
      return false; // can't jump again while in the air
    }
    p.jumping = true;
    p.sliding = false;
    p.vy = this.dino.jumpSpeed; // start moving upwards (the T-Rex jumps a bit higher)
    return true;
  }

  slide() {
    const p = this.player;
    if (p.jumping) {
      return false; // can't slide in the air
    }
    p.sliding = true;
    p.slideTimer = PLAYER.slideTime;
    return true;
  }

  // Called by the GameController after a correct fish answer.
  // Opens the current gate and creates the next one further down the track.
  // Returns true if passing this gate took the dino into a NEW level.
  leaveGate() {
    const currentGate = this.gates[this.gates.length - 1];
    currentGate.open = true;

    this.atGate = false;
    this.warned = false;
    this.nextGateAt = this.nextGateAt + CHECKPOINT.every;
    this.gates.push({ at: this.nextGateAt, open: false });

    // Enough gates passed in this level? Then move to the next level
    // (unless this is already the last level, which never ends).
    this.gatesInLevel = this.gatesInLevel + 1;
    const isLastLevel = this.levelIndex === LEVELS.length - 1;
    if (this.gatesInLevel >= GATES_PER_LEVEL && !isLastLevel) {
      this.levelIndex = this.levelIndex + 1;
      this.gatesInLevel = 0;
      this.levelStartDistance = this.distance;
      return true;
    }
    return false;
  }

  // The settings of the level the dino is in now (colours, speed, ...)
  get level() {
    return LEVELS[this.levelIndex];
  }

  // ===========================================================
  // update() - moves the world forward by dt seconds.
  // It is called about 60 times per second by the GameController.
  //
  // It returns a list of the things that happened in this step,
  // for example ['COIN_COLLECTED', 'HIT']. The GameController turns
  // each of these into an event.
  // ===========================================================
  update(dt) {
    const events = [];

    this.updatePlayer(dt);

    // While stopped at a gate the world does not move.
    if (this.atGate) {
      this.speed = 0;
      return events;
    }

    // Every level has its own start speed. Inside a level the speed goes
    // up a little with distance, but never above that level's maxSpeed.
    const metresInLevel = this.distance - this.levelStartDistance;
    const speed = this.level.startSpeed + (SPEED_UP_PER_100M * metresInLevel) / 100;
    this.speed = Math.min(speed, this.level.maxSpeed);

    // distance = speed x time
    this.distance = this.distance + this.speed * dt;

    // Close to the gate? Send a warning once.
    const metresToGate = this.nextGateAt - this.distance;
    if (this.warned === false && metresToGate <= CHECKPOINT.warnAt) {
      this.warned = true;
      events.push('GATE_AHEAD');
    }

    // Reached the gate? Stop exactly on it.
    if (this.distance >= this.nextGateAt) {
      this.distance = this.nextGateAt;
      this.atGate = true;
      events.push('GATE_REACHED');
    }

    this.checkObstacles(events);
    this.checkCoins(events);
    this.spawnAhead();
    this.removeOldObjects();

    return events;
  }

  // Moves the dinosaur up/down (jump), handles sliding,
  // and moves it sideways towards its lane.
  updatePlayer(dt) {
    const p = this.player;

    // Count down the "hurt" time
    p.hurtTimer = p.hurtTimer - dt;
    if (p.hurtTimer < 0) {
      p.hurtTimer = 0;
    }

    // Jumping: gravity slows the dino down and then pulls it back to the floor
    if (p.jumping) {
      p.vy = p.vy - PLAYER.gravity * dt;
      p.y = p.y + p.vy * dt;

      if (p.y <= 0) {
        // landed
        p.y = 0;
        p.vy = 0;
        p.jumping = false;
      }
    }

    // Sliding only lasts a fixed amount of time
    if (p.sliding) {
      p.slideTimer = p.slideTimer - dt;
      if (p.slideTimer <= 0) {
        p.sliding = false;
      }
    }

    // Move sideways towards the chosen lane a little each frame
    // (so a lane change looks smooth instead of teleporting).
    const targetX = laneToX(p.lane);
    const maxStep = this.dino.laneSpeed * dt; // the T-Rex is quicker sideways
    const gap = targetX - p.x;

    if (Math.abs(gap) <= maxStep) {
      p.x = targetX; // close enough, snap to the lane
    } else if (gap > 0) {
      p.x = p.x + maxStep; // move right
    } else {
      p.x = p.x - maxStep; // move left
    }
  }

  // ===========================================================
  // Collisions
  // ===========================================================

  // Checks if the dino touches any obstacle.
  checkObstacles(events) {
    for (const obstacle of this.obstacles) {
      if (obstacle.hit) {
        continue; // each obstacle can only hurt you once
      }
      if (!this.isTouching(obstacle)) {
        continue;
      }

      obstacle.hit = true;

      // Just got hit recently? Then this one doesn't count.
      if (this.player.hurtTimer > 0) {
        continue;
      }

      this.player.hurtTimer = PLAYER.hurtTime;
      events.push('HIT');
    }
  }

  // "Box against box" test. The dino and the obstacle are both treated as
  // boxes. They touch only if they overlap in ALL three directions:
  // sideways (x), along the track, and up/down (y).
  isTouching(obstacle) {
    const p = this.player;
    const type = OBSTACLES[obstacle.type];

    let playerHeight = PLAYER.height;
    if (p.sliding) {
      playerHeight = PLAYER.slideHeight;
    }

    const obstacleHalfWidth = (LANE_WIDTH * 0.8) / 2;

    const sidewaysGap = Math.abs(p.x - laneToX(obstacle.lane));
    const overlapSideways = sidewaysGap < PLAYER.width / 2 + obstacleHalfWidth;

    const alongGap = Math.abs(this.distance - obstacle.at);
    const overlapAlong = alongGap < PLAYER.width / 2 + type.depth / 2;

    // The dino is between y and y + height. The obstacle is between yMin and yMax.
    const overlapUpDown = p.y < type.yMax && p.y + playerHeight > type.yMin;

    return overlapSideways && overlapAlong && overlapUpDown;
  }

  // Picks up coins that the dino runs through.
  checkCoins(events) {
    const p = this.player;
    for (const coin of this.coins) {
      if (coin.taken) {
        continue;
      }
      const closeSideways = Math.abs(p.x - laneToX(coin.lane)) < 1;
      const closeAlong = Math.abs(this.distance - coin.at) < 1;
      const lowEnough = p.y < 1.5; // coins float at 1 m, a high jump goes over them

      if (closeSideways && closeAlong && lowEnough) {
        coin.taken = true;
        events.push('COIN_COLLECTED');
      }
    }
  }

  // ===========================================================
  // Creating and removing obstacles
  // ===========================================================

  // Keeps the next 150 m of track filled with obstacles and coins.
  spawnAhead() {
    while (this.nextRowAt < this.distance + 150) {
      const at = this.nextRowAt;

      if (!this.isNearGate(at)) {
        const row = this.makeRow(at);
        for (const obstacle of row) {
          this.obstacles.push(obstacle);
        }
        this.addCoins(at, row);
      }

      // Space until the next row. More space at higher speed,
      // so the player always has time to react. Plus a random extra bit.
      let space = 11 + this.speed * 0.3;
      if (space < 14) {
        space = 14;
      }
      this.nextRowAt = this.nextRowAt + space + this.random() * 6;
    }
  }

  // True if this position is close to a fish gate (no obstacles allowed there).
  isNearGate(at) {
    // How far into the current 300 m section this position is
    const intoSection = at % CHECKPOINT.every;
    const justAfterGate = intoSection < CHECKPOINT.clearZone;
    const justBeforeGate = intoSection > CHECKPOINT.every - CHECKPOINT.clearZone;
    return justAfterGate || justBeforeGate;
  }

  // Creates one row of obstacles at random.
  // Every row can be passed: either at least one lane is free,
  // or the whole row is rocks (jump) or barriers (slide).
  // Later levels have more "hard" rows with two obstacles.
  makeRow(at) {
    // put the lanes in a random order so obstacles appear in random lanes
    const lanes = this.shuffle([0, 1, 2]);

    // ----- hard rows: two obstacles, one lane stays free -----
    if (this.random() < this.level.hardRows) {
      const roll = this.random();
      if (roll < 0.4) {
        return [this.makeObstacle('pillar', lanes[0], at), this.makeObstacle('pillar', lanes[1], at)];
      }
      if (roll < 0.7) {
        return [this.makeObstacle('pillar', lanes[0], at), this.makeObstacle('rock', lanes[1], at)];
      }
      return [this.makeObstacle('pillar', lanes[0], at), this.makeObstacle('barrier', lanes[1], at)];
    }

    // ----- normal rows -----
    const roll = this.random(); // a random number between 0 and 1
    // EASY CHANGE: the numbers below are the chances of each kind of row
    if (roll < 0.3) {
      // 30%: one rock
      return [this.makeObstacle('rock', lanes[0], at)];
    }
    if (roll < 0.6) {
      // 30%: one pillar
      return [this.makeObstacle('pillar', lanes[0], at)];
    }
    if (roll < 0.8) {
      // 20%: barriers across all lanes -> must slide
      return [this.makeObstacle('barrier', 0, at), this.makeObstacle('barrier', 1, at), this.makeObstacle('barrier', 2, at)];
    }
    // 20%: rocks across all lanes -> must jump
    return [this.makeObstacle('rock', 0, at), this.makeObstacle('rock', 1, at), this.makeObstacle('rock', 2, at)];
  }

  makeObstacle(type, lane, at) {
    const obstacle = { id: nextId, type: type, lane: lane, at: at, hit: false };
    nextId = nextId + 1;
    return obstacle;
  }

  // Adds a line of 5 coins in a free lane, just after the row.
  addCoins(at, row) {
    // find the lanes that have no obstacle in this row
    const freeLanes = [];
    for (const lane of [0, 1, 2]) {
      const blocked = row.some((obstacle) => obstacle.lane === lane);
      if (!blocked) {
        freeLanes.push(lane);
      }
    }

    // if every lane is blocked (a full row of rocks/barriers) any lane is fine
    let choices = freeLanes;
    if (freeLanes.length === 0) {
      choices = [0, 1, 2];
    }
    const lane = choices[Math.floor(this.random() * choices.length)];

    for (let i = 0; i < 5; i++) { // EASY CHANGE: 5 coins in each line
      this.coins.push({ id: nextId, lane: lane, at: at + 3 + i * 2.5, taken: false });
      nextId = nextId + 1;
    }
  }

  // Fisher-Yates shuffle: puts the items of a list in a random order.
  shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  // Forgets obstacles, coins and gates that are already behind the dino,
  // so the lists don't keep growing forever.
  removeOldObjects() {
    const behind = this.distance - 20;
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.at > behind);
    this.coins = this.coins.filter((coin) => coin.at > behind && !coin.taken);
    this.gates = this.gates.filter((gate) => gate.at > behind - 30);
  }
}
