import {createContext, PropsWithChildren, useContext, useEffect, useMemo, useState} from 'react';
import type {AuthSession, User} from '@expense-statistics/domain';
import {ApiError} from '@expense-statistics/api-client';
import {apiClient} from '@/lib/api';
import {loadStoredSession, storeSession, subscribeToSessionChanges} from '@/features/auth/storage';

type RegisterInput = {
  email: string;
  name: string;
  password: string;
  preferred_currency: string;
  language: 'zh-CN' | 'en' | 'ja';
  verification_token: string;
};

type AuthContextValue = {
  session: AuthSession | null;
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  replaceUser: (user: User) => Promise<void>;
  refreshSession: () => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const initialSession = await loadStoredSession();
      if (!mounted) {
        return;
      }
      setSession(initialSession);
      setIsInitializing(false);
    })();

    return subscribeToSessionChanges(nextSession => {
      if (mounted) {
        setSession(nextSession);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      setIsInitializing(false);
    };
  }, []);

  async function setAndPersistSession(nextSession: AuthSession | null) {
    setSession(nextSession);
    await storeSession(nextSession);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      isAuthenticated: session !== null,
      isInitializing,
      async login(email: string, password: string) {
        const nextSession = await apiClient.login({email, password});
        await setAndPersistSession(nextSession);
        return nextSession;
      },
      async register(input: RegisterInput) {
        const nextSession = await apiClient.register(input);
        await setAndPersistSession(nextSession);
        return nextSession;
      },
      async logout() {
        await setAndPersistSession(null);
      },
      async replaceUser(user: User) {
        if (!session) {
          return;
        }
        await setAndPersistSession({...session, user});
      },
      async refreshSession() {
        if (!session?.refresh_token) {
          return null;
        }

        try {
          const nextSession = await apiClient.refresh(session.refresh_token);
          await setAndPersistSession(nextSession);
          return nextSession;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await setAndPersistSession(null);
            return null;
          }

          throw error;
        }
      },
    }),
    [isInitializing, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
