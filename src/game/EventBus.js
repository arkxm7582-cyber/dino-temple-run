export class EventBus {
  constructor() {
    this.listeners = {};
  }

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
