# Dino Temple Run

A 3D endless runner made with React and Three.js for CIS045-3
Distributed Service Architectures.

Choose a dinosaur and run along a 3-lane track. Switch lanes, jump and
slide to avoid obstacles, and collect coins. Every 300 m there is a fish
gate: the game gets a puzzle from the **Fish API** and you have to count
the fish to open the gate. A wrong answer or running out of time costs a
life: the fish pop-up closes and a box shows the score with **Next puzzle**,
**Replay** and **Main menu**. On the last life the game over screen appears
instead. Pass 3 gates to reach the next level.

To change the game quickly, search the code for `EASY CHANGE` (most values
are in `src/game/config.js`). EVALUATION_NOTES.md section 6 lists common
changes and where to make them.

## Dinosaurs

| Dinosaur | Lives | Strength |
| --- | --- | --- |
| T-Rex | 3 | changes lane quickly and jumps higher |
| Triceratops | 4 | one extra life, but slower to change lane |

## Levels

| Level | Speed | What changes |
| --- | --- | --- |
| 1. Jungle Temple | 12-17 m/s | trees, palms, bushes; mostly single obstacles |
| 2. Desert Canyon | 15.5-21 m/s | cacti, rock mesas; more double obstacles |
| 3. Volcano Valley | 19-25 m/s | dead trees, lava pools, embers; hardest, never ends |

Reaching a level in a run unlocks it on the menu, so next time you can
start there.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # automated tests
npm run verify:api   # checks the real Fish API still works with the game
npm run build && npm run serve   # finished version on http://localhost:8080
```

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Change lane | Left / Right, A / D | swipe left / right |
| Jump (over rocks) | Up, W, Space | swipe up |
| Slide (under logs) | Down, S | swipe down |
| Answer a fish question | 1 - 4 | tap |
| Pause | P, Esc | II button |

Tip for demos: open `http://localhost:5173/?debug`, then in the browser
console type `game.runner.distance = 280` to jump close to the next gate.

## Saving (no database)

There is no server database. The game uses the browser's own storage, so
the records stay on this computer:

| What | Where | Kept after closing the browser? |
| --- | --- | --- |
| Player accounts (name, salt, PIN hash) | `localStorage` `dtr:users` | yes |
| Every game played (player, score, distance, coins, fish answers, level, dino, date) | `localStorage` `dtr:history` | yes (newest 200) |
| Each player's unlocked level and chosen dino/level | `localStorage` `dtr:progress:<name>` | yes |
| Who is logged in | `sessionStorage` `dtr:session` | no (cleared when the tab closes) |
| "Remember me" token (only if ticked) | cookie `dtr_remember` | yes, 30 days (deleted on log out) |

From the history the menu shows a **hall of fame** (best score of every
player), the **latest games** by everyone, and **my stats** (games played,
best score, total distance, coins, fish answers, last 10 games).
A run in progress is not saved.

If the Fish API is slow, the fish gate shows an "End run and go to main
menu" button. If it can't be reached (after 8 seconds), the pop-up closes
by itself and the game over screen shows the stats, the reason, and three
buttons: Play again, Main menu and Hall of fame. An API problem never
costs a life, and the score is still saved.

## Project structure

```
src/
  main.jsx             loads fonts + styles, starts React
  App.jsx              creates the controller, 3D canvas, keyboard + swipe events
  styles.css
  game/                game logic only (no drawing, no HTML)
    config.js          all numbers: dinosaurs, levels, speeds, gates, points
    Runner.js          moves the dino, creates obstacles/coins, collisions, levels
    gameState.js       phases + reducer (how each event changes the game)
    EventBus.js        small publish/subscribe system
    GameController.js  game loop, connects all the parts
  render/Renderer.js   3D drawing with Three.js: dinosaurs, track, scenery for
                       each level, sky, mountains, shadows, particles
  services/            things outside the game itself
    fishApi.js         calls the Fish API and reads its JSON
    auth.js            sign up / log in with a hashed PIN
    records.js         game history, hall of fame, stats, progress
    storage.js         localStorage / sessionStorage helpers
  ui/                  React screens
    useGame.js         gives every screen the controller and its data
    Screens.jsx        picks which screen to show
    LoginScreen, MenuScreen (play / hall of fame / my stats), HUD,
    FishQuestion, PauseMenu, GameOverScreen
server/server.js       serves the built game and passes Fish API calls on
scripts/verify-fish-api.mjs
tests/                 Vitest tests
```

## The module topics

**Low coupling / high cohesion (Week 2).** Each folder has one job:
`game/` has the rules and maths, `render/` only draws, `services/` talks
to storage and the internet, `ui/` shows screens. The Runner and reducer
have no Three.js or React code, so they are tested on their own. Only
`fishApi.js` uses the network. `GameController` is the one place that
connects the parts, and it receives the Fish API as a parameter so the
tests can pass a fake one. Adding a level or a dinosaur only means adding
an entry in `config.js`.

**Event driven (Week 3).** Key presses, swipes and button clicks are
browser events (`App.jsx`). The Runner reports events such as `HIT`,
`COIN_COLLECTED` and `GATE_REACHED`, a `TICK` event runs every frame
(`requestAnimationFrame`) and counts down the 15 second fish timer, the
API reply becomes `PUZZLE_LOADED` or `PUZZLE_FAILED` (which ends the run automatically), and entering a new
level is `LEVEL_UP`. Every event goes through `gameReducer` in
`gameState.js` and is then published on the `EventBus` (for example the
renderer listens for `HIT` to shake the camera).

**Interoperability (Week 4).** `fishApi.js` sends
`GET https://www.marcconrad.com/uob/fish/api.php?out=json&base64=yes`.
The reply is JSON `{ "question": "<base64 PNG>", "fish": 7, "chest": 2 }`.
The base64 text is turned into a `data:image/png;base64,...` URL for the
`<img>`, and `fish` is the answer. The browser may call this other website
because the API sends `Access-Control-Allow-Origin: *` (CORS). If a network
blocks the direct call, the game tries `/fish-api/api.php` on its own
server, which forwards it (`vite.config.js` in development,
`server/server.js` for the built game).

**Virtual identity (Week 5).** Players sign up with a name and a 4-8 digit
PIN (`auth.js`). The PIN is never stored: a random 16-byte salt is made
and the PIN is hashed with PBKDF2-SHA256 (100 000 rounds, Web Crypto).
Users are kept in `localStorage`, the logged-in name in `sessionStorage`
(forgotten when the tab closes). Ticking "Remember me" stores a random
token with the player and in a cookie (30 days), so the game logs them in
again automatically; logging out deletes the cookie and the token. Every game is saved with the player's
name, so the hall of fame and stats show who played, and each player has
their own progress (`dtr:progress:<name>`).
Limitation: this all lives in one browser, so it separates players on a
shared computer but is not as secure as a real login server.

## Assets

All 3D models and textures are made in code from simple shapes and
canvas drawings (no image or model files). Fonts: Lilita One and Nunito
(SIL Open Font License) via `@fontsource`.
