// =============================================================
// records.js
// =============================================================
// Saves who played, their scores and their progress.
// Like the rest of the game it uses the browser's localStorage
// (there is no server database), so the records stay on this computer.
//
// What is saved:
//   'dtr:history'           -> every game played on this computer by any
//                              player (the newest 200 are kept):
//                              [{ name, score, distance, coins, correct,
//                                 wrong, level, dino, date }, ...]
//   'dtr:progress:<name>'   -> one player's progress:
//                              { unlockedLevel, level, dino }
//
// From the history we can work out:
//   - the hall of fame   (each player's best score, best first)
//   - the recent games   (the last games by anyone)
//   - a player's stats   (games played, best score, total coins, ...)
// =============================================================
import { load, save } from './storage.js';

const HISTORY_KEY = 'dtr:history';
const MAX_HISTORY = 200;

function progressKey(name) {
  return 'dtr:progress:' + name.toLowerCase();
}

// ---------- games played ----------

// Adds one finished game to the history.
// game = { name, score, distance, coins, correct, wrong, level, dino }
export function saveGame(game) {
  const history = loadHistory();
  history.unshift({ ...game, date: Date.now() }); // newest first
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY; // forget the oldest games
  }
  save('localStorage', HISTORY_KEY, history);
}

export function loadHistory() {
  return load('localStorage', HISTORY_KEY, []);
}

// The best score of every player, highest first (top 10).
// Each player appears only once, with their best game.
export function getHallOfFame() {
  const bestByPlayer = {}; // player name -> their best game
  for (const game of loadHistory()) {
    const key = game.name.toLowerCase();
    if (bestByPlayer[key] === undefined || game.score > bestByPlayer[key].score) {
      bestByPlayer[key] = game;
    }
  }

  const list = Object.values(bestByPlayer);
  list.sort((a, b) => b.score - a.score); // highest score first
  return list.slice(0, 10);
}

// The last 10 games by anyone.
export function getRecentGames() {
  return loadHistory().slice(0, 10);
}

// Statistics for one player.
export function getPlayerStats(name) {
  const stats = {
    gamesPlayed: 0,
    bestScore: 0,
    totalDistance: 0,
    totalCoins: 0,
    fishCorrect: 0,
    fishAsked: 0,
    myGames: [], // this player's last 10 games
  };

  for (const game of loadHistory()) {
    if (game.name.toLowerCase() !== name.toLowerCase()) {
      continue; // someone else's game
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

// ---------- player progress ----------

// unlockedLevel = the highest level this player has reached (0, 1 or 2)
// level, dino   = what they picked last time (so the menu remembers it)
export function loadProgress(name) {
  return load('localStorage', progressKey(name), { unlockedLevel: 0, level: 0, dino: 'rex' });
}

export function saveProgress(name, progress) {
  save('localStorage', progressKey(name), progress);
}
