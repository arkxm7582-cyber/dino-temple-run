// Tests for services/auth.js and services/records.js.
// Node has no localStorage / sessionStorage, so simple fake ones are used.
import { describe, it, expect, beforeEach } from 'vitest';
import { signUp, logIn, logOut, currentUser, listPlayers } from '../src/services/auth.js';
import { saveGame, getHallOfFame, getRecentGames, getPlayerStats, loadProgress, saveProgress } from '../src/services/records.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

// A pretend document.cookie that works like the browser's: setting it adds
// or replaces one cookie, max-age=0 deletes it, reading gives "a=1; b=2".
function fakeDocument() {
  const cookies = new Map();
  return {
    get cookie() { return [...cookies].map(([k, v]) => k + '=' + v).join('; '); },
    set cookie(text) {
      const [pair, ...options] = text.split(';');
      const [key, value] = pair.split('=');
      if (options.some((o) => o.trim() === 'max-age=0')) cookies.delete(key);
      else cookies.set(key, value);
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
  globalThis.sessionStorage = fakeStorage();
  globalThis.document = fakeDocument();
});

describe('auth', () => {
  it('signs up and stores only a salted hash, never the PIN', async () => {
    await signUp('Rex', '4321');
    const saved = localStorage.getItem('dtr:users');
    expect(saved).not.toContain('4321');
    const [user] = JSON.parse(saved);
    expect(user.salt).toHaveLength(32);    // 16 bytes as hex
    expect(user.pinHash).toHaveLength(64); // 256-bit hash as hex
    expect(currentUser()).toBe('Rex');
  });

  it('two players with the same PIN get different hashes (because of the salt)', async () => {
    await signUp('Ann', '1111');
    await signUp('Bob', '1111');
    const [a, b] = JSON.parse(localStorage.getItem('dtr:users'));
    expect(a.pinHash).not.toBe(b.pinHash);
  });

  it('logs in with the right PIN only', async () => {
    await signUp('Rex', '4321');
    logOut();
    expect(currentUser()).toBe(null);
    await expect(logIn('Rex', '0000')).rejects.toThrow(/incorrect/);
    await expect(logIn('Nobody', '4321')).rejects.toThrow(/incorrect/);
    expect(await logIn('rex', '4321')).toBe('Rex'); // name is not case sensitive
  });

  it('checks the name and PIN rules', async () => {
    await expect(signUp('R', '1234')).rejects.toThrow(/Name/);
    await expect(signUp('Rex', '12')).rejects.toThrow(/PIN/);
    await signUp('Rex', '1234');
    await expect(signUp('REX', '5678')).rejects.toThrow(/taken/);
  });

  it('the session is kept in sessionStorage', async () => {
    await signUp('Rex', '4321');
    expect(JSON.parse(sessionStorage.getItem('dtr:session'))).toBe('Rex');
  });
});

describe('remember me (cookie)', () => {
  it('without "remember me" the player is forgotten when the tab closes', async () => {
    await signUp('Rex', '4321', false);
    globalThis.sessionStorage = fakeStorage(); // tab closed
    expect(currentUser()).toBe(null);
  });

  it('with "remember me" a cookie token logs the player in again', async () => {
    await signUp('Rex', '4321', true);
    expect(document.cookie).toMatch(/dtr_remember=[0-9a-f]{32}/);
    expect(document.cookie).not.toContain('4321'); // the cookie never holds the PIN
    globalThis.sessionStorage = fakeStorage(); // tab closed
    expect(currentUser()).toBe('Rex');
  });

  it('logging out deletes the cookie and the token', async () => {
    await signUp('Ann', '1111', true);
    logOut();
    expect(document.cookie).toBe('');
    globalThis.sessionStorage = fakeStorage();
    expect(currentUser()).toBe(null);
  });

  it('lists the players on this computer for the quick-pick buttons', async () => {
    await signUp('Rex', '4321');
    await signUp('Ann', '1111');
    expect(listPlayers()).toEqual(['Rex', 'Ann']);
  });
});

describe('records', () => {
  const game = (name, score) => ({ name, score, distance: 100, coins: 5, correct: 1, wrong: 1, level: 0, dino: 'rex' });

  it('saves every game and makes a hall of fame with each player once', () => {
    saveGame(game('Rex', 100));
    saveGame(game('Ann', 900));
    saveGame(game('Rex', 500));
    const fame = getHallOfFame();
    expect(fame.map((g) => [g.name, g.score])).toEqual([['Ann', 900], ['Rex', 500]]);
    expect(getRecentGames()[0].score).toBe(500); // newest first
  });

  it('works out the stats of one player', () => {
    saveGame(game('Rex', 100));
    saveGame(game('Rex', 300));
    saveGame(game('Ann', 999));
    const stats = getPlayerStats('rex');
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.bestScore).toBe(300);
    expect(stats.totalCoins).toBe(10);
    expect(stats.myGames).toHaveLength(2);
  });

  it('remembers the unlocked level and chosen dino of each player', () => {
    expect(loadProgress('Rex')).toEqual({ unlockedLevel: 0, level: 0, dino: 'rex' });
    saveProgress('Rex', { unlockedLevel: 2, level: 1, dino: 'trike' });
    expect(loadProgress('rex').dino).toBe('trike');
    expect(loadProgress('Ann').unlockedLevel).toBe(0);
  });
});
