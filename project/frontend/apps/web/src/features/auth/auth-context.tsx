import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthSession, User } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { apiClient } from "@/lib/api";
import {
  loadStoredSession,
  storeSession,
  subscribeToBrowserSessionChanges,
  subscribeToSessionChanges,
} from "@/features/auth/storage";

type AuthContextValue = {
  session: AuthSession | null;
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  register: (input: {
    email: string;
    name: string;
    password: string;
    preferred_currency: string;
    language: "zh-CN" | "en" | "ja";
    verification_token: string;
  }) => Promise<AuthSession>;
  logout: () => void;
  replaceUser: (user: User) => void;
  refreshSession: () => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession());

  const setAndPersistSession = (nextSession: AuthSession | null) => {
    setSession(nextSession);
    storeSession(nextSession);
  };

  useEffect(() => {
    return subscribeToSessionChanges((nextSession) => {
      setSession(nextSession);
    });
  }, []);

  useEffect(() => {
    return subscribeToBrowserSessionChanges((nextSession) => {
      setSession(nextSession);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      isAuthenticated: session !== null,
      isInitializing: false,
      async login(email: string, password: string) {
        const nextSession = await apiClient.login({ email, password });
        setAndPersistSession(nextSession);
        return nextSession;
      },
      async register(input) {
        const nextSession = await apiClient.register(input);
        setAndPersistSession(nextSession);
        return nextSession;
      },
      logout() {
        setAndPersistSession(null);
      },
      replaceUser(user: User) {
        if (!session) {
          return;
        }
        setAndPersistSession({ ...session, user });
      },
      async refreshSession() {
        if (!session?.refresh_token) {
          return null;
        }

        try {
          const nextSession = await apiClient.refresh(session.refresh_token);
          setAndPersistSession(nextSession);
          return nextSession;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            setAndPersistSession(null);
            return null;
          }

          throw error;
        }
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
