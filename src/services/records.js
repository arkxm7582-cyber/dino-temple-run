import { load, save } from './storage.js';

const HISTORY_KEY = 'dtr:history';
const MAX_HISTORY = 200;

function progressKey(name) {
  return 'dtr:progress:' + name.toLowerCase();
}

export function saveGame(game) {
  const history = loadHistory();
  history.unshift({ ...game, date: Date.now() });
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
  save('localStorage', HISTORY_KEY, history);
}

export function loadHistory() {
  return load('localStorage', HISTORY_KEY, []);
}

export function getHallOfFame() {
  const bestByPlayer = {};
  for (const game of loadHistory()) {
    const key = game.name.toLowerCase();
    if (bestByPlayer[key] === undefined || game.score > bestByPlayer[key].score) {
      bestByPlayer[key] = game;
    }
  }

  const list = Object.values(bestByPlayer);
  list.sort((a, b) => b.score - a.score);
  return list.slice(0, 10);
}

// The last 10 games by anyone.
export function getRecentGames() {
  return loadHistory().slice(0, 10);
}

export function getPlayerStats(name) {
  const stats = {
    gamesPlayed: 0,
    bestScore: 0,
    totalDistance: 0,
    totalCoins: 0,
    fishCorrect: 0,
    fishAsked: 0,
    myGames: [],
  };

  for (const game of loadHistory()) {
    if (game.name.toLowerCase() !== name.toLowerCase()) {
      continue;
    }
    stats.gamesPlayed = stats.gamesPlayed + 1;
    stats.bestScore = Math.max(stats.bestScore, game.score);
    stats.totalDistance = stats.totalDistance + game.distance;
    stats.totalCoins = stats.totalCoins + game.coins;
    stats.fishCorrect = stats.fishCorrect + game.correct;
    stats.fishAsked = stats.fishAsked + game.correct + game.wrong;
    if (stats.myGames.length < 10) {
      stats.myGames.push(game);
    }
  }
  return stats;
}

export function loadProgress(name) {
  return load('localStorage', progressKey(name), { unlockedLevel: 0, level: 0, dino: 'rex' });
}

export function saveProgress(name, progress) {
  save('localStorage', progressKey(name), progress);
}
