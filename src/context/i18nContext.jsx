import { createContext, useContext, useState, useCallback } from 'react';
import translations, { SUPPORTED_LANGUAGES } from '../i18n/translations';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem('mediproof_lang') || 'en'
  );

  const switchLang = useCallback((code) => {
    setLang(code);
    localStorage.setItem('mediproof_lang', code);
  }, []);

  /** Translate a key, with optional template variables */
  const t = useCallback((key, vars = {}) => {
    const dict = translations[lang] || translations.en;
    let str = dict[key] ?? translations.en[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{{${k}}}`, v);
    });
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, switchLang, t, SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
