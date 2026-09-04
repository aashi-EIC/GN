export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

const pendingSaves = new Map<string, number>();
const pendingValues = new Map<string, unknown>();

export function saveToStorageDeferred<T>(key: string, value: T, delayMs = 150) {
  pendingValues.set(key, value);

  const existingTimer = pendingSaves.get(key);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    const latestValue = pendingValues.get(key) as T | undefined;
    pendingSaves.delete(key);
    pendingValues.delete(key);

    if (latestValue !== undefined) {
      saveToStorage(key, latestValue);
    }
  }, delayMs);

  pendingSaves.set(key, timer);
}
