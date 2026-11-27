/**
 * Utilitaires pour le filtrage des signalements SignalAir en mode historique
 * Toutes les dates et heures sont traitées en LOCAL (fuseau de l'utilisateur)
 */

import { SignalAirReport } from '../types';

/** Période en millisecondes (timestamps) */
export interface PeriodMs {
  startMs: number;
  endMs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Durée maximale retenue pour une nuisance (« Plusieurs jours »).
 * Sert aussi de marge de chargement : voir `extendSignalAirFetchStart`.
 */
export const SIGNAL_AIR_MAX_DURATION_DAYS = 3;

/**
 * Convertit la durée déclarée d'une nuisance en millisecondes.
 *
 * Le flux SignalAir ne renvoie pas de texte libre mais quatre catégories
 * (relevé du 27/11/2026) :
 *
 * | Catégorie           | Durée retenue                          |
 * |---------------------|----------------------------------------|
 * | « Moins d'une heure » | 1 h                                  |
 * | « Quelques heures »   | 3 h                                  |
 * | « Plusieurs jours »   | 3 jours                              |
 * | « Ne sait pas » / vide | `null` → jusqu'à minuit le même jour |
 *
 * Les formats numériques (« 2h », « 30 minutes », « 3 jours ») restent lus,
 * par prudence si le formulaire évolue.
 *
 * @returns la durée en ms, ou `null` si elle est inconnue : l'appelant borne
 *   alors la nuisance à la fin de la journée déclarée.
 */
export function parseSignalDuration(
  duration: string | null | undefined
): number | null {
  if (!duration || typeof duration !== 'string') {
    return null;
  }

  // Minuscules, apostrophe typographique, accents : « Moins d’une heure » et
  // « moins d'une heure » doivent donner la même chose.
  const s = duration
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!s) return null;

  // Catégories du flux, avant toute lecture de nombre
  if (/\bmoins d'une heure\b/.test(s)) return HOUR_MS;
  if (/\bquelques heures\b/.test(s)) return 3 * HOUR_MS;
  if (/\b(plusieurs|quelques) jours\b/.test(s)) {
    return SIGNAL_AIR_MAX_DURATION_DAYS * DAY_MS;
  }
  if (/\b(toute la journee|journee entiere)\b/.test(s)) return DAY_MS;

  // Formats numériques (supporte "1,5", "2", etc.)
  const numberMatch = s.match(/(\d+([.,]\d+)?)/);
  if (!numberMatch) {
    return null;
  }

  const num = parseFloat(numberMatch[1].replace(',', '.'));

  if (/\b(jour|jours|j)\b/.test(s)) {
    return Math.round(num * DAY_MS);
  }

  if (
    /\b(h|heure|heures|hr|hrs)\b/.test(s) ||
    s.includes('h ') ||
    s.endsWith('h')
  ) {
    return Math.round(num * HOUR_MS);
  }

  // Minutes par défaut
  return Math.round(num * 60 * 1000);
}

/**
 * Calcule la période du signalement en temps local (millisecondes).
 * Début = date déclarée de la nuisance (`signalDate`) uniquement ;
 * fin = début + `signalDuration`, ou fin de la journée déclarée (23:59:59.999
 * local) quand la durée est inconnue.
 */
export function getReportPeriodInLocal(report: SignalAirReport): PeriodMs {
  const startStr = report.signalDate?.trim();
  if (!startStr) {
    return { startMs: 0, endMs: 0 };
  }

  const startDate = new Date(startStr);

  if (isNaN(startDate.getTime())) {
    return { startMs: 0, endMs: 0 };
  }

  const startMs = startDate.getTime();
  const durationMs = parseSignalDuration(report.signalDuration);
  const endMs =
    durationMs === null
      ? new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          23,
          59,
          59,
          999
        ).getTime()
      : startMs + durationMs;

  return { startMs, endMs };
}

/**
 * Recule la date de début d'une requête SignalAir (`YYYY-MM-DD`) de la durée
 * maximale d'une nuisance.
 *
 * Le flux sélectionne les signalements par date de DÉBUT de nuisance, alors
 * que l'affichage retient tout ce qui CHEVAUCHE le créneau. Sans cette marge,
 * une nuisance « Plusieurs jours » commencée avant la fenêtre chargée
 * (24 h en pas horaire) concerne bien le créneau affiché mais n'est jamais
 * téléchargée. Le filtre d'affichage écarte ensuite ce qui ne chevauche pas.
 */
export function extendSignalAirFetchStart(startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return startDate;
  const date = new Date(y, m - 1, d - SIGNAL_AIR_MAX_DURATION_DAYS);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Calcule la fenêtre d'affichage correspondant au currentDate et au pas de temps,
 * en temps local.
 */
export function getDisplayWindowInLocal(
  currentDate: string,
  timeStep: string
): PeriodMs | null {
  if (!currentDate) return null;

  const d = new Date(currentDate);
  if (isNaN(d.getTime())) return null;

  const timeMs = d.getTime();

  switch (timeStep) {
    case 'quartHeure': {
      return {
        startMs: timeMs,
        endMs: timeMs + 15 * 60 * 1000,
      };
    }
    case 'heure': {
      return {
        startMs: timeMs,
        endMs: timeMs + 60 * 60 * 1000,
      };
    }
    case 'jour': {
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
      return {
        startMs: startOfDay.getTime(),
        endMs: endOfDay.getTime(),
      };
    }
    default:
      return null;
  }
}

/**
 * Vérifie si deux périodes se chevauchent.
 */
export function doPeriodsOverlap(a: PeriodMs, b: PeriodMs): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/**
 * Filtre les signalements dont la période (date déclarée de nuisance) chevauche
 * la fenêtre d'affichage courante. Sans `signalDate` valide : exclu.
 */
export function filterReportsByDisplayWindow(
  reports: SignalAirReport[],
  currentDate: string,
  timeStep: string
): SignalAirReport[] {
  const window = getDisplayWindowInLocal(currentDate, timeStep);
  if (!window) return [];

  return reports.filter((report) => {
    const reportPeriod = getReportPeriodInLocal(report);
    if (reportPeriod.startMs === 0 && reportPeriod.endMs === 0) {
      return false;
    }
    return doPeriodsOverlap(window, reportPeriod);
  });
}
