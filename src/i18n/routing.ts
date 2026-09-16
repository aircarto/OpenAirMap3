import { defineRouting } from 'next-intl/routing';

export const locales = ['fr', 'en', 'es', 'it', 'de', 'ar'] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  localeDetection: true,
  pathnames: {
    '/': '/',
    '/a-propos': {
      fr: '/a-propos',
      en: '/about',
      es: '/acerca-de',
      it: '/informazioni',
      de: '/ueber',
      ar: '/about',
    },
    '/mentions-legales': {
      fr: '/mentions-legales',
      en: '/legal-notice',
      es: '/aviso-legal',
      it: '/note-legali',
      de: '/impressum',
      ar: '/legal-notice',
    },
  },
});
