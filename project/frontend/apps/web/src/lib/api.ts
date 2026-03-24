import { ApiError, createApiClient } from "@expense-statistics/api-client";
import { apiBaseUrl } from "@/lib/config";
import { loadStoredSession, storeSession } from "@/features/auth/storage";

const baseApiClient = createApiClient({ apiBaseUrl });

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(failedAccessToken: string) {
  const currentSession = loadStoredSession();
  if (!currentSession?.refresh_token) {
    storeSession(null);
    return null;
  }

  if (
    currentSession.access_token &&
    currentSession.access_token !== failedAccessToken
  ) {
    return currentSession.access_token;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const nextSession = await baseApiClient.refresh(currentSession.refresh_token);
        storeSession(nextSession);
        return nextSession.access_token;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          storeSession(null);
          return null;
        }
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export const apiClient = createApiClient({
  apiBaseUrl,
  onAccessTokenExpired: refreshAccessToken,
});
