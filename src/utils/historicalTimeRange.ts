export interface CustomTimeRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (local), défaut "00:00"
  endTime?: string; // HH:mm (local), défaut "23:59"
}

export interface TimeRange {
  type: 'preset' | 'custom';
  preset?: '3h' | '24h' | '7d' | '30d';
  custom?: CustomTimeRange;
}

/** Convertit une plage personnalisée (date+heure locale) en ISO UTC pour les APIs. */
export const getCustomRangeISO = (
  custom: CustomTimeRange
): { startDate: string; endDate: string } => {
  const start = new Date(
    `${custom.startDate}T${custom.startTime ?? '00:00'}:00`
  );
  const end = new Date(`${custom.endDate}T${custom.endTime ?? '23:59'}:59.999`);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
};

/**
 * Parse une date du mode historique pour l'axe X du graphique.
 * Aligné sur AtmoMicroService.formatDateForHistoricalMode :
 * - YYYY-MM-DD → minuit local (début) ou minuit local du jour suivant (fin)
 * - ISO avec heure → conservé tel quel
 */
export const parseHistoricalAxisDate = (
  dateString: string,
  isEndDate = false
): number => {
  const hasTimeComponent = /T\d{2}:\d{2}/.test(dateString);

  if (!hasTimeComponent) {
    const [year, month, day] = dateString.split('-').map(Number);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return Number.NaN;
    }
    if (isEndDate) {
      return new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }

  return new Date(dateString).getTime();
};

const getTimeStepPaddingMs = (timeStep?: string): number => {
  switch (timeStep) {
    case 'quartHeure':
      return (15 * 60 * 1000) / 2;
    case 'heure':
      return (60 * 60 * 1000) / 2;
    case 'jour':
      return (24 * 60 * 60 * 1000) / 2;
    default:
      return 30 * 1000;
  }
};

/** Bornes de l'axe X pour le mode historique, avec marge pour éviter le rognage aux bords. */
export const getHistoricalAxisRange = (
  minStr: string,
  maxStr: string,
  timeStep?: string,
  dataPoints?: Array<{ timestampValue?: number }>
): { min: number; max: number } | null => {
  let min = parseHistoricalAxisDate(minStr, false);
  let max = parseHistoricalAxisDate(maxStr, true);

  if (Number.isNaN(min) || Number.isNaN(max)) {
    return null;
  }

  if (dataPoints?.length) {
    for (const point of dataPoints) {
      const ts = point.timestampValue;
      if (ts !== undefined && !Number.isNaN(ts)) {
        min = Math.min(min, ts);
        max = Math.max(max, ts);
      }
    }
  }

  const padding = getTimeStepPaddingMs(timeStep);
  return { min: min - padding, max: max + padding };
};

/** Limite maximale en jours selon le pas de temps (historique). */
export const getMaxHistoryDays = (timeStep?: string): number | null => {
  if (!timeStep) return null;

  switch (timeStep) {
    case 'instantane':
      return 60;
    case 'quartHeure':
      return 180;
    case 'heure':
    case 'jour':
      return null;
    default:
      return null;
  }
};
