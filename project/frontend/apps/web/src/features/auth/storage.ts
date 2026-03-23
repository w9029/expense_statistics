import type { AuthSession } from "@expense-statistics/domain";

const storageKey = "expense-atlas.auth-session";

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
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(session));
}
