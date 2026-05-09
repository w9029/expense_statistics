import {createContext, PropsWithChildren, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '@/features/auth/auth-context';
import {AppLanguage, isAppLanguage, MessageKey, messages, SUPPORTED_LANGUAGES} from '@/features/i18n/messages';

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: MessageKey, params?: TranslateParams) => string;
  supportedLanguages: AppLanguage[];
};

const STORAGE_KEY = 'expense-statistics.language';
const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TranslateParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) =>
    String(params[token] ?? ''),
  );
}

export function I18nProvider({children}: PropsWithChildren) {
  const auth = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>('zh-CN');
  const userLanguage = auth.user?.language;

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const storedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
      if (mounted && isAppLanguage(storedLanguage)) {
        setLanguageState(storedLanguage);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userLanguage) {
      return;
    }

    setLanguageState(current =>
      current === userLanguage ? current : userLanguage,
    );
  }, [userLanguage]);

  async function setLanguage(nextLanguage: AppLanguage) {
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
  }

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
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
