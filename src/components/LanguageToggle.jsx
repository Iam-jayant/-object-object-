import { useI18n } from '../context/i18nContext';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';

export default function LanguageToggle() {
  const { lang, switchLang } = useI18n();

  return (
    <div className="flex items-center bg-surface-800 border border-surface-700 rounded-lg p-0.5">
      {SUPPORTED_LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLang(code)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200
            ${lang === code
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-surface-400 hover:text-surface-200'
            }`}
          title={code === 'en' ? 'Switch to English' : 'हिन्दी में बदलें'}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
