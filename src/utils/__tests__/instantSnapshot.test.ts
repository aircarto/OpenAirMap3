import { describe, expect, it } from 'vitest';
import {
  hasValidMapCoordinates,
  isValidTemporalDevice,
  mergeTemporalDataPoints,
  pickClosestTemporalPoint,
  type TemporalDataPoint,
} from '../instantSnapshot';
import type { MeasurementDevice } from '../../types';

const device = (
  overrides: Partial<MeasurementDevice> = {}
): MeasurementDevice => ({
  id: 'd1',
  name: 'd1',
  source: 'atmoRef',
  latitude: 43.3,
  longitude: 5.4,
  value: 10,
  pollutant: 'pm25',
  unit: 'µg/m³',
  timestamp: '2026-09-10T10:00:00.000Z',
  status: 'active',
  ...overrides,
});

const point = (iso: string, value: number): TemporalDataPoint => ({
  timestamp: iso,
  devices: [device({ id: iso, name: iso, value, timestamp: iso })],
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

describe('hasValidMapCoordinates / isValidTemporalDevice', () => {
  it('rejette lat/lon null (crash Leaflet TimeBar)', () => {
    expect(hasValidMapCoordinates(null, null)).toBe(false);
    expect(
      isValidTemporalDevice(
        device({
          latitude: null as unknown as number,
          longitude: null as unknown as number,
        })
      )
    ).toBe(false);
  });

  it('accepte des coordonnées numériques valides', () => {
    expect(hasValidMapCoordinates(43.3, 5.4)).toBe(true);
    expect(isValidTemporalDevice(device())).toBe(true);
  });
});

describe('mergeTemporalDataPoints', () => {
  it('écarte les devices sans coordonnées avant fusion', () => {
    const merged = mergeTemporalDataPoints([
      [
        {
          timestamp: '2026-09-10T10:00:00.000Z',
          devices: [
            device({ id: 'ok', value: 12 }),
            device({
              id: 'sans-coords',
              value: 99,
              latitude: null as unknown as number,
              longitude: null as unknown as number,
            }),
          ],
          deviceCount: 2,
          averageValue: 0,
          qualityLevels: {},
        },
      ],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].devices.map((d) => d.id)).toEqual(['ok']);
    expect(merged[0].deviceCount).toBe(1);
  });
});
