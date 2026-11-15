// =============================================================
// storage.js
// =============================================================
// The game has no server database. Everything is saved in the
// browser's own storage, which keeps text under a "key" name:
//
//   localStorage   - stays saved after the browser is closed
//                    (used for player accounts and best scores)
//   sessionStorage - deleted when the tab is closed
//                    (used to remember who is logged in)
//
// Storage can only hold text, so objects are turned into JSON text
// with JSON.stringify() when saving and back with JSON.parse() when loading.
//
// Everything is inside try/catch because storage can be blocked
// (for example in some private windows). Then the game still works,
// it just can't remember anything.
// =============================================================

// storageName is 'localStorage' or 'sessionStorage'
export function load(storageName, key, fallback = null) {
  try {
    const storage = globalThis[storageName];
    const text = storage.getItem(key);
    if (text === null) {
      return fallback; // nothing saved under this key yet
    }
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

// Saving null deletes the key.
export function save(storageName, key, value) {
  try {
    const storage = globalThis[storageName];
    if (value === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    // storage is full or blocked - nothing we can do, just carry on
  }
}
