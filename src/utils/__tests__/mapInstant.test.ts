import { describe, expect, it } from 'vitest';
import {
  adjacentInstantBeyondSlots,
  addHoursToInstant,
  azurIndexToInstant,
  buildChartRangeAroundInstant,
  buildMeasurementsTimeBarWindow,
  buildSlotFetchWindow,
  buildSnapshotBufferWindow,
  formatBlockRangeLabel,
  getLookbackDaysForTimeStep,
  getSnapshotBufferSpanMinutes,
  isInstantInBuffer,
  isInstantInSlotRange,
  shouldPrefetchBuffer,
  snapshotBufferKey,
  buildTimeBarWindow,
  currentHourInstant,
  findSlotIndex,
  formatInstantPeriod,
  getSlotBadge,
  instantToAzurIndex,
  instantToIsoLocal,
  isSameInstant,
  lastCompletedHourInstant,
  lastCompletedSlotInstant,
  normalizeInstant,
  TIME_BAR_GO_TO_MIN_DATE,
  toMapInstant,
} from '../mapInstant';

describe('mapInstant', () => {
  const now = new Date(2026, 8, 14, 11, 40, 0, 0);

  it('fait l’aller-retour index Azur ↔ instant local', () => {
    const live = currentHourInstant(now);
    expect(live).toEqual({ date: '2026-09-14', hour: 11, minute: 0 });

    expect(azurIndexToInstant(24, now)).toEqual(live);
    expect(azurIndexToInstant(23, now)).toEqual({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
    });
    expect(
      instantToAzurIndex({ date: '2026-09-14', hour: 10, minute: 0 }, now)
    ).toBe(23);
    expect(
      instantToAzurIndex({ date: '2026-09-13', hour: 11, minute: 0 }, now)
    ).toBe(0);
    expect(
      instantToAzurIndex({ date: '2026-09-15', hour: 10, minute: 0 }, now)
    ).toBe(47);
    expect(
      instantToAzurIndex({ date: '2026-09-15', hour: 11, minute: 0 }, now)
    ).toBeNull();
  });

  it('renvoie null hors fenêtre Azur 48 h', () => {
    expect(
      instantToAzurIndex({ date: '2026-09-01', hour: 0, minute: 0 }, now)
    ).toBeNull();
    expect(
      instantToAzurIndex({ date: '2026-10-01', hour: 0, minute: 0 }, now)
    ).toBeNull();
  });

  it('mappe un créneau 15 min vers l’heure Azur correspondante', () => {
    expect(
      instantToAzurIndex({ date: '2026-09-14', hour: 10, minute: 45 }, now)
    ).toBe(23);
  });

  it('calcule le dernier créneau clos selon le pas de temps', () => {
    expect(lastCompletedHourInstant(now)).toEqual({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
    });
    expect(lastCompletedSlotInstant('heure', now)).toEqual({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
    });
    expect(lastCompletedSlotInstant('quartHeure', now)).toEqual({
      date: '2026-09-14',
      hour: 11,
      minute: 15,
    });
    expect(lastCompletedSlotInstant('jour', now)).toEqual({
      date: '2026-09-13',
      hour: 0,
      minute: 0,
    });
  });

  it('normalise un instant selon le pas de temps', () => {
    expect(
      normalizeInstant({ date: '2026-09-14', hour: 11, minute: 40 }, 'heure')
    ).toEqual({ date: '2026-09-14', hour: 11, minute: 0 });
    expect(
      normalizeInstant({ date: '2026-09-14', hour: 11, minute: 40 }, 'quartHeure')
    ).toEqual({ date: '2026-09-14', hour: 11, minute: 30 });
    expect(
      normalizeInstant({ date: '2026-09-14', hour: 11, minute: 40 }, 'jour')
    ).toEqual({ date: '2026-09-14', hour: 0, minute: 0 });
  });

  it('construit la fenêtre horaire sur 30 jours jusqu’à la dernière heure pleine', () => {
    const window = buildMeasurementsTimeBarWindow('heure', now, false);
    expect(getLookbackDaysForTimeStep('heure')).toBe(30);
    expect(window.showForecastZone).toBe(false);
    expect(window.slots.length).toBe(30 * 24 + 1);
    const last = window.slots[window.liveIndex];
    expect(last).toMatchObject({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
      kind: 'live',
    });
    expect(window.slots.every((slot) => slot.kind !== 'forecast')).toBe(true);
  });

  it('ajoute 24 h de prévision Azur après le live au pas horaire', () => {
    const window = buildTimeBarWindow({
      kind: 'azur',
      timeStep: 'heure',
      now,
    });
    expect(window.showForecastZone).toBe(true);
    const live = window.slots[window.liveIndex];
    expect(live.kind).toBe('live');
    expect(window.slots[window.liveIndex + 1]?.kind).toBe('forecast');
    const last = window.slots[window.slots.length - 1];
    expect(last).toMatchObject({ date: '2026-09-15', hour: 10, minute: 0 });
    expect(last.kind).toBe('forecast');
  });

  it('énumère des crans de 15 min sur 7 jours', () => {
    const window = buildMeasurementsTimeBarWindow('quartHeure', now, false);
    expect(window.slots.length).toBe(7 * 24 * 4 + 1);
    expect(window.slots[window.liveIndex]).toMatchObject({
      date: '2026-09-14',
      hour: 11,
      minute: 15,
      kind: 'live',
    });
    expect(window.slots[0].minute).toBe(15);
  });

  it('énumère un cran par jour sur 365 jours', () => {
    const window = buildMeasurementsTimeBarWindow('jour', now, false);
    expect(window.slots.length).toBeGreaterThanOrEqual(365);
    expect(window.slots.length).toBeLessThanOrEqual(367);
    expect(window.slots[window.liveIndex]).toMatchObject({
      date: '2026-09-13',
      hour: 0,
      minute: 0,
      kind: 'live',
    });
  });

  it('centre un bloc ancien sans l’étirer jusqu’au live', () => {
    const focus = { date: '2024-03-15', hour: 12, minute: 0 };
    const window = buildMeasurementsTimeBarWindow('heure', now, true, focus);
    expect(window.liveIndex).toBe(-1);
    expect(window.showForecastZone).toBe(false);
    expect(window.slots.every((slot) => slot.kind === 'past')).toBe(true);
    expect(window.slots[window.slots.length - 1].date.startsWith('2024')).toBe(
      true
    );
    expect(
      isInstantInSlotRange(focus, window.slots, 'heure')
    ).toBe(true);
    const next = adjacentInstantBeyondSlots(
      window.slots,
      'future',
      'heure',
      now,
      false
    );
    expect(next).not.toBeNull();
    expect(isInstantInSlotRange(next!, window.slots, 'heure')).toBe(false);
  });

  it('garde Now et la prévision Azur quand le bloc contient le live', () => {
    const window = buildTimeBarWindow({
      kind: 'azur',
      timeStep: 'heure',
      now,
      focus: { date: '2026-09-14', hour: 10, minute: 0 },
    });
    expect(window.liveIndex).toBeGreaterThanOrEqual(0);
    expect(window.showForecastZone).toBe(true);
    expect(window.slots[window.liveIndex].kind).toBe('live');
  });

  it('refuse un cran au-delà de l’horizon live sans prévision', () => {
    const window = buildMeasurementsTimeBarWindow('heure', now, false);
    expect(
      adjacentInstantBeyondSlots(window.slots, 'future', 'heure', now, false)
    ).toBeNull();
  });

  it('trouve le cran le plus proche', () => {
    const window = buildMeasurementsTimeBarWindow('heure', now, false);
    const index = findSlotIndex(window.slots, {
      date: '2026-09-14',
      hour: 10,
      minute: 0,
    });
    expect(isSameInstant(window.slots[index], window.slots[window.liveIndex])).toBe(
      true
    );
  });

  it('formate la période selon le pas de temps', () => {
    const hourLabel = formatInstantPeriod(
      { date: '2026-09-14', hour: 10, minute: 0 },
      'fr-FR',
      'heure',
      now
    );
    expect(hourLabel).toMatch(/10/);
    const dayLabel = formatInstantPeriod(
      { date: '2026-09-01', hour: 0, minute: 0 },
      'fr-FR',
      'jour',
      now
    );
    expect(dayLabel.toLowerCase()).toMatch(/1/);
  });

  it('expose un ISO local et une fenêtre de fetch d’un cran', () => {
    expect(
      instantToIsoLocal({ date: '2026-09-14', hour: 10, minute: 15 })
    ).toBe('2026-09-14T10:15:00');
    const slot = buildSlotFetchWindow(
      { date: '2026-09-14', hour: 10, minute: 0 },
      'heure'
    );
    expect(slot.startDate).toContain('2026-09-14');
    expect(slot.targetMs).toBeGreaterThan(0);
  });

  it('borne la fenêtre graphique au plafond TimeBar', () => {
    const range = buildChartRangeAroundInstant(
      { date: '2026-09-14', hour: 10, minute: 0 },
      'heure',
      now
    );
    expect(new Date(range.endDate).getTime()).toBeLessThanOrEqual(
      instantToLocalDateSafe(lastCompletedHourInstant(now))
    );
  });

  it('charge 7 j / 30 j / 365 j selon le pas de temps, sans plafond depuis aujourd’hui', () => {
    expect(getSnapshotBufferSpanMinutes('quartHeure')).toBe(7 * 24 * 60);
    expect(getSnapshotBufferSpanMinutes('heure')).toBe(30 * 24 * 60);
    expect(getSnapshotBufferSpanMinutes('jour')).toBe(365 * 24 * 60);

    const hourBuffer = buildSnapshotBufferWindow(
      { date: '2026-09-14', hour: 10, minute: 0 },
      'heure',
      now
    );
    const hourSpanMs =
      new Date(hourBuffer.endDate).getTime() -
      new Date(hourBuffer.startDate).getTime();
    expect(hourSpanMs).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000);

    const quarterBuffer = buildSnapshotBufferWindow(
      { date: '2026-09-14', hour: 11, minute: 15 },
      'quartHeure',
      now
    );
    const quarterSpanMs =
      new Date(quarterBuffer.endDate).getTime() -
      new Date(quarterBuffer.startDate).getTime();
    expect(quarterSpanMs).toBeGreaterThanOrEqual(6 * 24 * 60 * 60 * 1000);

    const oldBuffer = buildSnapshotBufferWindow(
      { date: '2024-03-15', hour: 12, minute: 0 },
      'heure',
      now
    );
    expect(oldBuffer.endInstant.date.startsWith('2024')).toBe(true);
    expect(
      new Date(oldBuffer.endDate).getTime()
    ).toBeLessThan(instantToLocalDateSafe(lastCompletedHourInstant(now)));
    expect(formatBlockRangeLabel(oldBuffer.startInstant, oldBuffer.endInstant, 'fr-FR')).toMatch(
      /2024/
    );
    expect(TIME_BAR_GO_TO_MIN_DATE).toBe('1900-01-01');
  });

  it('détecte un hit au milieu du buffer et un miss hors plage', () => {
    const center = { date: '2026-09-10', hour: 12, minute: 0 };
    const buffer = buildSnapshotBufferWindow(center, 'heure', now);
    expect(
      isInstantInBuffer(
        { date: '2026-09-10', hour: 12, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(true);
    expect(
      isInstantInBuffer(
        { date: '2026-09-10', hour: 18, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(true);
    expect(
      isInstantInBuffer(
        { date: '2026-08-01', hour: 0, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(false);
  });

  it('demande un prefetch dans les 25 % d’un bord', () => {
    const buffer = {
      startInstant: { date: '2026-09-10', hour: 0, minute: 0 },
      endInstant: { date: '2026-09-11', hour: 0, minute: 0 },
    };
    expect(
      shouldPrefetchBuffer(
        { date: '2026-09-10', hour: 12, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(false);
    expect(shouldPrefetchBuffer(buffer.startInstant, buffer, 'heure')).toBe(
      true
    );
    expect(shouldPrefetchBuffer(buffer.endInstant, buffer, 'heure')).toBe(true);
  });

  it('forme une clé de fenêtre stable', () => {
    const buffer = buildSnapshotBufferWindow(
      { date: '2026-09-10', hour: 12, minute: 0 },
      'heure',
      now
    );
    const key = snapshotBufferKey(buffer, 'pm25', 'heure', 'atmoRef');
    expect(key).toContain('pm25');
    expect(key).toContain(buffer.startDate);
  });

  it('distingue le badge live / passé / prévision', () => {
    expect(getSlotBadge('live', { date: '2026-09-01', hour: 0, minute: 0, kind: 'past' })).toBe(
      'live'
    );
    expect(
      getSlotBadge('exploration', {
        date: '2026-09-15',
        hour: 12,
        minute: 0,
        kind: 'forecast',
      })
    ).toBe('forecast');
  });

  it('toMapInstant respecte le pas de temps', () => {
    const date = new Date(2026, 8, 14, 11, 40, 0, 0);
    expect(toMapInstant(date, 'quartHeure').minute).toBe(30);
    expect(addHoursToInstant(toMapInstant(date, 'heure'), -1).hour).toBe(10);
  });
});

const instantToLocalDateSafe = (instant: {
  date: string;
  hour: number;
  minute: number;
}): number => {
  const [y, m, d] = instant.date.split('-').map(Number);
  return new Date(y, m - 1, d, instant.hour, instant.minute, 0, 0).getTime() +
    60 * 60 * 1000;
};
