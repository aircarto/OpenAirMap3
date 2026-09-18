import type { MeasurementDevice, TemporalDataPoint } from '../types';

const TEMPORAL_MERGE_TOLERANCE_MS = 5 * 60 * 1000;

/** Sources supportées par fetchTemporalData (aligné mode historique). */
export const AIRCROWD_WMS_TEMPORAL_SOURCES = [
  'atmoMicro',
  'atmoRef',
  'communautaire.nebuleair',
] as const;

export type AirCrowdWmsTemporalSource =
  (typeof AIRCROWD_WMS_TEMPORAL_SOURCES)[number];

/**
 * Fenêtre locale du créneau TimeBar [HH:00, (HH+1):00] en ISO UTC.
 * targetMs = heure de fin locale (aligné timestamps API UTC en heure de fin).
 */
export const buildAirCrowdWmsHourWindow = (
  dateIso: string,
  startHour: number
): { startDate: string; endDate: string; targetMs: number } => {
  const clampedHour = Math.max(0, Math.min(23, Math.floor(startHour)));
  const [y, m, d] = dateIso.split('-').map(Number);
  const startLocal = new Date(y, m - 1, d, clampedHour, 0, 0, 0);
  const endLocal =
    clampedHour === 23
      ? new Date(y, m - 1, d + 1, 0, 0, 0, 0)
      : new Date(y, m - 1, d, clampedHour + 1, 0, 0, 0);

  return {
    startDate: startLocal.toISOString(),
    endDate: endLocal.toISOString(),
    targetMs: endLocal.getTime(),
  };
};

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
        existing.averageValue = sum / existing.devices.length;
        existing.qualityLevels = qualityLevels;
      } else {
        const qualityLevels: Record<string, number> = {};
        let sum = 0;
        for (const device of validDevices) {
          sum += device.value;
          const level = device.qualityLevel || 'unknown';
          qualityLevels[level] = (qualityLevels[level] || 0) + 1;
        }
        temporalDataMap.set(point.timestamp, {
          timestamp: point.timestamp,
          devices: [...validDevices],
          deviceCount: validDevices.length,
          averageValue: sum / validDevices.length,
          qualityLevels,
        });
      }
    }
  }

  return Array.from(temporalDataMap.values()).sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

/** Point temporel le plus proche de targetMs (heure de fin du créneau). */
export const pickClosestTemporalPoint = (
  points: TemporalDataPoint[],
  targetMs: number
): TemporalDataPoint | null => {
  if (points.length === 0) return null;

  let best = points[0];
  let bestDist = Math.abs(new Date(best.timestamp).getTime() - targetMs);

  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(new Date(points[i].timestamp).getTime() - targetMs);
    if (dist < bestDist) {
      best = points[i];
      bestDist = dist;
    }
  }

  return best;
};

export const filterDevicesByAtmoMicroWhitelist = (
  devices: MeasurementDevice[],
  allowedIds?: Array<string | number>
): MeasurementDevice[] => {
  if (!allowedIds || allowedIds.length === 0) return devices;
  const allowed = new Set(allowedIds.map((id) => id.toString().toUpperCase()));
  return devices.filter((device) => {
    if (device.source !== 'atmoMicro') return true;
    return allowed.has(device.id.toString().toUpperCase());
  });
};

/** Libellé chip période (date + plage horaire locale). */
export const getAirCrowdWmsDisplayedPeriod = (
  dateIso: string,
  hour: number,
  locale: string
): string => {
  const clampedHour = Math.max(0, Math.min(23, Math.floor(hour)));
  const [y, m, d] = dateIso.split('-').map(Number);
  const start = new Date(y, m - 1, d, clampedHour, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  const startTime = timeFmt.format(start).replace(':00', 'h');
  const endTime = timeFmt.format(end).replace(':00', 'h');
  return `${dateFmt.format(start)} ${startTime}–${endTime}`;
};

export const resolveAirCrowdWmsTemporalSources = (
  selectedSources: string[]
): AirCrowdWmsTemporalSource[] =>
  AIRCROWD_WMS_TEMPORAL_SOURCES.filter((source) =>
    selectedSources.includes(source)
  );
