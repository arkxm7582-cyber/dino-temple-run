// Tests for game/Runner.js (the physics / world).
import { describe, it, expect } from 'vitest';
import { Runner } from '../src/game/Runner.js';
import { CHECKPOINT, GATES_PER_LEVEL, LEVELS, laneToX } from '../src/game/config.js';

// Runs the world for `seconds` and collects all events.
function runFor(runner, seconds) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...runner.update(1 / 60));
  return events;
}

describe('Runner', () => {
  it('changes lane but not past the edges', () => {
    const r = new Runner();
    expect(r.moveLeft()).toBe(true);
    expect(r.moveLeft()).toBe(false);
    runFor(r, 0.5);
    expect(r.player.x).toBeCloseTo(laneToX(0));
  });

  it('jumps up and lands again', () => {
    const r = new Runner();
    r.obstacles = []; // empty track so nothing gets in the way
    r.jump();
    runFor(r, 0.3);
    expect(r.player.y).toBeGreaterThan(1);
    runFor(r, 1);
    expect(r.player.y).toBe(0);
    expect(r.player.jumping).toBe(false);
  });

  it('every row of obstacles leaves a way through', () => {
    const r = new Runner();
    for (let i = 0; i < 500; i++) {
      const row = r.makeRow(100);
      const fullRow = row.length === 3;
      const sameType = row.every((o) => o.type === row[0].type);
      // either a lane is free, or the full row is all rocks (jump) or all barriers (slide)
      expect(!fullRow || (sameType && row[0].type !== 'pillar')).toBe(true);
    }
  });

  it('no obstacles are placed near a gate', () => {
    const r = new Runner();
    r.distance = CHECKPOINT.every * 3;
    r.spawnAhead();
    for (const o of r.obstacles) {
      const intoSection = o.at % CHECKPOINT.every;
      expect(intoSection >= CHECKPOINT.clearZone && intoSection <= CHECKPOINT.every - CHECKPOINT.clearZone).toBe(true);
    }
  });

  it('a hit is reported once and then the dino is safe for a moment', () => {
    const r = new Runner();
    r.obstacles = [{ id: 1, type: 'pillar', lane: 1, at: r.distance + 3, hit: false }];
    const events = runFor(r, 0.5);
    expect(events.filter((e) => e === 'HIT')).toHaveLength(1);
    expect(r.player.hurtTimer).toBeGreaterThan(0);
  });

  it('jumping clears a rock and sliding passes under a barrier', () => {
    const jumper = new Runner();
    jumper.obstacles = [{ id: 1, type: 'rock', lane: 1, at: 5, hit: false }];
    runFor(jumper, 0.1);
    jumper.jump();
    expect(runFor(jumper, 1)).not.toContain('HIT');

    const slider = new Runner();
    slider.obstacles = [{ id: 2, type: 'barrier', lane: 1, at: 4, hit: false }];
    slider.slide();
    expect(runFor(slider, 0.6)).not.toContain('HIT');
  });

  it('stops exactly at the gate and continues from there after leaveGate()', () => {
    const r = new Runner();
    r.obstacles = [];
    r.distance = CHECKPOINT.every - 5;
    const events = runFor(r, 2);
    expect(events).toContain('GATE_REACHED');
    expect(r.distance).toBe(CHECKPOINT.every);
    runFor(r, 1);
    expect(r.distance).toBe(CHECKPOINT.every); // still waiting at the gate

    r.leaveGate();
    runFor(r, 0.5);
    expect(r.distance).toBeGreaterThan(CHECKPOINT.every);
    expect(r.nextGateAt).toBe(CHECKPOINT.every * 2);
  });

  it('moves to the next level after enough gates, but the last level never ends', () => {
    const r = new Runner({ level: 0 });
    let changed = false;
    for (let i = 0; i < GATES_PER_LEVEL; i++) changed = r.leaveGate();
    expect(changed).toBe(true);
    expect(r.levelIndex).toBe(1);

    const last = new Runner({ level: LEVELS.length - 1 });
    for (let i = 0; i < GATES_PER_LEVEL * 2; i++) last.leaveGate();
    expect(last.levelIndex).toBe(LEVELS.length - 1);
  });

  it('later levels are faster', () => {
    const slow = new Runner({ level: 0 });
    const fast = new Runner({ level: 2 });
    slow.obstacles = []; fast.obstacles = [];
    slow.update(0.1); fast.update(0.1);
    expect(fast.speed).toBeGreaterThan(slow.speed);
  });

  it('the T-Rex jumps higher than the Triceratops', () => {
    const peak = (dino) => {
      const r = new Runner({ dino });
      r.obstacles = [];
      r.jump();
      let highest = 0;
      for (let t = 0; t < 1; t += 1 / 60) { r.update(1 / 60); highest = Math.max(highest, r.player.y); }
      return highest;
    };
    expect(peak('rex')).toBeGreaterThan(peak('trike'));
  });
});
