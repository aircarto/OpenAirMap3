import type { DeviceLocationStay } from '../../../types';

export interface LocationChangeMarker {
  timestamp: number;
  label: string;
}

export interface LocationHighlightBand {
  start: number;
  end: number;
  label: string;
}

const toMs = (iso: string): number => new Date(iso).getTime();

/**
 * Bornes de changement de site dans la plage visible (début de chaque intervalle
 * sauf le tout premier point chronologique global).
 */
export const getLocationChangeMarkers = (
  stays: DeviceLocationStay[],
  rangeMinMs?: number,
  rangeMaxMs?: number
): LocationChangeMarker[] => {
  const starts: Array<{ ts: number; label: string }> = [];
  for (const stay of stays) {
    for (const interval of stay.intervals) {
      starts.push({ ts: toMs(interval.start), label: stay.label });
    }
  }
  starts.sort((a, b) => a.ts - b.ts);
  if (starts.length === 0) {
    return [];
  }

  const markers: LocationChangeMarker[] = [];
  for (let i = 1; i < starts.length; i++) {
    const { ts, label } = starts[i];
    if (rangeMinMs !== undefined && ts < rangeMinMs) continue;
    if (rangeMaxMs !== undefined && ts > rangeMaxMs) continue;
    markers.push({ timestamp: ts, label });
  }
  return markers;
};

/** Bandes de highlight pour le site sélectionné, découpées à la plage visible. */
export const getLocationHighlightBands = (
  stay: DeviceLocationStay | undefined,
  rangeMinMs?: number,
  rangeMaxMs?: number
): LocationHighlightBand[] => {
  if (!stay) return [];

  const bands: LocationHighlightBand[] = [];
  for (const interval of stay.intervals) {
    let start = toMs(interval.start);
    let end = toMs(interval.end);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    // Élargir d'une heure si start===end (point quotidien unique).
    if (end === start) {
      end = start + 24 * 60 * 60 * 1000;
    }
    if (rangeMinMs !== undefined) {
      start = Math.max(start, rangeMinMs);
    }
    if (rangeMaxMs !== undefined) {
      end = Math.min(end, rangeMaxMs);
    }
    if (end <= start) continue;
    bands.push({ start, end, label: stay.label });
  }
  return bands;
};
