// =============================================================
// LoginScreen.jsx  (Week 5 - Virtual Identity)
// =============================================================
// Lets the player log in or create a new player.
//   - two tabs: "Log in" and "New player"
//   - quick-pick buttons with the players already on this computer
//   - the PIN is hidden (type="password") with a Show / Hide button
//   - new players type the PIN twice so a typing mistake is caught
//   - "Remember me" keeps the player logged in with a cookie for 30 days
// The real work (hashing and checking the PIN, the cookie) is in
// services/auth.js. This file is only the form.
// =============================================================
import { useState } from 'react';
import { useGame } from './useGame.js';
import { listPlayers } from '../services/auth.js';

export default function LoginScreen() {
  const { ctrl } = useGame();
  const players = listPlayers(); // names of players on this computer

  // useState keeps a value between redraws of the component.
  // Start on "New player" if nobody has signed up on this computer yet.
  const [mode, setMode] = useState(players.length > 0 ? 'login' : 'signup');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');         // the repeated PIN (sign up only)
  const [showPin, setShowPin] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);       // true while the PIN is being hashed

  const signingUp = mode === 'signup';

  // Runs when the form is submitted (button click or Enter key)
  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setError('');

    if (signingUp && pin !== pin2) {
      setError('The two PINs are not the same.');
      return;
    }

    setBusy(true);
    try {
      if (signingUp) {
        await ctrl.signUp(name, pin, remember);
      } else {
        await ctrl.logIn(name, pin, remember);
      }
      // If it worked, the controller now has a user and the menu appears.
    } catch (err) {
      setError(err.message); // e.g. "Name or PIN is incorrect."
      setBusy(false);
    }
  }

  // Only allow digits in the PIN boxes
  function digitsOnly(text) {
    return text.replace(/\D/g, '');
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setPin('');
    setPin2('');
  }

  // A simple hint about how strong the PIN is
  let strength = '';
  if (signingUp && pin.length > 0) {
    if (pin.length < 4) strength = 'Too short (at least 4 digits)';
    else if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin)) strength = 'Easy to guess (like 1111 or 1234)';
    else if (pin.length < 6) strength = 'OK';
    else strength = 'Strong';
  }

  return (
    <form className="panel login" onSubmit={handleSubmit}>
      <h1><span aria-hidden="true">🦖 </span>Dino Temple Run</h1>
      <p className="center muted tagline">Run, dodge and count the fish to open the gates!</p>

      {/* the two tabs */}
      <div className="tabs two">
        <button type="button" className={signingUp ? 'ghost' : ''} onClick={() => switchMode('login')}>Log in</button>
        <button type="button" className={signingUp ? '' : 'ghost'} onClick={() => switchMode('signup')}>New player</button>
      </div>

      {/* quick pick: tap your name instead of typing it */}
      {!signingUp && players.length > 0 && (
        <div className="quick-pick">
          {players.map((player) => (
            <button
              key={player}
              type="button"
              className={'chip' + (player.toLowerCase() === name.toLowerCase() ? ' chosen' : '')}
              onClick={() => setName(player)}
            >
              {player}
            </button>
          ))}
        </div>
      )}

      <label>
        Player name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="e.g. DinoKing" autoFocus />
      </label>

      {/* PIN and Repeat PIN sit side by side to save space */}
      <div className={signingUp ? 'pin-grid' : ''}>
      <label>
        PIN (4-8 digits)
        <div className="pin-row">
          <input
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(digitsOnly(e.target.value))}
            maxLength={8}
            placeholder="••••"
          />
          <button type="button" className="ghost small" onClick={() => setShowPin(!showPin)}>
            {showPin ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>

      {signingUp && (
        <label>
          Repeat PIN
          <input
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            value={pin2}
            onChange={(e) => setPin2(digitsOnly(e.target.value))}
            maxLength={8}
            placeholder="••••"
          />
        </label>
      )}
      </div>
      {strength !== '' && <small className="muted">PIN strength: {strength}</small>}

      <label className="checkbox">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember me on this computer for 30 days
      </label>

      {error !== '' && <p className="error-box">{error}</p>}

      <button type="submit" className="big" disabled={busy}>
        {busy ? 'Checking...' : signingUp ? 'Create player' : 'Log in'}
      </button>

      <small className="center muted">
        Your PIN is never saved: only a salted PBKDF2 hash of it is kept in this browser.
      </small>
    </form>
  );
}
