// =============================================================
// EventBus.js  (Week 3 - Event Driven Architecture)
// =============================================================
// A very small "publish / subscribe" system.
//
//   bus.on('HIT', myFunction)  -> myFunction will run every time 'HIT' happens
//   bus.emit('HIT', data)      -> runs every function that is listening to 'HIT'
//
// Why use it? The part of the code that SENDS an event does not need to
// know who is LISTENING. For example the GameController sends 'HIT' and
// the Renderer listens for it to shake the camera, but the two classes
// never call each other directly (this keeps them loosely coupled).
// =============================================================

export class EventBus {
  constructor() {
    // An object that maps an event name to a list of listener functions.
    // Example: { HIT: [shakeCamera], COIN_COLLECTED: [playSound] }
    this.listeners = {};
  }

  // Start listening to an event.
  // Returns a function that can be called later to stop listening.
  on(eventName, listener) {
    if (this.listeners[eventName] === undefined) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);

    const stopListening = () => {
      this.listeners[eventName] = this.listeners[eventName].filter((l) => l !== listener);
    };
    return stopListening;
  }

  // Tell every listener that this event happened.
  // Listeners registered for '*' hear EVERY event (useful for logging).
  emit(eventName, data = {}) {
    const listenersForThisEvent = this.listeners[eventName] || [];
    for (const listener of listenersForThisEvent) {
      listener(data);
    }

    const listenersForAll = this.listeners['*'] || [];
    for (const listener of listenersForAll) {
      listener(eventName, data);
    }
  }
}
