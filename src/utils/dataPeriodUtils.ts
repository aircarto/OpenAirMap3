/**
 * Utilitaires pour le calcul et le formatage de la période de données affichée.
 * Utilisé par DeviceStatistics (carte) et anciennement par AutoRefreshControl.
 */

/** Map code langue i18n vers locale pour Intl (date/heure) */
const localeMap: Record<string, string> = {
  fr: "fr-FR",
  en: "en-GB",
  ar: "ar-SA",
  es: "es-ES",
  it: "it-IT",
  de: "de-DE",
};

function getLocale(locale?: string): string {
  if (!locale) return "fr-FR";
  return localeMap[locale.slice(0, 2)] || localeMap.fr;
}

/**
 * Retourne la période de données actuellement affichée selon le pas de temps.
 * @param timeStep - Pas de temps (jour, heure, quartHeure, instantane, deuxMin)
 * @param locale - Code langue (fr, en, ar, etc.) pour le formatage date/heure
 */
export function getCurrentDataPeriod(timeStep: string, locale?: string): string {
  const now = new Date();
  const loc = getLocale(locale);

  switch (timeStep) {
    case "jour": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toLocaleDateString(loc, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    case "heure": {
      const lastHour = new Date(now);
      lastHour.setHours(lastHour.getHours() - 1, 0, 0);
      lastHour.setMilliseconds(0);
      const endHour = new Date(lastHour);
      endHour.setHours(endHour.getHours() + 1);
      return `${lastHour.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}-${endHour.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
    }

    case "quartHeure": {
      const lastQuarter = new Date(now);
      const currentMinutes = lastQuarter.getMinutes();
      const quarterStart = Math.floor(currentMinutes / 15) * 15;
      lastQuarter.setMinutes(quarterStart - 15, 0);
      lastQuarter.setMilliseconds(0);
      const quarterEnd = new Date(lastQuarter);
      quarterEnd.setMinutes(quarterEnd.getMinutes() + 15);
      return `${lastQuarter.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}-${quarterEnd.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
    }

    case "instantane":
      return now.toLocaleTimeString(loc, {
        hour: "2-digit",
        minute: "2-digit",
      });

    case "deuxMin": {
      const lastTwoMin = new Date(now);
      const currentMin = lastTwoMin.getMinutes();
      const twoMinStart = Math.floor(currentMin / 2) * 2;
      lastTwoMin.setMinutes(twoMinStart, 0);
      lastTwoMin.setMilliseconds(0);
      if (twoMinStart === currentMin) {
        lastTwoMin.setMinutes(lastTwoMin.getMinutes() - 2);
      }
      const twoMinEnd = new Date(lastTwoMin);
      twoMinEnd.setMinutes(twoMinEnd.getMinutes() + 2);
      return `${lastTwoMin.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}-${twoMinEnd.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
    }

    default:
      return "";
  }
}

/**
 * Formate une date ISO pour l'affichage en mode historique.
 * @param dateString - Date ISO
 * @param locale - Code langue pour le formatage
 */
export function formatHistoricalDate(dateString: string, locale?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const loc = getLocale(locale);
  return date.toLocaleString(loc, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Retourne la période à afficher : date historique si fournie, sinon période calculée selon le pas de temps.
 * @param locale - Code langue (fr, en, ar, etc.) pour adapter le format date/heure
 */
export function getDisplayedPeriod(
  selectedTimeStep: string,
  historicalCurrentDate?: string,
  locale?: string
): string {
  if (historicalCurrentDate) {
    return formatHistoricalDate(historicalCurrentDate, locale);
  }
  return getCurrentDataPeriod(selectedTimeStep, locale);
}
