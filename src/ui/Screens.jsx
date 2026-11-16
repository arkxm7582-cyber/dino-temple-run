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

  if (user === null) {
    return <LoginScreen />;
  }

  if (game.phase === Phase.MENU) {
    return <MenuScreen />;
  }

  if (game.phase === Phase.GAME_OVER) {
    return <GameOverScreen />;
  }

  let gateBox = null;
  if (game.phase === Phase.CHECKPOINT) {
    if (game.checkpoint.status === 'wrong') {
      gateBox = <LostLifeBox />;
    } else {
      gateBox = <FishQuestion />;
    }
  }

  return (
    <>
      <HUD />
      {gateBox}
      {game.phase === Phase.PAUSED && <PauseMenu />}
    </>
  );
}
