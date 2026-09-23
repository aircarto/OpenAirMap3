import type { MobileAirPeriod } from "../constants/mobileAir";

/**
 * Enveloppe temporelle affichée sur la carte en mode « mesure en mobilité » :
 * min(débuts) … max(fins) sur la période globale et les overrides par capteur.
 */
export function getMobileAirMapPeriod(
  defaultPeriod: MobileAirPeriod,
  sensorPeriods: Record<string, MobileAirPeriod>,
  sensorIds: string[]
): MobileAirPeriod {
  if (sensorIds.length === 0) {
    return defaultPeriod;
  }

  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  let startIso = defaultPeriod.startDate;
  let endIso = defaultPeriod.endDate;

  for (const id of sensorIds) {
    const period = sensorPeriods[id] ?? defaultPeriod;
    const s = Date.parse(period.startDate);
    const e = Date.parse(period.endDate);
    if (!Number.isNaN(s) && s <= startMs) {
      startMs = s;
      startIso = period.startDate;
    }
    if (!Number.isNaN(e) && e >= endMs) {
      endMs = e;
      endIso = period.endDate;
    }
  }

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return defaultPeriod;
  }

  return { startDate: startIso, endDate: endIso };
}

/**
 * Formate une plage ISO pour le chip « Mesure en mobilité ».
 */
export function formatMobileAirPeriodRange(
  period: MobileAirPeriod,
  locale?: string
): string {
  const loc = (() => {
    if (!locale) return "fr-FR";
    const map: Record<string, string> = {
      fr: "fr-FR",
      en: "en-GB",
      ar: "ar-SA",
      es: "es-ES",
      it: "it-IT",
      de: "de-DE",
    };
    return map[locale.slice(0, 2)] || "fr-FR";
  })();

  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  return `${start.toLocaleDateString(loc, opts)} – ${end.toLocaleDateString(loc, opts)}`;
}
