// =============================================================
// App.jsx
// =============================================================
// The main React component. It:
//   1. creates the one GameController for the whole game
//   2. puts the 3D canvas on the page and starts the game loop
//   3. listens for keyboard and touch events (Week 3 - Event Driven)
//   4. shows the screens (login, menu, HUD, ...) on top of the canvas
// =============================================================
import { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController.js';
import { Renderer } from './render/Renderer.js';
import { GameContext } from './ui/useGame.js';
import Screens from './ui/Screens.jsx';

// Which key does what. event.code is the physical key on the keyboard.
const KEYS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  KeyP: 'pause',
  Escape: 'pause',
};

export default function App() {
  // useState with a function: the controller is created only once,
  // not every time App is redrawn.
  const [ctrl] = useState(() => new GameController());
  const canvasRef = useRef(null);

  // For demos and testing: open the page with ?debug at the end of the
  // address, then type "game" in the browser console to use the controller.
  // e.g. game.runner.distance = 280  -> jump close to the first fish gate
  if (window.location.search.includes('debug')) {
    window.game = ctrl;
  }

  // ---------- 1. the 3D canvas and the game loop ----------
  // useEffect runs after the page is shown, so the <canvas> exists by then.
  useEffect(() => {
    const renderer = new Renderer(canvasRef.current);
    ctrl.attachRenderer(renderer);
    ctrl.start();

    function onResize() {
      renderer.resize();
    }
    window.addEventListener('resize', onResize);

    // The function returned here runs when the component is removed (clean up).
    return () => {
      ctrl.stop();
      ctrl.detachRenderer();
      renderer.dispose();
      window.removeEventListener('resize', onResize);
    };
  }, [ctrl]);

  // ---------- 2. keyboard events ----------
  useEffect(() => {
    function onKeyDown(event) {
      // Don't react while the player is typing their name or PIN
      if (event.target.tagName === 'INPUT') {
        return;
      }
      // Holding a key down repeats it. We only want one move per press.
      if (event.repeat) {
        return;
      }

      // Keys 1-4 answer the fish question (the controller ignores them otherwise)
      if (event.code === 'Digit1') ctrl.answer(0);
      if (event.code === 'Digit2') ctrl.answer(1);
      if (event.code === 'Digit3') ctrl.answer(2);
      if (event.code === 'Digit4') ctrl.answer(3);

      const move = KEYS[event.code];
      if (move !== undefined) {
        event.preventDefault(); // stop the arrow keys / space from scrolling the page
        ctrl.handleInput(move);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ctrl]);

  // ---------- 3. touch swipes (phones and tablets) ----------
  useEffect(() => {
    let start = null; // where the finger first touched

    function onPointerDown(event) {
      start = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event) {
      if (start === null || event.pointerType === 'mouse') {
        return; // swipes are only for touch screens
      }
      const dx = event.clientX - start.x; // how far the finger moved sideways
      const dy = event.clientY - start.y; // how far it moved up/down
      start = null;

      // Ignore tiny movements (that is a tap, not a swipe)
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        // mostly sideways
        if (dx < 0) ctrl.handleInput('left');
        else ctrl.handleInput('right');
      } else {
        // mostly up or down (on screens y gets bigger going DOWN)
        if (dy < 0) ctrl.handleInput('jump');
        else ctrl.handleInput('slide');
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [ctrl]);

  // ---------- 4. what is shown on the page ----------
  // GameContext.Provider makes the controller available to every screen.
  return (
    <GameContext.Provider value={ctrl}>
      <canvas ref={canvasRef} />
      <main>
        <Screens />
      </main>
    </GameContext.Provider>
  );
}
