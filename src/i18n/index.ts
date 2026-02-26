import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "../locales/fr.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import it from "../locales/it.json";
import ar from "../locales/ar.json";

export const supportedLanguages = [
  { code: "fr", label: "Français", short: "FR", flag: "🇫🇷" },
  { code: "en", label: "English", short: "EN", flag: "🇬🇧" },
  { code: "es", label: "Español", short: "ES", flag: "🇪🇸" },
  { code: "it", label: "Italiano", short: "IT", flag: "🇮🇹" },
  { code: "ar", label: "العربية", short: "AR", flag: "🇸🇦" },
] as const;

export type SupportedLocale = (typeof supportedLanguages)[number]["code"];

const STORAGE_KEY = "openairmap-locale";

const supportedLngCodes = supportedLanguages.map((l) => l.code);

function getInitialLanguage(): SupportedLocale {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (supportedLngCodes as string[]).includes(saved)) {
      return saved as SupportedLocale;
    }
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const browserLang = navigator.language.slice(0, 2).toLowerCase();
    if ((supportedLngCodes as string[]).includes(browserLang)) {
      return browserLang as SupportedLocale;
    }
  }
  return "fr";
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
    it: { translation: it },
    ar: { translation: ar },
  },
  lng: getInitialLanguage(),
  fallbackLng: "fr",
  supportedLngs: supportedLngCodes,
  interpolation: {
    escapeValue: false, // React échappe déjà le HTML
  },
});

// Synchroniser la langue avec l'attribut lang du HTML (accessibilité + SEO).
// On ne met pas dir="rtl" sur le document pour garder la mise en page LTR (panels à gauche, etc.).
// Pour l'arabe, data-locale="ar" permet d'appliquer dir="rtl" uniquement sur les blocs de texte si besoin.
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
    document.documentElement.setAttribute("data-locale", lng);
    try {
      localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      // localStorage indisponible (privé, etc.)
    }
  }
});

// Appliquer la langue et la direction initiales au document (layout toujours LTR)
if (typeof document !== "undefined") {
  const lng = i18n.language || "fr";
  document.documentElement.lang = lng;
  document.documentElement.setAttribute("data-locale", lng);
}

export default i18n;
