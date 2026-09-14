import { describe, it, expect } from 'vitest';
import {
  addHoursToInstant,
  azurIndexToInstant,
  buildAirCrowdTimeBarWindow,
  buildAzurTimeBarWindow,
  buildMeasurementsTimeBarWindow,
  clampInstant,
  currentHourInstant,
  findSlotIndex,
  formatInstantPeriod,
  getSlotBadge,
  instantToAzurIndex,
  isSameInstant,
  lastCompletedHourInstant,
} from '../mapInstant';

describe('mapInstant', () => {
  const now = new Date(2026, 8, 14, 11, 40, 0, 0);

  it('fait l’aller-retour index Azur ↔ instant local', () => {
    const live = currentHourInstant(now);
    expect(live).toEqual({ date: '2026-09-14', hour: 11 });

    expect(azurIndexToInstant(24, now)).toEqual(live);
    expect(azurIndexToInstant(23, now)).toEqual({
      date: '2026-09-14',
      hour: 10,
    });
    expect(instantToAzurIndex({ date: '2026-09-14', hour: 10 }, now)).toBe(23);
    expect(instantToAzurIndex({ date: '2026-09-13', hour: 11 }, now)).toBe(0);
    expect(instantToAzurIndex({ date: '2026-09-15', hour: 10 }, now)).toBe(47);
    expect(instantToAzurIndex({ date: '2026-09-15', hour: 11 }, now)).toBeNull();
  });

  it('renvoie null hors fenêtre Azur 48 h', () => {
    expect(instantToAzurIndex({ date: '2026-09-01', hour: 0 }, now)).toBeNull();
    expect(instantToAzurIndex({ date: '2026-10-01', hour: 0 }, now)).toBeNull();
  });

  it('construit 48 créneaux Azur avec prévision à droite de h24', () => {
    const window = buildAzurTimeBarWindow(now);
    expect(window.slots).toHaveLength(48);
    expect(window.liveIndex).toBe(24);
    expect(window.showForecastZone).toBe(true);
    expect(window.slots[23].kind).toBe('past');
    expect(window.slots[24].kind).toBe('live');
    expect(window.slots[25].kind).toBe('forecast');
    expect(window.slots[0]).toMatchObject({ date: '2026-09-13', hour: 11 });
  });

  it('borne AirCrowd à la dernière heure pleine (pas de prévision)', () => {
    const window = buildAirCrowdTimeBarWindow(
      '2026-09-13',
      '2026-09-20',
      now
    );
    expect(window.showForecastZone).toBe(false);
    const last = window.slots[window.slots.length - 1];
    expect(last).toMatchObject({ date: '2026-09-14', hour: 10 });
    expect(window.slots.every((slot) => slot.kind !== 'forecast')).toBe(true);
  });

  it('n’émet que les heures publiées AirCrowd', () => {
    const window = buildAirCrowdTimeBarWindow('2026-09-14', '2026-09-14', now, {
      '2026-09-14': [8, 9, 10, 11],
    });
    expect(window.slots.map((s) => s.hour)).toEqual([8, 9, 10]);
  });

  it('recentre la fenêtre mesures sur un jour ancien', () => {
    const liveWindow = buildMeasurementsTimeBarWindow(now, null);
    expect(liveWindow.slots).toHaveLength(25);
    expect(liveWindow.liveIndex).toBe(24);
    expect(liveWindow.slots[liveWindow.liveIndex]).toMatchObject({
      date: '2026-09-14',
      hour: 10,
    });

    const old = buildMeasurementsTimeBarWindow(now, {
      date: '2026-09-01',
      hour: 6,
    });
    expect(old.slots[0]).toMatchObject({ date: '2026-09-01', hour: 0 });
    expect(old.slots[old.slots.length - 1]).toMatchObject({
      date: '2026-09-01',
      hour: 23,
    });
    expect(old.liveIndex).toBe(-1);
  });

  it('clamp un instant entre deux bornes', () => {
    const min = { date: '2026-09-13', hour: 11 };
    const max = { date: '2026-09-14', hour: 11 };
    expect(
      clampInstant({ date: '2026-09-10', hour: 0 }, min, max)
    ).toEqual(min);
    expect(
      clampInstant({ date: '2026-09-20', hour: 0 }, min, max)
    ).toEqual(max);
  });

  it('trouve le créneau le plus proche', () => {
    const window = buildAzurTimeBarWindow(now);
    const index = findSlotIndex(window.slots, { date: '2026-09-14', hour: 10 });
    expect(window.slots[index]).toMatchObject({ hour: 10 });
  });

  it('badge Live / Passé / Prévision', () => {
    const window = buildAzurTimeBarWindow(now);
    expect(getSlotBadge('live', window.slots[10])).toBe('live');
    expect(getSlotBadge('exploration', window.slots[10])).toBe('past');
    expect(getSlotBadge('exploration', window.slots[25])).toBe('forecast');
    expect(getSlotBadge('exploration', window.slots[24])).toBe('forecast');
  });

  it('ajoute des heures en traversant minuit', () => {
    const next = addHoursToInstant({ date: '2026-09-14', hour: 23 }, 2);
    expect(next).toEqual({ date: '2026-09-15', hour: 1 });
    expect(
      isSameInstant(next, { date: '2026-09-15', hour: 1 })
    ).toBe(true);
  });

  it('place le live mesures/AirCrowd sur l’heure déjà close', () => {
    const at1216 = new Date(2026, 8, 14, 12, 16, 0, 0);
    expect(currentHourInstant(at1216)).toEqual({
      date: '2026-09-14',
      hour: 12,
    });
    expect(lastCompletedHourInstant(at1216)).toEqual({
      date: '2026-09-14',
      hour: 11,
    });

    const midnight = new Date(2026, 8, 14, 0, 16, 0, 0);
    expect(lastCompletedHourInstant(midnight)).toEqual({
      date: '2026-09-13',
      hour: 23,
    });

    const label = formatInstantPeriod(
      lastCompletedHourInstant(at1216),
      'fr-FR',
      at1216
    );
    expect(label).toMatch(/11/);
    expect(label).toMatch(/12/);
    expect(label).not.toMatch(/13/);
  });
});
