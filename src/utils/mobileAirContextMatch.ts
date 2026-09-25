import type {
  MobileAirContextRaw,
  MobileAirContextType,
  MobileAirDataPoint,
  MobileAirMatchedReport,
  MobileAirRoute,
} from '../types';

/** Écart max pour apparier un signalement à un point (mail AirCarto). */
export const MOBILE_AIR_CONTEXT_MATCH_MAX_MS = 2 * 60 * 1000;

export const MOBILE_AIR_CONTEXT_TYPES: readonly MobileAirContextType[] = [
  'fire',
  'industrial',
  'traffic',
  'neighbourhood',
  'works',
  'cleaning',
  'cooking',
  'meeting',
  'fault',
  'other',
] as const;

export const mobileAirContextTypeI18nKey = (
  contextType: string
): string => `mobileAir.contextType.${contextType}`;

/**
 * Point du même sessionId le plus proche en temps ; null si écart > 2 min.
 */
export const matchContextToPoint = (
  context: MobileAirContextRaw,
  points: MobileAirDataPoint[],
  maxDeltaMs: number = MOBILE_AIR_CONTEXT_MATCH_MAX_MS
): { point: MobileAirDataPoint; deltaMs: number } | null => {
  if (!points.length) return null;

  const targetMs = Date.parse(context.datetime_start);
  if (Number.isNaN(targetMs)) return null;

  let best: MobileAirDataPoint | null = null;
  let bestDelta = Infinity;

  for (const point of points) {
    const pointMs = Date.parse(point.time);
    if (Number.isNaN(pointMs)) continue;
    const delta = Math.abs(pointMs - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = point;
    }
  }

  if (!best || bestDelta > maxDeltaMs) return null;
  return { point: best, deltaMs: bestDelta };
};

/**
 * Apparie les signalements get_context aux points des routes (même sessionId).
 */
export const matchContextsToRoutes = (
  contexts: MobileAirContextRaw[],
  routes: MobileAirRoute[],
  maxDeltaMs: number = MOBILE_AIR_CONTEXT_MATCH_MAX_MS
): MobileAirMatchedReport[] => {
  const pointsBySession = new Map<number, MobileAirDataPoint[]>();
  for (const route of routes) {
    const existing = pointsBySession.get(route.sessionId) ?? [];
    existing.push(...route.points);
    pointsBySession.set(route.sessionId, existing);
  }

  const matched: MobileAirMatchedReport[] = [];

  for (const context of contexts) {
    const targetMs = Date.parse(context.datetime_start);
    if (Number.isNaN(targetMs)) continue;

    // Chercher d’abord une session dont la fenêtre couvre l’instant, puis match ≤2 min
    let bestMatch: {
      route: MobileAirRoute;
      point: MobileAirDataPoint;
      deltaMs: number;
    } | null = null;

    for (const route of routes) {
      const points = pointsBySession.get(route.sessionId) ?? route.points;
      const hit = matchContextToPoint(context, points, maxDeltaMs);
      if (!hit) continue;
      if (!bestMatch || hit.deltaMs < bestMatch.deltaMs) {
        bestMatch = { route, point: hit.point, deltaMs: hit.deltaMs };
      }
    }

    if (!bestMatch) continue;

    matched.push({
      id: String(context.id),
      sensorId: bestMatch.route.sensorId,
      sessionId: bestMatch.point.sessionId,
      contextType: context.context_type,
      comments: context.comments ?? '',
      datetimeStart: context.datetime_start,
      datetimeStop: context.datetime_stop,
      photos: context.photos ?? [],
      matchedPoint: bestMatch.point,
      timeDeltaMs: bestMatch.deltaMs,
    });
  }

  return matched.sort(
    (a, b) =>
      Date.parse(a.datetimeStart) - Date.parse(b.datetimeStart)
  );
};

/**
 * Filtre les signalements d’une session (pour graphe / liste détail).
 */
export const filterReportsForRoute = (
  reports: MobileAirMatchedReport[],
  route: MobileAirRoute | null
): MobileAirMatchedReport[] => {
  if (!route) return [];
  return reports.filter(
    (r) =>
      String(r.sensorId) === String(route.sensorId) &&
      String(r.sessionId) === String(route.sessionId)
  );
};
