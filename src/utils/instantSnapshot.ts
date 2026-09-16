import type { MeasurementDevice, TemporalDataPoint } from '../types';

const TEMPORAL_MERGE_TOLERANCE_MS = 5 * 60 * 1000;

export const SNAPSHOT_TEMPORAL_SOURCES = [
  'atmoMicro',
  'atmoRef',
  'communautaire.nebuleair',
] as const;

export type SnapshotTemporalSource = (typeof SNAPSHOT_TEMPORAL_SOURCES)[number];

export const isValidTemporalDevice = (
  device: MeasurementDevice | null | undefined
): device is MeasurementDevice =>
  Boolean(
    device &&
      device.value !== null &&
      device.value !== undefined &&
      typeof device.value === 'number' &&
      !Number.isNaN(device.value)
  );

/** Fusionne plusieurs séries temporelles par timestamp (tolérance 5 min). */
export const mergeTemporalDataPoints = (
  seriesList: TemporalDataPoint[][]
): TemporalDataPoint[] => {
  const temporalDataMap = new Map<string, TemporalDataPoint>();

  for (const series of seriesList) {
    for (const point of series) {
      const validDevices = point.devices.filter(isValidTemporalDevice);
      if (validDevices.length === 0) continue;

      const targetTime = new Date(point.timestamp).getTime();
      let existingTimestamp: string | null = null;

      for (const [timestamp] of temporalDataMap) {
        const timeDiff = Math.abs(new Date(timestamp).getTime() - targetTime);
        if (timeDiff <= TEMPORAL_MERGE_TOLERANCE_MS) {
          existingTimestamp = timestamp;
          break;
        }
      }

      if (existingTimestamp) {
        const existing = temporalDataMap.get(existingTimestamp)!;
        existing.devices.push(...validDevices);
        existing.deviceCount = existing.devices.length;
        const qualityLevels: Record<string, number> = {};
        let sum = 0;
        for (const device of existing.devices) {
          sum += device.value;
          const level = device.qualityLevel || 'unknown';
          qualityLevels[level] = (qualityLevels[level] || 0) + 1;
        }
        existing.qualityLevels = qualityLevels;
        existing.averageValue =
          existing.devices.length > 0 ? sum / existing.devices.length : 0;
      } else {
        const qualityLevels: Record<string, number> = {};
        let sum = 0;
        for (const device of validDevices) {
          sum += device.value;
          const level = device.qualityLevel || 'unknown';
          qualityLevels[level] = (qualityLevels[level] || 0) + 1;
        }
        temporalDataMap.set(point.timestamp, {
          ...point,
          devices: [...validDevices],
          deviceCount: validDevices.length,
          qualityLevels,
          averageValue:
            validDevices.length > 0 ? sum / validDevices.length : 0,
        });
      }
    }
  }

  return [...temporalDataMap.values()].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

export const pickClosestTemporalPoint = (
  points: TemporalDataPoint[],
  targetMs: number
): TemporalDataPoint | null => {
  if (points.length === 0) return null;
  let closest = points[0];
  let best = Math.abs(new Date(closest.timestamp).getTime() - targetMs);
  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(new Date(points[i].timestamp).getTime() - targetMs);
    if (dist < best) {
      closest = points[i];
      best = dist;
    }
  }
  return closest;
};

export const isHttpNotFound = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message);
};

export const resolveSnapshotTemporalSources = (
  selectedSources: string[]
): SnapshotTemporalSource[] =>
  SNAPSHOT_TEMPORAL_SOURCES.filter((source) =>
    selectedSources.includes(source)
  );
