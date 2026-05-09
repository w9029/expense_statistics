import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AuthSession} from '@expense-statistics/domain';

const STORAGE_KEY = 'expense-statistics.auth-session';
const listeners = new Set<(session: AuthSession | null) => void>();

export async function loadStoredSession() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function storeSession(session: AuthSession | null) {
  if (session === null) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    notifySessionListeners(null);
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  notifySessionListeners(session);
}

export function subscribeToSessionChanges(
  listener: (session: AuthSession | null) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySessionListeners(session: AuthSession | null) {
  for (const listener of listeners) {
    listener(session);
  }
}
