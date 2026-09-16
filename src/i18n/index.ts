import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import it from '../locales/it.json';
import ar from '../locales/ar.json';
import de from '../locales/de.json';

export const supportedLanguages = [
  { code: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'Español', short: 'ES', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', short: 'IT', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', short: 'DE', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', short: 'AR', flag: '🇸🇦' },
] as const;

export type SupportedLocale = (typeof supportedLanguages)[number]['code'];

export const STORAGE_KEY = 'openairmap-locale';

const supportedLngCodes = supportedLanguages.map((l) => l.code);

/**
 * Initialise i18next uniquement côté navigateur.
 * Évite d'exécuter i18n.init au chargement du module sur le serveur Next.
 */
export const ensureI18n = (locale?: SupportedLocale): typeof i18n => {
  if (typeof window === 'undefined') {
    return i18n;
  }

  if (!i18n.isInitialized) {
    let initial: SupportedLocale = locale ?? 'fr';
    if (!locale) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && (supportedLngCodes as string[]).includes(saved)) {
          initial = saved as SupportedLocale;
        }
      } catch {
        // ignore
      }
    }

    i18n.use(initReactI18next).init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
        es: { translation: es },
        it: { translation: it },
        de: { translation: de },
        ar: { translation: ar },
      },
      lng: initial,
      fallbackLng: 'fr',
      supportedLngs: supportedLngCodes,
      interpolation: {
        escapeValue: false,
      },
    });

    i18n.on('languageChanged', (lng) => {
      document.documentElement.lang = lng;
      document.documentElement.setAttribute('data-locale', lng);
      try {
        localStorage.setItem(STORAGE_KEY, lng);
      } catch {
        // ignore
      }
    });
  }

  return i18n;
};

export default i18n;
