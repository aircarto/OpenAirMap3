export interface TimeRange {
  type: 'preset' | 'custom';
  preset?: '3h' | '24h' | '7d' | '30d';
  custom?: {
    startDate: string;
    endDate: string;
  };
}

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
