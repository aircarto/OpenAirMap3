import { describe, expect, it } from 'vitest';
import {
  adjacentInstantBeyondSlots,
  addHoursToInstant,
  azurIndexToInstant,
  buildAdjacentSnapshotBufferWindow,
  buildChartRangeAroundInstant,
  buildMeasurementsTimeBarWindow,
  buildSlotFetchWindow,
  buildSnapshotBufferWindow,
  clampCustomRange,
  compareInstants,
  formatBlockRangeLabel,
  formatExpandConfirmLabel,
  getLookbackDaysForTimeStep,
  getPrefetchEdgeDirection,
  getSnapshotBufferSpanMinutes,
  isInstantInBuffer,
  isInstantInSlotRange,
  proposeExpandedRange,
  shouldPrefetchBuffer,
  snapshotBufferKey,
  buildTimeBarWindow,
  currentHourInstant,
  findSlotIndex,
  formatInstantHoverLabel,
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

  it('construit la fenêtre horaire sur 24 h jusqu’à la dernière heure pleine', () => {
    const window = buildMeasurementsTimeBarWindow('heure', now, false);
    expect(getLookbackDaysForTimeStep('heure')).toBe(1);
    expect(window.showForecastZone).toBe(false);
    expect(window.slots.length).toBe(24 + 1);
    const last = window.slots[window.liveIndex];
    expect(last).toMatchObject({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
      kind: 'live',
    });
    expect(window.slots[0]).toMatchObject({
      date: '2026-09-13',
      hour: 10,
      minute: 0,
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

  it('énumère des crans de 15 min sur 24 h', () => {
    const window = buildMeasurementsTimeBarWindow('quartHeure', now, false);
    expect(window.slots.length).toBe(24 * 4 + 1);
    expect(window.slots[window.liveIndex]).toMatchObject({
      date: '2026-09-14',
      hour: 11,
      minute: 15,
      kind: 'live',
    });
    expect(window.slots[0]).toMatchObject({
      date: '2026-09-13',
      hour: 11,
      minute: 15,
    });
  });

  it('énumère un cran par jour sur 7 jours', () => {
    const window = buildMeasurementsTimeBarWindow('jour', now, false);
    expect(window.slots.length).toBe(7 + 1);
    expect(window.slots[window.liveIndex]).toMatchObject({
      date: '2026-09-13',
      hour: 0,
      minute: 0,
      kind: 'live',
    });
    expect(window.slots[0]).toMatchObject({
      date: '2026-09-06',
      hour: 0,
      minute: 0,
    });
  });

  it('place un bloc ancien en lookback sans l’étirer jusqu’au live', () => {
    const focus = { date: '2024-03-15', hour: 12, minute: 0 };
    const window = buildMeasurementsTimeBarWindow('heure', now, true, focus);
    expect(window.liveIndex).toBe(-1);
    expect(window.showForecastZone).toBe(false);
    expect(window.slots.every((slot) => slot.kind === 'past')).toBe(true);
    expect(window.slots[window.slots.length - 1]).toMatchObject(focus);
    expect(window.slots[0]).toMatchObject({
      date: '2024-03-14',
      hour: 12,
      minute: 0,
    });
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

  it('formate le survol avec date locale (fr / en)', () => {
    const fr = formatInstantHoverLabel(
      { date: '2026-09-10', hour: 14, minute: 0 },
      'fr-FR',
      'heure',
      now
    );
    expect(fr.toLowerCase()).toMatch(/10/);
    expect(fr).toMatch(/14/);
    expect(fr).toContain('·');

    const en = formatInstantHoverLabel(
      { date: '2026-09-10', hour: 14, minute: 0 },
      'en-US',
      'heure',
      now
    );
    expect(en.toLowerCase()).toMatch(/sep/);
    expect(en).toMatch(/2|14/);
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

  it('charge 24 h / 7 j en lookback selon le pas de temps', () => {
    expect(getSnapshotBufferSpanMinutes('quartHeure')).toBe(24 * 60);
    expect(getSnapshotBufferSpanMinutes('heure')).toBe(24 * 60);
    expect(getSnapshotBufferSpanMinutes('jour')).toBe(7 * 24 * 60);

    const hourBuffer = buildSnapshotBufferWindow(
      { date: '2026-09-14', hour: 10, minute: 0 },
      'heure',
      now
    );
    expect(hourBuffer.endInstant).toEqual({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
    });
    expect(hourBuffer.startInstant).toEqual({
      date: '2026-09-13',
      hour: 10,
      minute: 0,
    });
    const hourSpanMs =
      new Date(hourBuffer.endDate).getTime() -
      new Date(hourBuffer.startDate).getTime();
    expect(hourSpanMs).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);

    const quarterBuffer = buildSnapshotBufferWindow(
      { date: '2026-09-14', hour: 11, minute: 15 },
      'quartHeure',
      now
    );
    expect(quarterBuffer.startInstant).toEqual({
      date: '2026-09-13',
      hour: 11,
      minute: 15,
    });

    const oldBuffer = buildSnapshotBufferWindow(
      { date: '2024-03-15', hour: 12, minute: 0 },
      'heure',
      now
    );
    expect(oldBuffer.endInstant).toEqual({
      date: '2024-03-15',
      hour: 12,
      minute: 0,
    });
    expect(oldBuffer.startInstant).toEqual({
      date: '2024-03-14',
      hour: 12,
      minute: 0,
    });
    expect(
      new Date(oldBuffer.endDate).getTime()
    ).toBeLessThan(instantToLocalDateSafe(lastCompletedHourInstant(now)));
    expect(formatBlockRangeLabel(oldBuffer.startInstant, oldBuffer.endInstant, 'fr-FR')).toMatch(
      /2024/
    );
    expect(TIME_BAR_GO_TO_MIN_DATE).toBe('1900-01-01');
  });

  it('détecte un hit dans le lookback et un miss hors plage', () => {
    const focus = { date: '2026-09-10', hour: 12, minute: 0 };
    const buffer = buildSnapshotBufferWindow(focus, 'heure', now);
    expect(
      isInstantInBuffer(
        { date: '2026-09-10', hour: 12, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(true);
    expect(
      isInstantInBuffer(
        { date: '2026-09-10', hour: 6, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(true);
    expect(
      isInstantInBuffer(
        { date: '2026-09-09', hour: 11, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(false);
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

  it('clamp une plage custom aux plafonds pas de temps et au live', () => {
    const live = lastCompletedSlotInstant('heure', now);
    const tooLong = clampCustomRange(
      {
        start: { date: '2026-08-01', hour: 0, minute: 0 },
        end: live,
      },
      'heure',
      now
    );
    expect(tooLong.end).toEqual(live);
    expect(tooLong.start).toEqual({
      date: '2026-08-31',
      hour: 10,
      minute: 0,
    });

    const qh = clampCustomRange(
      {
        start: { date: '2026-09-01', hour: 0, minute: 0 },
        end: lastCompletedSlotInstant('quartHeure', now),
      },
      'quartHeure',
      now
    );
    expect(qh.start.date).toBe('2026-09-09');

    const dayEnd = lastCompletedSlotInstant('jour', now);
    const sixMonths = clampCustomRange(
      {
        start: { date: '2025-01-01', hour: 0, minute: 0 },
        end: dayEnd,
      },
      'jour',
      now
    );
    expect(sixMonths.start).toEqual({
      date: '2026-03-13',
      hour: 0,
      minute: 0,
    });
  });

  it('propose une plage élargie pour couvrir une cible hors bornes', () => {
    const current = {
      start: { date: '2026-09-10', hour: 0, minute: 0 },
      end: { date: '2026-09-12', hour: 0, minute: 0 },
    };
    const expandedPast = proposeExpandedRange(
      current,
      { date: '2026-09-08', hour: 12, minute: 0 },
      'heure',
      now
    );
    // Cible > 24 h avant le début → début = cible.
    expect(expandedPast.start).toEqual({
      date: '2026-09-08',
      hour: 12,
      minute: 0,
    });
    expect(expandedPast.end).toEqual(current.end);

    const expandedPastChunk = proposeExpandedRange(
      current,
      { date: '2026-09-09', hour: 12, minute: 0 },
      'heure',
      now
    );
    // Cible dans le chunk −24 h → début = début − 24 h.
    expect(expandedPastChunk.start).toEqual({
      date: '2026-09-09',
      hour: 0,
      minute: 0,
    });

    const expandedFuture = proposeExpandedRange(
      current,
      { date: '2026-09-13', hour: 8, minute: 0 },
      'heure',
      now
    );
    // Cible au-delà du chunk +24 h → fin = cible.
    expect(expandedFuture.end).toEqual({
      date: '2026-09-13',
      hour: 8,
      minute: 0,
    });
  });

  it('en fin de période, propose +24 h (heure) / +7 j (jour) plutôt qu’un cran', () => {
    const current = clampCustomRange(
      {
        start: { date: '2026-08-27', hour: 0, minute: 0 },
        end: { date: '2026-08-28', hour: 23, minute: 45 },
      },
      'heure',
      now
    );
    const target = { date: '2026-08-29', hour: 0, minute: 0 };
    const expanded = proposeExpandedRange(current, target, 'heure', now);
    expect(expanded.end).toEqual({
      date: '2026-08-29',
      hour: 23,
      minute: 0,
    });
    expect(compareInstants(target, expanded.end) <= 0).toBe(true);

    const dayCurrent = clampCustomRange(
      {
        start: { date: '2026-08-20', hour: 0, minute: 0 },
        end: { date: '2026-08-25', hour: 0, minute: 0 },
      },
      'jour',
      now
    );
    const dayTarget = { date: '2026-08-26', hour: 0, minute: 0 };
    const dayExpanded = proposeExpandedRange(
      dayCurrent,
      dayTarget,
      'jour',
      now
    );
    expect(dayExpanded.end).toEqual({
      date: '2026-09-01',
      hour: 0,
      minute: 0,
    });

    const label = formatExpandConfirmLabel(
      expanded,
      target,
      'fr-FR',
      'heure',
      now
    );
    expect(label).toMatch(/29/);
  });

  it('énumère toute une plage custom sans zone forecast', () => {
    const window = buildTimeBarWindow({
      kind: 'azur',
      timeStep: 'heure',
      now,
      customRange: {
        start: { date: '2026-09-12', hour: 10, minute: 0 },
        end: { date: '2026-09-14', hour: 10, minute: 0 },
      },
    });
    expect(window.showForecastZone).toBe(false);
    expect(window.slots[0]).toMatchObject({
      date: '2026-09-12',
      hour: 10,
      minute: 0,
    });
    expect(window.slots[window.slots.length - 1]).toMatchObject({
      date: '2026-09-14',
      hour: 10,
      minute: 0,
      kind: 'live',
    });
    expect(window.slots.every((slot) => slot.kind !== 'forecast')).toBe(true);
  });

  it('charge toute la plage custom dans le buffer snapshot (pas seulement 24 h)', () => {
    const range = {
      start: { date: '2026-09-10', hour: 0, minute: 0 },
      end: { date: '2026-09-12', hour: 12, minute: 0 },
    };
    const buffer = buildSnapshotBufferWindow(
      { date: '2026-09-10', hour: 0, minute: 0 },
      'heure',
      now,
      range
    );
    expect(buffer.startInstant).toEqual(range.start);
    expect(buffer.endInstant).toEqual(range.end);
    expect(
      isInstantInBuffer(
        { date: '2026-09-11', hour: 18, minute: 0 },
        buffer,
        'heure'
      )
    ).toBe(true);
  });

  it('calcule une fenêtre cache adjacente dans les deux sens', () => {
    const buffer = buildSnapshotBufferWindow(
      { date: '2026-09-10', hour: 12, minute: 0 },
      'heure',
      now
    );
    expect(getPrefetchEdgeDirection(buffer.startInstant, buffer, 'heure')).toBe(
      'past'
    );
    expect(getPrefetchEdgeDirection(buffer.endInstant, buffer, 'heure')).toBe(
      'future'
    );
    const pastAdj = buildAdjacentSnapshotBufferWindow(
      buffer,
      'past',
      'heure',
      now
    );
    expect(compareInstants(pastAdj.endInstant, buffer.startInstant)).toBeLessThan(
      0
    );
    const futureAdj = buildAdjacentSnapshotBufferWindow(
      buffer,
      'future',
      'heure',
      now
    );
    expect(
      compareInstants(futureAdj.endInstant, buffer.endInstant)
    ).toBeGreaterThan(0);
    expect(futureAdj.startInstant).toEqual(buffer.endInstant);
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
