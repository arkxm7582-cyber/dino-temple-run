// storageName is 'localStorage' or 'sessionStorage'
export function load(storageName, key, fallback = null) {
  try {
    const storage = globalThis[storageName];
    const text = storage.getItem(key);
    if (text === null) {
      return fallback;
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
    // storage blocked or full: ignore
  }
}
