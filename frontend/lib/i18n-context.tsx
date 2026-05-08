'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Language, TranslationKey, translations, LANGUAGES,
  getLanguageFromStorage, setLanguageInStorage,
} from './i18n';

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  dir: 'ltr',
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    setLangState(getLanguageFromStorage());
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    setLanguageInStorage(l);
    const info = LANGUAGES.find(x => x.code === l);
    document.documentElement.dir = info?.dir || 'ltr';
    document.documentElement.lang = l;
  };

  const t = (key: TranslationKey): string => {
    return (translations[lang] as any)[key] ?? (translations.en as any)[key] ?? key;
  };

  const dir = (LANGUAGES.find(x => x.code === lang)?.dir || 'ltr') as 'ltr' | 'rtl';

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
