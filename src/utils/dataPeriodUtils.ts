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

function formatTime(date: Date, loc: string): string {
  return date.toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayMonth(
  date: Date,
  loc: string,
  withYear = false,
  timeZone?: string
): string {
  return date.toLocaleDateString(loc, {
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "2-digit" as const } : {}),
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Sources dont la moyenne journalière porte un horodatage de **jour calendaire
 * UTC** : `timestamp` = J 00:00:00Z pour la moyenne de J (vérifié sur les API
 * le 2026-11-26 : atmoRef `date_debut`, microspot `time`).
 *
 * Les autres sources en sont exclues volontairement : NebuleAir horodate par
 * exemple sa moyenne « 1d » à l'heure du dernier envoi du capteur, c'est-à-dire
 * aujourd'hui, ce qui ferait afficher la mauvaise journée.
 */
const CALENDAR_DAY_SOURCES = new Set(["atmoRef", "atmoMicro"]);

type DailyObservationLike = {
  source: string;
  status: string;
  timestamp?: string;
};

/**
 * Début (ISO, J 00:00Z) de la journée réellement affichée en pas de temps
 * `jour`, déduit des observations plutôt que de l'horloge locale.
 *
 * L'API découpe ses journées en UTC alors que « hier » se calcule en heure
 * locale : entre minuit et 1 h (2 h l'été) en France, les deux divergent.
 *
 * Retient le jour le plus récent parmi les capteurs actifs des sources à jour
 * calendaire. Seuls les horodatages à minuit UTC pile comptent : pendant un
 * changement de pas de temps, la carte porte encore brièvement des mesures
 * horaires, qui ne doivent pas faire basculer le libellé.
 *
 * @returns undefined si aucune observation exploitable (repli sur « hier »).
 */
export function getObservedDailyPeriodStart(
  devices: readonly DailyObservationLike[]
): string | undefined {
  let latest: number | undefined;
  for (const device of devices) {
    if (device.status !== "active" || !CALENDAR_DAY_SOURCES.has(device.source)) {
      continue;
    }
    if (!device.timestamp) continue;
    const time = new Date(device.timestamp);
    const ms = time.getTime();
    if (Number.isNaN(ms)) continue;
    const isUtcDayStart =
      time.getUTCHours() === 0 &&
      time.getUTCMinutes() === 0 &&
      time.getUTCSeconds() === 0;
    if (!isUtcDayStart) continue;
    if (latest === undefined || ms > latest) latest = ms;
  }
  return latest === undefined ? undefined : new Date(latest).toISOString();
}

export type PeriodFormatOptions = {
  /** Format court pour chip mobile (sans label, rapidement lisible) */
  compact?: boolean;
};

/**
 * Retourne la période de données actuellement affichée selon le pas de temps.
 * @param timeStep - Pas de temps (jour, heure, quartHeure, instantane, deuxMin)
 * @param locale - Code langue (fr, en, ar, etc.) pour le formatage date/heure
 * @param options - compact pour chip mobile
 */
export function getCurrentDataPeriod(
  timeStep: string,
  locale?: string,
  options?: PeriodFormatOptions,
  observedDailyPeriodStart?: string
): string {
  const now = new Date();
  const loc = getLocale(locale);
  const compact = Boolean(options?.compact);

  switch (timeStep) {
    case "jour": {
      // Jour réellement servi par les API (jour calendaire UTC) : formaté en
      // UTC, sinon un fuseau à l'ouest de Greenwich afficherait la veille.
      if (observedDailyPeriodStart) {
        const observed = new Date(observedDailyPeriodStart);
        if (!Number.isNaN(observed.getTime())) {
          return formatDayMonth(observed, loc, !compact, "UTC");
        }
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return formatDayMonth(yesterday, loc, !compact);
    }

    case "heure": {
      const lastHour = new Date(now);
      lastHour.setHours(lastHour.getHours() - 1, 0, 0);
      lastHour.setMilliseconds(0);
      const endHour = new Date(lastHour);
      endHour.setHours(endHour.getHours() + 1);
      return `${formatTime(lastHour, loc)}-${formatTime(endHour, loc)}`;
    }

    case "quartHeure": {
      const lastQuarter = new Date(now);
      const currentMinutes = lastQuarter.getMinutes();
      const quarterStart = Math.floor(currentMinutes / 15) * 15;
      lastQuarter.setMinutes(quarterStart - 15, 0);
      lastQuarter.setMilliseconds(0);
      const quarterEnd = new Date(lastQuarter);
      quarterEnd.setMinutes(quarterEnd.getMinutes() + 15);
      return `${formatTime(lastQuarter, loc)}-${formatTime(quarterEnd, loc)}`;
    }

    case "instantane":
      return formatTime(now, loc);

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
      return `${formatTime(lastTwoMin, loc)}-${formatTime(twoMinEnd, loc)}`;
    }

    default:
      return "";
  }
}

/**
 * Formate une date ISO pour l'affichage en mode historique.
 * @param dateString - Date ISO
 * @param locale - Code langue pour le formatage
 * @param options - compact : jj/mm hh:mm (sans année)
 */
export function formatHistoricalDate(
  dateString: string,
  locale?: string,
  options?: PeriodFormatOptions
): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const loc = getLocale(locale);
  if (options?.compact) {
    return `${formatDayMonth(date, loc)} ${formatTime(date, loc)}`;
  }
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
 * @param options - compact pour chip mobile
 * @param observedDailyPeriodStart - jour réellement affiché en pas `jour`
 *   (voir getObservedDailyPeriodStart) ; à défaut, « hier » en heure locale
 */
export function getDisplayedPeriod(
  selectedTimeStep: string,
  historicalCurrentDate?: string,
  locale?: string,
  options?: PeriodFormatOptions,
  observedDailyPeriodStart?: string
): string {
  if (historicalCurrentDate) {
    return formatHistoricalDate(historicalCurrentDate, locale, options);
  }
  return getCurrentDataPeriod(
    selectedTimeStep,
    locale,
    options,
    observedDailyPeriodStart
  );
}
