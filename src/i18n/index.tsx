import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, type MessageKey, type Messages } from './en';
import { fi } from './fi';

export type Locale = 'en' | 'fi';

const STORAGE_KEY = 'inventaario.locale';

const dictionaries: Record<Locale, Messages> = { en, fi };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  strings: Messages;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === 'en' || stored === 'fi')) {
          setLocaleState(stored);
        }
      } catch {
        // keep default
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const strings = dictionaries[locale];

  const t = useCallback(
    (key: MessageKey) => strings[key] ?? en[key] ?? String(key),
    [strings],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, strings, ready }),
    [locale, setLocale, t, strings, ready],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within LocaleProvider');
  }
  return ctx;
}

export { en, fi };
export type { MessageKey, Messages };
