import { routing, type AppLocale } from '@/i18n/routing';

type AppPathname = '/' | '/a-propos' | '/mentions-legales' | '/connexion';

type BuildAlternatesArgs = {
  origin: string;
  locale: string;
  /** Pathname interne next-intl, ex. '/' | '/a-propos' */
  pathname: AppPathname;
};

const PATHNAME_LOCALIZED: Record<AppPathname, Record<AppLocale, string>> = {
  '/': {
    fr: '/',
    en: '/en',
    es: '/es',
    it: '/it',
    de: '/de',
    ar: '/ar',
  },
  '/a-propos': {
    fr: '/a-propos',
    en: '/en/about',
    es: '/es/acerca-de',
    it: '/it/informazioni',
    de: '/de/ueber',
    ar: '/ar/about',
  },
  '/mentions-legales': {
    fr: '/mentions-legales',
    en: '/en/legal-notice',
    es: '/es/aviso-legal',
    it: '/it/note-legali',
    de: '/de/impressum',
    ar: '/ar/legal-notice',
  },
  '/connexion': {
    fr: '/connexion',
    en: '/en/login',
    es: '/es/inicio-sesion',
    it: '/it/accesso',
    de: '/de/anmelden',
    ar: '/ar/login',
  },
};

export const localizedPath = (
  locale: string,
  pathname: AppPathname
): string => {
  const loc = (
    routing.locales.includes(locale as AppLocale)
      ? locale
      : routing.defaultLocale
  ) as AppLocale;
  return PATHNAME_LOCALIZED[pathname][loc];
};

/**
 * Canonical + hreflang pour les locales du même domaine uniquement.
 */
export const buildAlternates = ({
  origin,
  locale,
  pathname,
}: BuildAlternatesArgs) => {
  const languages: Record<string, string> = {};

  for (const loc of routing.locales) {
    languages[loc] = `${origin}${localizedPath(loc, pathname)}`;
  }
  languages['x-default'] = languages[routing.defaultLocale];

  return {
    canonical: `${origin}${localizedPath(locale, pathname)}`,
    languages,
  };
};
