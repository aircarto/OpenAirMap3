import { mobileAirRouteKey, pickMostRecentMobileAirRoute } from '../mobileAir';

/**
 * Miroir de la logique de seed de useMobileAir (sessions préférées au clic live).
 * Exposée pour tests unitaires sans monter le hook.
 */
export const seedSessionKeysForTest = <
  T extends { sensorId: string; sessionId: number; startTime: string; endTime?: string },
>(
  routes: T[],
  preferredSessionsBySensor: Record<string, number> = {}
): Set<string> => {
  const bySensor = new Map<string, T[]>();
  for (const route of routes) {
    const list = bySensor.get(route.sensorId) ?? [];
    list.push(route);
    bySensor.set(route.sensorId, list);
  }
  const keys = new Set<string>();
  for (const [sensorId, sensorRoutes] of bySensor) {
    const preferredId = preferredSessionsBySensor[sensorId];
    const preferred =
      preferredId != null
        ? sensorRoutes.find((r) => Number(r.sessionId) === Number(preferredId))
        : null;
    const chosen =
      preferred ?? pickMostRecentMobileAirRoute(sensorRoutes);
    if (chosen) {
      keys.add(mobileAirRouteKey(chosen.sensorId, chosen.sessionId));
    }
  }
  return keys;
};
