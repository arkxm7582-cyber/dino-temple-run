export const LANE_WIDTH = 2.6;

export function laneToX(lane) {
  return (lane - 1) * LANE_WIDTH;
}

export const DINOS = [
  {
    id: 'rex',
    name: 'T-Rex',
    about: 'Fast and agile: changes lane quickly and jumps high.',
    lives: 3,
    laneSpeed: 18,
    jumpSpeed: 10.5,
    skin: '#c8662a',
    belly: '#efc890',
  },
  {
    id: 'trike',
    name: 'Triceratops',
    about: 'Tough: one extra life, but a little slower to change lane.',
    lives: 4,
    laneSpeed: 13,
    jumpSpeed: 10,
    skin: '#5d7f45',
    belly: '#d6c99a',
  },
];

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
  width: 0.9,
  height: 2.1,
  slideHeight: 0.85,
  gravity: 28,
  slideTime: 0.75,
  hurtTime: 1.5,
};

export const GATES_PER_LEVEL = 3;

export const LEVELS = [
  {
    name: 'Jungle Temple',
    startSpeed: 12,
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

export const SPEED_UP_PER_100M = 0.4;

export const CHECKPOINT = {
  every: 300,
  warnAt: 80,
  clearZone: 40,
  questionTime: 15,
  feedbackTime: 1.5,
};

export const SCORE = {
  perMetre: 1,
  perCoin: 10,
  correctAnswer: 200,
  levelComplete: 500,
};

export const OBSTACLES = {
  rock:    { depth: 1.4, yMin: 0,   yMax: 1.0 },
  barrier: { depth: 1.0, yMin: 1.0, yMax: 4.5 },
  pillar:  { depth: 1.4, yMin: 0,   yMax: 7.0 },
};
