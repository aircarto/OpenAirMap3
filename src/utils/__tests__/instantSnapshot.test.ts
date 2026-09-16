import { describe, expect, it } from 'vitest';
import {
  pickClosestTemporalPoint,
  type TemporalDataPoint,
} from '../instantSnapshot';

const point = (iso: string, value: number): TemporalDataPoint => ({
  timestamp: iso,
  devices: [
    {
      id: iso,
      name: iso,
      source: 'atmoRef',
      latitude: 0,
      longitude: 0,
      value,
      pollutant: 'pm25',
      unit: 'µg/m³',
      timestamp: iso,
      status: 'active',
    },
  ],
  deviceCount: 1,
  averageValue: value,
  qualityLevels: {},
});

describe('pickClosestTemporalPoint', () => {
  it('choisit le cran le plus proche dans une série multi-créneaux', () => {
    const series = [
      point('2026-09-10T10:00:00.000Z', 10),
      point('2026-09-10T11:00:00.000Z', 20),
      point('2026-09-10T12:00:00.000Z', 30),
    ];
    const target = new Date('2026-09-10T11:10:00.000Z').getTime();
    const closest = pickClosestTemporalPoint(series, target);
    expect(closest?.averageValue).toBe(20);
  });

  it('renvoie null si la série est vide', () => {
    expect(pickClosestTemporalPoint([], Date.now())).toBeNull();
  });
});
