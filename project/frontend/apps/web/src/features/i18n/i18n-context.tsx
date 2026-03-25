import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/features/auth/auth-context";
import {
  AppLanguage,
  isAppLanguage,
  MessageKey,
  messages,
  SUPPORTED_LANGUAGES,
} from "@/features/i18n/messages";

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
  supportedLanguages: AppLanguage[];
};

const STORAGE_KEY = "expense-atlas.language";

const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === "undefined") {
    return "zh-CN";
  }

  const normalized = navigator.language.toLowerCase();
  if (normalized.startsWith("ja")) {
    return "ja";
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

function resolveInitialLanguage(): AppLanguage {
  if (typeof window !== "undefined") {
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
    if (isAppLanguage(storedLanguage)) {
      return storedLanguage;
    }
  }

  return detectBrowserLanguage();
}

function interpolate(template: string, params?: TranslateParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(params[token] ?? ""));
}

export function I18nProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [language, setLanguage] = useState<AppLanguage>(() => resolveInitialLanguage());

  useEffect(() => {
    if (auth.user?.language) {
      setLanguage((current) =>
        current === auth.user!.language ? current : auth.user!.language,
      );
    }
  }, [auth.user?.language]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t(key, params) {
        const template = messages[language][key] ?? messages.en[key] ?? key;
        return interpolate(template, params);
      },
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
