import { describe, it, expect } from 'vitest';
import type { MeasurementDevice, TemporalDataPoint } from '../../types';
import {
  buildAirCrowdWmsHourWindow,
  filterDevicesByAtmoMicroWhitelist,
  getAirCrowdWmsDisplayedPeriod,
  mergeTemporalDataPoints,
  pickClosestTemporalPoint,
  resolveAirCrowdWmsTemporalSources,
} from '../airCrowdWmsMeasurements';

const device = (
  overrides: Partial<MeasurementDevice> & Pick<MeasurementDevice, 'id' | 'source'>
): MeasurementDevice => ({
  name: overrides.id,
  latitude: 43.5,
  longitude: 5.5,
  pollutant: 'pm25',
  value: 10,
  unit: 'µg/m³',
  timestamp: '2026-09-02T11:00:00.000Z',
  status: 'active',
  qualityLevel: 'bon',
  ...overrides,
});

const point = (
  timestamp: string,
  devices: MeasurementDevice[]
): TemporalDataPoint => ({
  timestamp,
  devices,
  deviceCount: devices.length,
  averageValue: devices.reduce((s, d) => s + d.value, 0) / (devices.length || 1),
  qualityLevels: {},
});

describe('airCrowdWmsMeasurements', () => {
  describe('buildAirCrowdWmsHourWindow', () => {
    it('construit une fenêtre d’une heure locale en ISO', () => {
      const { startDate, endDate, targetMs } = buildAirCrowdWmsHourWindow(
        '2026-09-02',
        11
      );
      const start = new Date(startDate);
      const end = new Date(endDate);
      expect(end.getTime() - start.getTime()).toBeGreaterThan(50 * 60 * 1000);
      expect(end.getTime() - start.getTime()).toBeLessThan(61 * 60 * 1000);

      const expectedTarget = new Date(2026, 8, 2, 11, 30, 0, 0).getTime();
      expect(targetMs).toBe(expectedTarget);
    });

    it('clamp l’heure entre 0 et 23', () => {
      expect(buildAirCrowdWmsHourWindow('2026-09-02', -3).targetMs).toBe(
        new Date(2026, 8, 2, 0, 30, 0, 0).getTime()
      );
      expect(buildAirCrowdWmsHourWindow('2026-09-02', 99).targetMs).toBe(
        new Date(2026, 8, 2, 23, 30, 0, 0).getTime()
      );
    });
  });

  describe('pickClosestTemporalPoint', () => {
    it('retourne null si aucun point', () => {
      expect(pickClosestTemporalPoint([], Date.now())).toBeNull();
    });

    it('choisit le timestamp le plus proche de la cible', () => {
      const target = new Date(2026, 8, 2, 11, 30).getTime();
      const points = [
        point(new Date(2026, 8, 2, 10, 0).toISOString(), [
          device({ id: 'a', source: 'atmoMicro' }),
        ]),
        point(new Date(2026, 8, 2, 11, 0).toISOString(), [
          device({ id: 'b', source: 'atmoMicro' }),
        ]),
        point(new Date(2026, 8, 2, 14, 0).toISOString(), [
          device({ id: 'c', source: 'atmoMicro' }),
        ]),
      ];
      const closest = pickClosestTemporalPoint(points, target);
      expect(closest?.devices[0].id).toBe('b');
    });
  });

  describe('mergeTemporalDataPoints', () => {
    it('fusionne les sources proches et ignore les valeurs invalides', () => {
      const t1 = new Date(2026, 8, 2, 11, 0).toISOString();
      const t2 = new Date(2026, 8, 2, 11, 2).toISOString();
      const merged = mergeTemporalDataPoints([
        [
          point(t1, [
            device({ id: 'micro', source: 'atmoMicro', value: 12 }),
            device({ id: 'bad', source: 'atmoMicro', value: Number.NaN }),
          ]),
        ],
        [point(t2, [device({ id: 'ref', source: 'atmoRef', value: 8 })])],
      ]);

      expect(merged).toHaveLength(1);
      expect(merged[0].devices.map((d) => d.id).sort()).toEqual([
        'micro',
        'ref',
      ]);
      expect(merged[0].deviceCount).toBe(2);
    });
  });

  describe('filterDevicesByAtmoMicroWhitelist', () => {
    it('ne filtre pas sans whitelist', () => {
      const devices = [device({ id: '05C1A382', source: 'atmoMicro' })];
      expect(filterDevicesByAtmoMicroWhitelist(devices)).toEqual(devices);
    });

    it('filtre AtmoMicro en case-insensitive et laisse les autres sources', () => {
      const devices = [
        device({ id: '05c1a382', source: 'atmoMicro' }),
        device({ id: 'other', source: 'atmoMicro' }),
        device({ id: 'station', source: 'atmoRef' }),
      ];
      const filtered = filterDevicesByAtmoMicroWhitelist(devices, [
        '05C1A382',
      ]);
      expect(filtered.map((d) => d.id)).toEqual(['05c1a382', 'station']);
    });
  });

  describe('resolveAirCrowdWmsTemporalSources', () => {
    it('ne garde que les sources historiques supportées', () => {
      expect(
        resolveAirCrowdWmsTemporalSources([
          'atmoMicro',
          'sensorCommunity',
          'atmoRef',
        ])
      ).toEqual(['atmoMicro', 'atmoRef']);
    });
  });

  describe('getAirCrowdWmsDisplayedPeriod', () => {
    it('formate date + plage horaire', () => {
      const label = getAirCrowdWmsDisplayedPeriod('2026-09-02', 11, 'fr-FR');
      expect(label).toMatch(/02/);
      expect(label).toMatch(/11/);
      expect(label).toMatch(/12/);
    });
  });
});
