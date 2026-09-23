/** Plafond de capteurs MobileAir chargeables en parallèle (API Air Carto). */
export const MAX_MOBILE_AIR_SENSORS = 5;

export type MobileAirSensorStatus = 'idle' | 'loading' | 'ready' | 'error';

export type MobileAirPeriod = { startDate: string; endDate: string };

/** Clé stable pour une session affichée sur la carte. */
export const mobileAirRouteKey = (
  sensorId: string,
  sessionId: number | string
): string => `${sensorId}-${sessionId}`;
