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
