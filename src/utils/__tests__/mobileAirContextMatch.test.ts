import { describe, it, expect } from 'vitest';
import {
  matchContextToPoint,
  matchContextsToRoutes,
  filterReportsForRoute,
  MOBILE_AIR_CONTEXT_MATCH_MAX_MS,
} from '../mobileAirContextMatch';
import type {
  MobileAirContextRaw,
  MobileAirDataPoint,
  MobileAirRoute,
} from '../../types';

const point = (
  overrides: Partial<MobileAirDataPoint> = {}
): MobileAirDataPoint => ({
  time: '2026-09-24T10:00:00Z',
  sensorId: 'mobileair-012',
  sessionId: 100,
  sat: 8,
  PM1: 5,
  PM25: 8,
  PM10: 12,
  lat: 43.3,
  lon: 5.4,
  moving: 0,
  ...overrides,
});

const route = (
  overrides: Partial<MobileAirRoute> & { points: MobileAirDataPoint[] }
): MobileAirRoute => ({
  sessionId: overrides.points[0]?.sessionId ?? 100,
  sensorId: 'mobileair-012',
  pollutant: 'pm25',
  averageValue: 8,
  maxValue: 10,
  minValue: 5,
  startTime: overrides.points[0]?.time ?? '2026-09-24T10:00:00Z',
  endTime:
    overrides.points[overrides.points.length - 1]?.time ??
    '2026-09-24T10:00:00Z',
  duration: 10,
  moving: 0,
  ...overrides,
});

describe('mobileAirContextMatch', () => {
  it('apparie un signalement au point le plus proche ≤ 2 min', () => {
    const points = [
      point({ time: '2026-09-24T10:00:00Z' }),
      point({ time: '2026-09-24T10:01:30Z', PM25: 20 }),
    ];
    const context: MobileAirContextRaw = {
      id: 1,
      datetime_start: '2026-09-24T10:01:00Z',
      datetime_stop: '2026-09-24T10:01:00Z',
      context_type: 'traffic',
      comments: 'embouteillage',
    };
    const hit = matchContextToPoint(context, points);
    expect(hit).not.toBeNull();
    expect(hit!.point.time).toBe('2026-09-24T10:01:30Z');
    expect(hit!.deltaMs).toBeLessThanOrEqual(MOBILE_AIR_CONTEXT_MATCH_MAX_MS);
  });

  it('ignore un signalement trop éloigné (> 2 min)', () => {
    const points = [point({ time: '2026-09-24T10:00:00Z' })];
    const context: MobileAirContextRaw = {
      id: 2,
      datetime_start: '2026-09-24T10:05:00Z',
      datetime_stop: '2026-09-24T10:05:00Z',
      context_type: 'fire',
    };
    expect(matchContextToPoint(context, points)).toBeNull();
  });

  it('matchContextsToRoutes renseigne sessionId depuis le point', () => {
    const routes = [
      route({
        points: [
          point({ sessionId: 42, time: '2026-09-24T12:00:00Z' }),
          point({ sessionId: 42, time: '2026-09-24T12:01:00Z' }),
        ],
      }),
    ];
    const contexts: MobileAirContextRaw[] = [
      {
        id: 'ctx-1',
        datetime_start: '2026-09-24T12:00:45Z',
        datetime_stop: '2026-09-24T12:00:45Z',
        context_type: 'works',
        comments: 'travaux',
        photos: [{ url: 'https://example.com/p.jpg' }],
      },
    ];
    const matched = matchContextsToRoutes(contexts, routes);
    expect(matched).toHaveLength(1);
    expect(matched[0].sessionId).toBe(42);
    expect(matched[0].photos).toHaveLength(1);
  });

  it('filterReportsForRoute ne garde que la session courante', () => {
    const r = route({
      points: [point({ sessionId: 1 })],
      sessionId: 1,
    });
    const reports = [
      {
        id: 'a',
        sensorId: 'mobileair-012',
        sessionId: 1,
        contextType: 'fire',
        comments: '',
        datetimeStart: '2026-09-24T10:00:00Z',
        datetimeStop: '2026-09-24T10:00:00Z',
        photos: [],
        matchedPoint: point({ sessionId: 1 }),
        timeDeltaMs: 0,
      },
      {
        id: 'b',
        sensorId: 'mobileair-012',
        sessionId: 2,
        contextType: 'traffic',
        comments: '',
        datetimeStart: '2026-09-24T11:00:00Z',
        datetimeStop: '2026-09-24T11:00:00Z',
        photos: [],
        matchedPoint: point({ sessionId: 2 }),
        timeDeltaMs: 0,
      },
    ];
    expect(filterReportsForRoute(reports, r)).toHaveLength(1);
    expect(filterReportsForRoute(reports, r)[0].id).toBe('a');
  });
});
