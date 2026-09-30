import type { MobileAirDataPoint } from '../types';
import { pollutants } from '../constants/pollutants';
import { getQualityColor } from '../constants/qualityColors';

const POLLUTANT_KEY: Record<string, keyof MobileAirDataPoint> = {
  pm1: 'PM1',
  pm25: 'PM25',
  pm10: 'PM10',
};

export interface LiveTrailSegment {
  positions: [number, number][];
  color: string;
  /** Indice du segment depuis le plus ancien (0) vers la tête. */
  index: number;
}

const hasValidCoords = (point: MobileAirDataPoint): boolean =>
  typeof point.lat === 'number' &&
  typeof point.lon === 'number' &&
  !Number.isNaN(point.lat) &&
  !Number.isNaN(point.lon);

const pointValue = (
  point: MobileAirDataPoint,
  pollutant: string
): number => {
  const key = POLLUTANT_KEY[pollutant] || 'PM25';
  const raw = point[key] as number;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  return Math.max(0, raw);
};

/**
 * Queue live MobileAir (`fixed === false`) : jusqu’à 3 points,
 * segments colorés selon la concentration du point de départ
 * (les 2 points précédents la tête).
 */
export const buildLiveTrailSegments = (
  points: MobileAirDataPoint[],
  pollutant: string,
  maxPoints = 3
): LiveTrailSegment[] => {
  const sorted = [...points]
    .filter(hasValidCoords)
    .sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    )
    .slice(-maxPoints);

  const segments: LiveTrailSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    segments.push({
      positions: [
        [from.lat, from.lon],
        [to.lat, to.lon],
      ],
      color: getQualityColor(pointValue(from, pollutant), pollutant, pollutants),
      index: i,
    });
  }
  return segments;
};
