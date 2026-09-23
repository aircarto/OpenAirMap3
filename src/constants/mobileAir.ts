/** Plafond de capteurs MobileAir chargeables en parallèle (API Air Carto). */
export const MAX_MOBILE_AIR_SENSORS = 5;

export type MobileAirSensorStatus = 'idle' | 'loading' | 'ready' | 'error';

export type MobileAirPeriod = { startDate: string; endDate: string };

/** Clé stable pour une session affichée sur la carte. */
export const mobileAirRouteKey = (
  sensorId: string,
  sessionId: number | string
): string => `${sensorId}-${sessionId}`;

/**
 * Session la plus récente d’une liste (par `endTime`, repli sur `startTime`).
 */
export const pickMostRecentMobileAirRoute = <
  T extends { startTime: string; endTime?: string },
>(
  routes: T[]
): T | null => {
  if (routes.length === 0) return null;
  return routes.reduce((latest, current) => {
    const currentEnd = Date.parse(current.endTime || current.startTime);
    const latestEnd = Date.parse(latest.endTime || latest.startTime);
    if (Number.isNaN(currentEnd)) return latest;
    if (Number.isNaN(latestEnd)) return current;
    return currentEnd >= latestEnd ? current : latest;
  });
};
