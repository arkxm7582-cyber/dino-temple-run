import { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController.js';
import { Renderer } from './render/Renderer.js';
import { GameContext } from './ui/useGame.js';
import Screens from './ui/Screens.jsx';

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
  const [ctrl] = useState(() => new GameController());
  const canvasRef = useRef(null);

  if (window.location.search.includes('debug')) {
    window.game = ctrl;
  }

  useEffect(() => {
    const renderer = new Renderer(canvasRef.current);
    ctrl.attachRenderer(renderer);
    ctrl.start();

    function onResize() {
      renderer.resize();
    }
    window.addEventListener('resize', onResize);

    return () => {
      ctrl.stop();
      ctrl.detachRenderer();
      renderer.dispose();
      window.removeEventListener('resize', onResize);
    };
  }, [ctrl]);

  useEffect(() => {
    function onKeyDown(event) {
      // Don't react while the player is typing their name or PIN
      if (event.target.tagName === 'INPUT') {
        return;
      }
      if (event.repeat) {
        return;
      }

      if (event.code === 'Digit1') ctrl.answer(0);
      if (event.code === 'Digit2') ctrl.answer(1);
      if (event.code === 'Digit3') ctrl.answer(2);
      if (event.code === 'Digit4') ctrl.answer(3);

      const move = KEYS[event.code];
      if (move !== undefined) {
        event.preventDefault();
        ctrl.handleInput(move);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ctrl]);

  useEffect(() => {
    let start = null;

    function onPointerDown(event) {
      start = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event) {
      if (start === null || event.pointerType === 'mouse') {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
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

  return (
    <GameContext.Provider value={ctrl}>
      <canvas ref={canvasRef} />
      <main>
        <Screens />
      </main>
    </GameContext.Provider>
  );
}
