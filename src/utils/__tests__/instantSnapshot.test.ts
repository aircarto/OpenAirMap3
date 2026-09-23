import { describe, expect, it } from 'vitest';
import {
  devicesForSlotWindow,
  pickClosestTemporalPoint,
} from '../instantSnapshot';
import type { TemporalDataPoint } from '../../types';

const point = (
  iso: string,
  value: number,
  source = 'atmoRef',
  id = iso
): TemporalDataPoint => ({
  timestamp: iso,
  devices: [
    {
      id,
      name: iso,
      source,
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

describe('devicesForSlotWindow', () => {
  const startMs = new Date('2026-09-10T11:00:00.000Z').getTime();
  const endMs = new Date('2026-09-10T11:59:59.999Z').getTime();
  const targetMs = new Date('2026-09-10T11:30:00.000Z').getTime();

  it('fusionne AtmoRef (début d’heure) et NebuleAir (milieu) dans le même créneau', () => {
    const series = [
      point('2026-09-10T11:00:00.000Z', 10, 'atmoRef', 'ref-1'),
      point('2026-09-10T11:30:00.000Z', 20, 'communautaire.nebuleair', 'neb-1'),
      point('2026-09-10T12:00:00.000Z', 30, 'atmoRef', 'ref-2'),
    ];
    const devices = devicesForSlotWindow(series, startMs, endMs, targetMs);
    expect(devices.map((d) => d.id).sort()).toEqual(['neb-1', 'ref-1']);
  });

  it('déduplique par id si le même device apparaît plusieurs fois', () => {
    const series = [
      point('2026-09-10T11:00:00.000Z', 10, 'atmoRef', 'same'),
      point('2026-09-10T11:15:00.000Z', 12, 'atmoRef', 'same'),
    ];
    const devices = devicesForSlotWindow(series, startMs, endMs, targetMs);
    expect(devices).toHaveLength(1);
    expect(devices[0].value).toBe(12);
  });

  it('fallback sur le point le plus proche si aucun dans la fenêtre', () => {
    const series = [
      point('2026-09-10T10:00:00.000Z', 10, 'atmoRef', 'ref-early'),
      point('2026-09-10T12:00:00.000Z', 30, 'atmoRef', 'ref-late'),
    ];
    const devices = devicesForSlotWindow(series, startMs, endMs, targetMs);
    expect(devices).toHaveLength(1);
    // 12:00 est plus proche de 11:30 que 10:00
    expect(devices[0].id).toBe('ref-late');
  });

  it('renvoie [] si la série est vide', () => {
    expect(devicesForSlotWindow([], startMs, endMs, targetMs)).toEqual([]);
  });
});
