// =============================================================
// MenuScreen.jsx
// =============================================================
// The main menu has four tabs:
//   Play         - choose a dinosaur and a level, then press Play
//   Hall of fame - the best score of every player + the latest games
//   My stats     - this player's totals and their last games
//   Help         - how to play
// Everything is kept small enough to fit on the screen without scrolling.
// The data comes from services/records.js (saved in localStorage).
// =============================================================
import { useState } from 'react';
import { useGame } from './useGame.js';
import { DINOS, LEVELS, getDino } from '../game/config.js';

// The tabs of the menu: [id, text on the button]
// EASY CHANGE: rename a tab here (the id must stay the same)
const TABS = [
  ['play', 'Play'],
  ['fame', 'Hall of fame'],
  ['stats', 'My stats'],
  ['help', 'Help'],
];

export default function MenuScreen() {
  const { ctrl, user, best, menuTab } = useGame();
  // which tab is open (starts on the tab the controller asked for,
  // e.g. 'fame' after pressing "Hall of fame" on the game over screen)
  const [tab, setTab] = useState(menuTab);

  return (
    <div className="panel wide">
      {/* header: title on the left, player + best score + log out on the right */}
      <div className="menu-header">
        <h1>Dino Temple Run</h1>
        <div className="menu-user">
          <span><b>{user}</b> · best {best}</span>
          <button className="ghost small" onClick={() => ctrl.logOut()}>Log out</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(([id, text]) => (
          <button key={id} className={tab === id ? '' : 'ghost'} onClick={() => setTab(id)}>{text}</button>
        ))}
      </div>

      {tab === 'play' && <PlayTab />}
      {tab === 'fame' && <HallOfFameTab />}
      {tab === 'stats' && <StatsTab />}
      {tab === 'help' && <HelpTab />}
    </div>
  );
}

// ---------- Play: choose dinosaur and level ----------
function PlayTab() {
  const { ctrl, progress } = useGame();

  return (
    <>
      <h2>Choose your dinosaur</h2>
      <div className="cards">
        {DINOS.map((dino) => (
          <button
            key={dino.id}
            className={'card' + (progress.dino === dino.id ? ' chosen' : '')}
            onClick={() => ctrl.chooseDino(dino.id)}
          >
            <b>{dino.name}</b>
            <span className="about">{dino.about}</span>
            <span>Lives: {'♥'.repeat(dino.lives)}</span>
          </button>
        ))}
      </div>

      <h2>Choose a level</h2>
      <div className="cards">
        {LEVELS.map((level, index) => {
          const locked = index > progress.unlockedLevel;
          return (
            <button
              key={level.name}
              className={'card' + (progress.level === index ? ' chosen' : '')}
              disabled={locked}
              onClick={() => ctrl.chooseLevel(index)}
            >
              <b>{index + 1}. {level.name}</b>
              <span>{locked ? 'Locked: reach it in a run' : 'Speed ' + level.startSpeed + '-' + level.maxSpeed + ' m/s'}</span>
            </button>
          );
        })}
      </div>

      <button className="big" onClick={() => ctrl.startRun()}>Play</button>
    </>
  );
}

// ---------- Help: how to play ----------
function HelpTab() {
  return (
    <ul className="help">
      <li>Left / Right arrows, A / D or swipe: change lane</li>
      <li>Up arrow, W or Space: jump over rocks</li>
      <li>Down arrow or S: slide under logs</li>
      <li>Change lane to go around stone pillars</li>
      <li>Every 300 m a fish gate stops you: count the fish and press 1-4</li>
      <li>Wrong answers, running out of time and crashes cost a life</li>
      <li>Pass 3 gates to reach the next level (and unlock it on the menu)</li>
      <li>P or Esc: pause</li>
    </ul>
  );
}

// ---------- Hall of fame: all players ----------
function HallOfFameTab() {
  const { records } = useGame();

  if (records.hallOfFame.length === 0) {
    return <p className="center">No games played yet. Be the first!</p>;
  }

  return (
    <>
      <h2>Best score of every player</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Player</th><th>Score</th><th>Level</th><th>Dino</th></tr>
        </thead>
        <tbody>
          {records.hallOfFame.slice(0, 5).map((game, index) => (
            <tr key={game.name}>
              <td>{index + 1}</td>
              <td>{game.name}</td>
              <td>{game.score}</td>
              <td>{LEVELS[game.level].name}</td>
              <td>{getDino(game.dino).name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Latest games (everyone)</h2>
      <GamesTable games={records.recentGames.slice(0, 5)} showName={true} />
    </>
  );
}

// ---------- My stats: this player only ----------
function StatsTab() {
  const { records } = useGame();
  const stats = records.stats;

  if (stats.gamesPlayed === 0) {
    return <p className="center">You have not played yet.</p>;
  }

  return (
    <>
      <div className="stats">
        <span>Games played <b>{stats.gamesPlayed}</b></span>
        <span>Best score <b>{stats.bestScore}</b></span>
        <span>Total distance <b>{stats.totalDistance} m</b></span>
        <span>Total coins <b>{stats.totalCoins}</b></span>
        <span>Fish answers right <b>{stats.fishCorrect} / {stats.fishAsked}</b></span>
      </div>
      <h2>My last games</h2>
      <GamesTable games={stats.myGames.slice(0, 5)} showName={false} />
    </>
  );
}

// A table of games, used by both tabs above.
function GamesTable({ games, showName }) {
  return (
    <table>
      <thead>
        <tr>
          {showName && <th>Player</th>}
          <th>Score</th><th>Distance</th><th>Level</th><th>Dino</th><th>Date</th>
        </tr>
      </thead>
      <tbody>
        {games.map((game) => (
          <tr key={game.date + game.name}>
            {showName && <td>{game.name}</td>}
            <td>{game.score}</td>
            <td>{game.distance} m</td>
            <td>{game.level + 1}</td>
            <td>{getDino(game.dino).name}</td>
            <td>{new Date(game.date).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
