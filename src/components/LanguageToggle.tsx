import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageToggle: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-white/50 backdrop-blur-sm border border-zinc-200 rounded-lg transition-all hover:bg-white shadow-sm"
      aria-label="Toggle language"
    >
      <Globe className="w-4 h-4" />
      <span>{i18n.language.toUpperCase().split('-')[0]}</span>
    </button>
  );
};
