import type { AuthSession } from "@expense-statistics/domain";

const storageKey = "expense-atlas.auth-session";
const listeners = new Set<(session: AuthSession | null) => void>();

export function loadStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (session === null) {
    window.localStorage.removeItem(storageKey);
    notifySessionListeners(null);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(session));
  notifySessionListeners(session);
}

export function subscribeToSessionChanges(listener: (session: AuthSession | null) => void) {
 listeners.add(listener);
 return () => {
   listeners.delete(listener);
 };
}

export function subscribeToBrowserSessionChanges(listener: (session: AuthSession | null) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) {
      return;
    }
    if (!event.newValue) {
      listener(null);
      return;
    }
    try {
      listener(JSON.parse(event.newValue) as AuthSession);
    } catch {
      listener(null);
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

function notifySessionListeners(session: AuthSession | null) {
  for (const listener of listeners) {
    listener(session);
  }
}
