import {
  PLAYER, CHECKPOINT, OBSTACLES, LANE_WIDTH, LEVELS, GATES_PER_LEVEL, SPEED_UP_PER_100M, laneToX, getDino,
} from './config.js';

let nextId = 1;

export class Runner {
  constructor(options = {}) {
    this.random = options.random || Math.random;
    this.dino = getDino(options.dino);
    this.levelIndex = options.level || 0;
    this.gatesInLevel = 0;
    this.levelStartDistance = 0;

    this.distance = 0;
    this.speed = 0;

    // Everything about the dinosaur
    this.player = {
      lane: 1,
      x: 0,
      y: 0,
      vy: 0,
      jumping: false,
      sliding: false,
      slideTimer: 0,
      hurtTimer: 0,
    };

    this.obstacles = [];
    this.coins = [];

    // The fish gates
    this.nextGateAt = CHECKPOINT.every;
    this.gates = [{ at: this.nextGateAt, open: false }];
    this.atGate = false;
    this.warned = false;

    // Where the next row of obstacles will be placed
    this.nextRowAt = 50;
    this.spawnAhead();
  }

  moveLeft() {
    if (this.player.lane === 0) {
      return false;
    }
    this.player.lane = this.player.lane - 1;
    return true;
  }

  moveRight() {
    if (this.player.lane === 2) {
      return false;
    }
    this.player.lane = this.player.lane + 1;
    return true;
  }

  jump() {
    const p = this.player;
    if (p.jumping) {
      return false;
    }
    p.jumping = true;
    p.sliding = false;
    p.vy = this.dino.jumpSpeed;
    return true;
  }

  slide() {
    const p = this.player;
    if (p.jumping) {
      return false;
    }
    p.sliding = true;
    p.slideTimer = PLAYER.slideTime;
    return true;
  }

  leaveGate() {
    const currentGate = this.gates[this.gates.length - 1];
    currentGate.open = true;

    this.atGate = false;
    this.warned = false;
    this.nextGateAt = this.nextGateAt + CHECKPOINT.every;
    this.gates.push({ at: this.nextGateAt, open: false });

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

  get level() {
    return LEVELS[this.levelIndex];
  }

  update(dt) {
    const events = [];

    this.updatePlayer(dt);

    // While stopped at a gate the world does not move.
    if (this.atGate) {
      this.speed = 0;
      return events;
    }

    const metresInLevel = this.distance - this.levelStartDistance;
    const speed = this.level.startSpeed + (SPEED_UP_PER_100M * metresInLevel) / 100;
    this.speed = Math.min(speed, this.level.maxSpeed);

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

  updatePlayer(dt) {
    const p = this.player;

    p.hurtTimer = p.hurtTimer - dt;
    if (p.hurtTimer < 0) {
      p.hurtTimer = 0;
    }

    if (p.jumping) {
      p.vy = p.vy - PLAYER.gravity * dt;
      p.y = p.y + p.vy * dt;

      if (p.y <= 0) {
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

    const targetX = laneToX(p.lane);
    const maxStep = this.dino.laneSpeed * dt;
    const gap = targetX - p.x;

    if (Math.abs(gap) <= maxStep) {
      p.x = targetX;
    } else if (gap > 0) {
      p.x = p.x + maxStep;
    } else {
      p.x = p.x - maxStep;
    }
  }

  checkObstacles(events) {
    for (const obstacle of this.obstacles) {
      if (obstacle.hit) {
        continue;
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

    const overlapUpDown = p.y < type.yMax && p.y + playerHeight > type.yMin;

    return overlapSideways && overlapAlong && overlapUpDown;
  }

  checkCoins(events) {
    const p = this.player;
    for (const coin of this.coins) {
      if (coin.taken) {
        continue;
      }
      const closeSideways = Math.abs(p.x - laneToX(coin.lane)) < 1;
      const closeAlong = Math.abs(this.distance - coin.at) < 1;
      const lowEnough = p.y < 1.5;

      if (closeSideways && closeAlong && lowEnough) {
        coin.taken = true;
        events.push('COIN_COLLECTED');
      }
    }
  }

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

      let space = 11 + this.speed * 0.3;
      if (space < 14) {
        space = 14;
      }
      this.nextRowAt = this.nextRowAt + space + this.random() * 6;
    }
  }

  isNearGate(at) {
    // How far into the current 300 m section this position is
    const intoSection = at % CHECKPOINT.every;
    const justAfterGate = intoSection < CHECKPOINT.clearZone;
    const justBeforeGate = intoSection > CHECKPOINT.every - CHECKPOINT.clearZone;
    return justAfterGate || justBeforeGate;
  }

  makeRow(at) {
    const lanes = this.shuffle([0, 1, 2]);

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

    const roll = this.random();
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

    let choices = freeLanes;
    if (freeLanes.length === 0) {
      choices = [0, 1, 2];
    }
    const lane = choices[Math.floor(this.random() * choices.length)];

    for (let i = 0; i < 5; i++) {
      this.coins.push({ id: nextId, lane: lane, at: at + 3 + i * 2.5, taken: false });
      nextId = nextId + 1;
    }
  }

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

  removeOldObjects() {
    const behind = this.distance - 20;
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.at > behind);
    this.coins = this.coins.filter((coin) => coin.at > behind && !coin.taken);
    this.gates = this.gates.filter((gate) => gate.at > behind - 30);
  }
}
