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

/**
 * Parse une chaîne de durée (ex: "1 heure", "30 minutes", "2h", "moins de 5 min")
 * en millisecondes.
 * Gère les formats français courants.
 */
export function parseSignalDuration(duration: string): number {
  if (!duration || typeof duration !== 'string') {
    return 0;
  }

  const s = duration.trim().toLowerCase();

  // Durées textuelles sans nombre (ex: "Plusieurs jours")
  if (/\b(plusieurs|plusieurs jours|quelques jours)\b/.test(s)) {
    return 7 * 24 * 60 * 60 * 1000; // 7 jours
  }
  if (/\b(toute la journée|journée entière)\b/.test(s)) {
    return 24 * 60 * 60 * 1000; // 24 h
  }

  // Extraire les nombres (supporte "1,5", "2", etc.)
  const numberMatch = s.match(/(\d+([.,]\d+)?)/);
  if (!numberMatch) {
    return 0;
  }

  const num = parseFloat(numberMatch[1].replace(',', '.'));

  // Unités en jours
  if (/\b(jour|jours|j)\b/.test(s)) {
    return Math.round(num * 24 * 60 * 60 * 1000);
  }

  // Unités en heures
  if (
    /\b(h|heure|heures|hr|hrs)\b/.test(s) ||
    s.includes('h ') ||
    s.endsWith('h')
  ) {
    return Math.round(num * 60 * 60 * 1000);
  }

  // Unités en minutes (défaut)
  return Math.round(num * 60 * 1000);
}

/**
 * Calcule la période du signalement en temps local (millisecondes).
 * Début = date déclarée de la nuisance (`signalDate`) uniquement ;
 * fin = début + `signalDuration`.
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
  const durationMs = parseSignalDuration(report.signalDuration || '');
  const endMs = startMs + durationMs;

  return { startMs, endMs };
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
