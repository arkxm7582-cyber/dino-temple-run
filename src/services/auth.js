// =============================================================
// auth.js  (Week 5 - Virtual Identity)
// =============================================================
// Every player has a NAME and a secret PIN (4 to 8 digits).
//
// How the PIN is kept safe:
//   1. The PIN itself is NEVER saved.
//   2. When a player signs up, we create a random "salt" (16 random bytes).
//   3. We put the PIN and the salt through PBKDF2-SHA256 100 000 times.
//      This gives a "hash": a long code that can't be turned back into
//      the PIN. We save only the salt and the hash.
//   4. To log in, we hash the typed PIN with the same salt. If the result
//      is the same as the saved hash, the PIN was right.
//   The salt means two players with the same PIN still get different hashes.
//   PBKDF2 comes from the Web Crypto API that is built into every browser.
//
// What is saved where:
//   localStorage   'dtr:users'   -> [{ name, salt, pinHash, rememberToken }, ...]
//   sessionStorage 'dtr:session' -> name of the player who is logged in
//                                   (deleted when the tab is closed)
//   cookie         'dtr_remember'-> only if "Remember me" is ticked: a random
//                                   token that logs the player in again for
//                                   30 days, even after closing the browser
//
// Remember me (cookie): when the player ticks the box we make a random
// 32-character token, save it with the player and put it in a cookie.
// Next time the game opens, if the cookie's token matches a player's
// token, that player is logged in automatically. Logging out deletes both.
// The cookie holds a random token, NOT the name or the PIN.
//
// Limitation: this is all inside one browser. It keeps players on a shared
// computer apart, but it is not as secure as a real login server, because
// anyone with the computer can see or delete the saved data.
// =============================================================
import { load, save } from './storage.js';

const USERS_KEY = 'dtr:users';
const SESSION_KEY = 'dtr:session';
const HASH_ROUNDS = 100000;
const COOKIE_NAME = 'dtr_remember';
const REMEMBER_DAYS = 30; // EASY CHANGE: how long "Remember me" lasts

// ---------- helpers: bytes <-> hex text ----------
// The salt and hash are bytes. To save them as text we write each byte
// as two hex characters, e.g. the byte 255 becomes "ff".
function bytesToHex(bytes) {
  let hex = '';
  for (const byte of new Uint8Array(bytes)) {
    hex = hex + byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ---------- hashing ----------
// Returns the PBKDF2-SHA256 hash of pin + salt as hex text.
export async function hashPin(pin, saltHex) {
  const pinBytes = new TextEncoder().encode(pin);
  const key = await crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveBits']);
  const settings = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: hexToBytes(saltHex),
    iterations: HASH_ROUNDS,
  };
  const hashBits = await crypto.subtle.deriveBits(settings, key, 256);
  return bytesToHex(hashBits);
}

// ---------- reading the saved players ----------
function getAllUsers() {
  return load('localStorage', USERS_KEY, []);
}

// Finds a player by name (not case sensitive: "Rex" = "rex").
function findUser(name) {
  const wanted = name.trim().toLowerCase();
  for (const user of getAllUsers()) {
    if (user.name.toLowerCase() === wanted) {
      return user;
    }
  }
  return null;
}

// Names of the players on this computer (for the quick-pick buttons on
// the login screen). This makes logging in faster on a shared computer;
// the PIN is still needed, and the names are already stored on this device.
export function listPlayers() {
  return getAllUsers().map((user) => user.name);
}

// ---------- cookies (for "Remember me") ----------
// A cookie is a small piece of text the browser keeps for a website.
// document.cookie is a text like "a=1; b=2". max-age = seconds to keep it.

function setCookie(name, value, days) {
  if (typeof document === 'undefined') return; // not in a browser (tests)
  const seconds = days * 24 * 60 * 60;
  document.cookie = name + '=' + value + '; max-age=' + seconds + '; path=/; SameSite=Strict';
}

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [key, value] = part.trim().split('=');
    if (key === name) {
      return value;
    }
  }
  return null;
}

function deleteCookie(name) {
  setCookie(name, '', 0); // max-age=0 deletes it
}

// Saves a random token with the player and in the cookie.
function rememberPlayer(name) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const users = getAllUsers();
  for (const user of users) {
    if (user.name === name) {
      user.rememberToken = token;
    }
  }
  save('localStorage', USERS_KEY, users);
  setCookie(COOKIE_NAME, token, REMEMBER_DAYS);
}

// Removes the player's token (so an old cookie can't log them in any more).
function forgetPlayer(name) {
  const users = getAllUsers();
  for (const user of users) {
    if (user.name === name) {
      delete user.rememberToken;
    }
  }
  save('localStorage', USERS_KEY, users);
  deleteCookie(COOKIE_NAME);
}

// ---------- sign up / log in / log out ----------
// remember = true if the "Remember me" box was ticked

export async function signUp(name, pin, remember = false) {
  name = name.trim();

  // check the input
  if (!/^[A-Za-z0-9 _-]{2,16}$/.test(name)) {
    throw new Error('Name: 2-16 letters, numbers, spaces, - or _.');
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must be 4-8 digits.');
  }
  if (findUser(name) !== null) {
    throw new Error('That name is already taken.');
  }

  // make a random salt and hash the PIN
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const pinHash = await hashPin(pin, salt);

  // save the new player (only name, salt and hash - never the PIN)
  const users = getAllUsers();
  users.push({ name: name, salt: salt, pinHash: pinHash });
  save('localStorage', USERS_KEY, users);

  // log them in straight away
  save('sessionStorage', SESSION_KEY, name);
  if (remember) {
    rememberPlayer(name);
  }
  return name;
}

export async function logIn(name, pin, remember = false) {
  const user = findUser(name);

  // We show the same message for "no such name" and "wrong PIN",
  // so the message itself doesn't tell which part was wrong.
  if (user === null) {
    throw new Error('Name or PIN is incorrect.');
  }

  const typedHash = await hashPin(pin, user.salt);
  if (typedHash !== user.pinHash) {
    throw new Error('Name or PIN is incorrect.');
  }

  save('sessionStorage', SESSION_KEY, user.name);
  if (remember) {
    rememberPlayer(user.name);
  }
  return user.name;
}

// The name of the player who is logged in, or null.
// 1. Logged in during this tab session?  (sessionStorage)
// 2. Otherwise, a "Remember me" cookie whose token matches a player?
export function currentUser() {
  const name = load('sessionStorage', SESSION_KEY);
  if (name !== null && findUser(name) !== null) {
    return name;
  }

  const token = getCookie(COOKIE_NAME);
  if (token) {
    for (const user of getAllUsers()) {
      if (user.rememberToken === token) {
        save('sessionStorage', SESSION_KEY, user.name); // start a session again
        return user.name;
      }
    }
  }
  return null;
}

export function logOut() {
  const name = load('sessionStorage', SESSION_KEY);
  if (name !== null) {
    forgetPlayer(name); // also stops "Remember me"
  }
  save('sessionStorage', SESSION_KEY, null); // null = delete
}
