// =============================================================
// config.js
// =============================================================
// Every number that controls the game is kept in this one file:
// the dinosaurs, the levels, speeds, the fish gates and the points.
// If I want to make the game easier or harder I only change values here.
// Units used: metres (m) and seconds (s).
//
// Lines marked "EASY CHANGE" are the ones most likely to be changed.
// Change the number, save the file, and the game updates by itself
// (when running with "npm run dev").
// =============================================================

// ---------- the track ----------
// The track has 3 lanes: 0 = left, 1 = middle, 2 = right.
export const LANE_WIDTH = 2.6; // distance between the centre of two lanes

// Turns a lane number into an x position in the 3D world.
//   lane 0 -> -2.6 (left),  lane 1 -> 0 (middle),  lane 2 -> +2.6 (right)
export function laneToX(lane) {
  return (lane - 1) * LANE_WIDTH;
}

// ---------- the dinosaurs ----------
// The player picks one on the menu. Each one plays a bit differently.
//   lives     = lives at the start of a run
//   laneSpeed = how fast it moves sideways when changing lane (m/s)
//   jumpSpeed = upward speed at the start of a jump (higher = higher jump)
export const DINOS = [
  {
    id: 'rex',
    name: 'T-Rex',
    about: 'Fast and agile: changes lane quickly and jumps high.',
    lives: 3,          // EASY CHANGE: lives of the T-Rex
    laneSpeed: 18,
    jumpSpeed: 10.5,
    skin: '#c8662a',   // EASY CHANGE: colour of the T-Rex
    belly: '#efc890',
  },
  {
    id: 'trike',
    name: 'Triceratops',
    about: 'Tough: one extra life, but a little slower to change lane.',
    lives: 4,          // EASY CHANGE: lives of the Triceratops
    laneSpeed: 13,
    jumpSpeed: 10,
    skin: '#5d7f45',   // EASY CHANGE: colour of the Triceratops
    belly: '#d6c99a',
  },
];

// Finds a dinosaur by its id (e.g. 'rex'). Falls back to the first one.
export function getDino(id) {
  for (const dino of DINOS) {
    if (dino.id === id) {
      return dino;
    }
  }
  return DINOS[0];
}

// The parts of the dinosaur that are the same for both
export const PLAYER = {
  width: 0.9,        // how wide the collision box is
  height: 2.1,       // height when standing
  slideHeight: 0.85, // height when sliding (low enough to go under a barrier)
  gravity: 28,       // how fast it falls back down after a jump
  slideTime: 0.75,   // how long one slide lasts (s)
  hurtTime: 1.5,     // after being hit, it can't be hit again for this long (s)
};

// ---------- the levels ----------
// A run goes through the levels in order. After passing GATES_PER_LEVEL
// fish gates the dino enters the next level. The last level never ends.
//   startSpeed / maxSpeed = how fast the dino runs in this level (m/s)
//   hardRows   = chance (0 to 1) that a row has two obstacles instead of one
//   sky, skyLow = colour at the top and at the bottom of the sky
//   scenery    = which things are placed beside the track (see Renderer.js)
export const GATES_PER_LEVEL = 3; // EASY CHANGE: fish gates needed to reach the next level

export const LEVELS = [
  {
    name: 'Jungle Temple', // EASY CHANGE: level name shown on the menu and in the game
    startSpeed: 12,        // EASY CHANGE: speed of level 1 (lower = easier)
    maxSpeed: 17,
    hardRows: 0.2,
    sky: '#5fb0e8',
    skyLow: '#cfeee6',
    fog: '#b9e0d6',
    ground: '#b7905e',
    grass: '#4a8f35',
    stone: '#8f8574',
    mountains: '#5d8a6b',
    sun: '#fff1d6',
    scenery: 'jungle',
  },
  {
    name: 'Desert Canyon',
    startSpeed: 15.5,
    maxSpeed: 21,
    hardRows: 0.35,
    sky: '#4a8fd4',
    skyLow: '#f6d7a8',
    fog: '#f0cf9c',
    ground: '#d9a866',
    grass: '#c98f4f',
    stone: '#b0703f',
    mountains: '#b8693a',
    sun: '#ffe4b5',
    scenery: 'desert',
  },
  {
    name: 'Volcano Valley',
    startSpeed: 19,
    maxSpeed: 25,
    hardRows: 0.5,
    sky: '#1d0f14',
    skyLow: '#8a3a22',
    fog: '#5a2a22',
    ground: '#6a5248',
    grass: '#3a2e2a',
    stone: '#3e3634',
    mountains: '#2a1a18',
    sun: '#ff9a5a',
    scenery: 'volcano',
  },
];

// The game also gets a little faster the further you run inside a level
export const SPEED_UP_PER_100M = 0.4;

// ---------- the fish gates (checkpoints) ----------
export const CHECKPOINT = {
  every: 300,        // EASY CHANGE: there is a fish gate every 300 m
  warnAt: 80,        // show "Fish gate ahead!" when 80 m away
  clearZone: 40,     // no obstacles within 40 m of a gate
  questionTime: 15,  // EASY CHANGE: seconds the player has to answer
  feedbackTime: 1.5, // seconds the "Correct!" / "Wrong!" message stays
};

// ---------- points ----------
export const SCORE = {
  perMetre: 1,         // 1 point for every metre run
  perCoin: 10,         // EASY CHANGE: 10 points for every coin
  correctAnswer: 200,  // EASY CHANGE: 200 points for every correct fish answer
  levelComplete: 500,  // 500 points for reaching the next level
};

// ---------- obstacles ----------
// There are three kinds of obstacle and each one is avoided differently.
//   depth = how long the obstacle is along the track
//   yMin  = the lowest point of the obstacle (above the floor)
//   yMax  = the highest point of the obstacle
export const OBSTACLES = {
  rock:    { depth: 1.4, yMin: 0,   yMax: 1.0 }, // low  -> jump over it
  barrier: { depth: 1.0, yMin: 1.0, yMax: 4.5 }, // high -> slide under it
  pillar:  { depth: 1.4, yMin: 0,   yMax: 7.0 }, // tall -> change lane
};
