'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { I18nextProvider } from 'react-i18next';
import i18n, { ensureI18n, type SupportedLocale } from './index';

/**
 * Initialise i18next côté client et le synchronise avec la locale URL (next-intl).
 */
export const I18nLocaleSync = ({ children }: { children: React.ReactNode }) => {
  const locale = useLocale() as SupportedLocale;
  const lastLocale = useRef<string | null>(null);

  // Sync dès le premier rendu client (avant les enfants useTranslation)
  if (typeof window !== 'undefined') {
    ensureI18n(locale);
  }

  useEffect(() => {
    ensureI18n(locale);
    if (lastLocale.current === locale) return;
    lastLocale.current = locale;
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    document.documentElement.lang = locale;
    document.documentElement.setAttribute('data-locale', locale);
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
