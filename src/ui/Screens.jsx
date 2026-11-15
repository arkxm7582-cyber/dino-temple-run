// =============================================================
// Screens.jsx
// =============================================================
// Decides which screen to show on top of the 3D game, based on
// who is logged in and which phase the game is in.
// =============================================================
import { useGame } from './useGame.js';
import { Phase } from '../game/gameState.js';
import LoginScreen from './LoginScreen.jsx';
import MenuScreen from './MenuScreen.jsx';
import HUD from './HUD.jsx';
import FishQuestion from './FishQuestion.jsx';
import LostLifeBox from './LostLifeBox.jsx';
import PauseMenu from './PauseMenu.jsx';
import GameOverScreen from './GameOverScreen.jsx';

export default function Screens() {
  const { game, user } = useGame();

  // Nobody logged in -> login screen
  if (user === null) {
    return <LoginScreen />;
  }

  if (game.phase === Phase.MENU) {
    return <MenuScreen />;
  }

  if (game.phase === Phase.GAME_OVER) {
    return <GameOverScreen />;
  }

  // At a fish gate: after a wrong answer the fish pop-up is replaced by
  // the "You lost a life" box, otherwise the fish question is shown.
  let gateBox = null;
  if (game.phase === Phase.CHECKPOINT) {
    if (game.checkpoint.status === 'wrong') {
      gateBox = <LostLifeBox />;
    } else {
      gateBox = <FishQuestion />;
    }
  }

  // Running, paused or at a fish gate: always show the HUD,
  // plus the gate box or the pause menu on top of it.
  return (
    <>
      <HUD />
      {gateBox}
      {game.phase === Phase.PAUSED && <PauseMenu />}
    </>
  );
}
