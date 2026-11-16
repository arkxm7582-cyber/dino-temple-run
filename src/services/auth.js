import { load, save } from './storage.js';

const USERS_KEY = 'dtr:users';
const SESSION_KEY = 'dtr:session';
const HASH_ROUNDS = 100000;
const COOKIE_NAME = 'dtr_remember';
const REMEMBER_DAYS = 30;

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

export function listPlayers() {
  return getAllUsers().map((user) => user.name);
}

function setCookie(name, value, days) {
  if (typeof document === 'undefined') return;
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
  setCookie(name, '', 0);
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

export async function signUp(name, pin, remember = false) {
  name = name.trim();

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

  const users = getAllUsers();
  users.push({ name: name, salt: salt, pinHash: pinHash });
  save('localStorage', USERS_KEY, users);

  save('sessionStorage', SESSION_KEY, name);
  if (remember) {
    rememberPlayer(name);
  }
  return name;
}

export async function logIn(name, pin, remember = false) {
  const user = findUser(name);

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

export function currentUser() {
  const name = load('sessionStorage', SESSION_KEY);
  if (name !== null && findUser(name) !== null) {
    return name;
  }

  const token = getCookie(COOKIE_NAME);
  if (token) {
    for (const user of getAllUsers()) {
      if (user.rememberToken === token) {
        save('sessionStorage', SESSION_KEY, user.name);
        return user.name;
      }
    }
  }
  return null;
}

export function logOut() {
  const name = load('sessionStorage', SESSION_KEY);
  if (name !== null) {
    forgetPlayer(name);
  }
  save('sessionStorage', SESSION_KEY, null);
}
