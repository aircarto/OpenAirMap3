import { describe, it, expect } from 'vitest';
import type { MobileAirDataPoint } from '../../types';
import { buildLiveTrailSegments } from '../mobileAirLiveTrail';
import { QUALITY_COLORS } from '../../constants/qualityColors';

const point = (
  overrides: Partial<MobileAirDataPoint> & {
    time: string;
    lat: number;
    lon: number;
    PM25: number;
  }
): MobileAirDataPoint => ({
  sensorId: 'mobileair-001',
  sessionId: 1,
  sat: 8,
  PM1: 5,
  PM10: 12,
  moving: 1,
  ...overrides,
});

describe('buildLiveTrailSegments', () => {
  it('retourne [] s’il y a moins de 2 points valides', () => {
    expect(buildLiveTrailSegments([], 'pm25')).toEqual([]);
    expect(
      buildLiveTrailSegments(
        [point({ time: '2026-09-30T12:00:00Z', lat: 43.3, lon: 5.4, PM25: 10 })],
        'pm25'
      )
    ).toEqual([]);
  });

  it('crée 2 segments colorés pour 3 points (queue = 2 précédents)', () => {
    const points = [
      point({
        time: '2026-09-30T12:00:00Z',
        lat: 43.3,
        lon: 5.4,
        PM25: 5,
      }),
      point({
        time: '2026-09-30T12:01:00Z',
        lat: 43.31,
        lon: 5.41,
        PM25: 40,
      }),
      point({
        time: '2026-09-30T12:02:00Z',
        lat: 43.32,
        lon: 5.42,
        PM25: 80,
      }),
    ];

    const segments = buildLiveTrailSegments(points, 'pm25');
    expect(segments).toHaveLength(2);
    expect(segments[0].positions).toEqual([
      [43.3, 5.4],
      [43.31, 5.41],
    ]);
    expect(segments[1].positions).toEqual([
      [43.31, 5.41],
      [43.32, 5.42],
    ]);
    // Couleur du segment = concentration du point de départ (précédent)
    expect(segments[0].color).toBe(QUALITY_COLORS.bon);
    expect(segments[1].color).toBe(QUALITY_COLORS.degrade);
  });

  it('ne garde que les 3 derniers points', () => {
    const points = [
      point({
        time: '2026-09-30T11:59:00Z',
        lat: 43.29,
        lon: 5.39,
        PM25: 1,
      }),
      point({
        time: '2026-09-30T12:00:00Z',
        lat: 43.3,
        lon: 5.4,
        PM25: 5,
      }),
      point({
        time: '2026-09-30T12:01:00Z',
        lat: 43.31,
        lon: 5.41,
        PM25: 10,
      }),
      point({
        time: '2026-09-30T12:02:00Z',
        lat: 43.32,
        lon: 5.42,
        PM25: 15,
      }),
    ];

    const segments = buildLiveTrailSegments(points, 'pm25');
    expect(segments).toHaveLength(2);
    expect(segments[0].positions[0]).toEqual([43.3, 5.4]);
  });
});
