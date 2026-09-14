import { describe, it, expect } from 'vitest';
import {
  getModelingDisplayedPeriod,
  getModelingHourCalendarSlot,
} from '../modelingPeriodUtils';

describe('modelingPeriodUtils', () => {
  // Mercredi 2 sept. 2026 14:30 heure de Paris (CEST = UTC+2)
  const now = new Date(2026, 8, 2, 14, 30, 0, 0);

  it('mappe h24 sur l’heure en cours', () => {
    const slot = getModelingHourCalendarSlot(24, now);
    expect(slot.date).toBe('2026-09-02');
    expect(slot.hour).toBe(14);
  });

  it('mappe h23 sur l’heure précédente', () => {
    const slot = getModelingHourCalendarSlot(23, now);
    expect(slot.date).toBe('2026-09-02');
    expect(slot.hour).toBe(13);
  });

  it('mappe h25 sur l’heure suivante', () => {
    const slot = getModelingHourCalendarSlot(25, now);
    expect(slot.date).toBe('2026-09-02');
    expect(slot.hour).toBe(15);
  });

  it('gère le passage de minuit (h0 loin dans le passé)', () => {
    const slot = getModelingHourCalendarSlot(0, now);
    // 14h - 24h = veille 14h
    expect(slot.date).toBe('2026-09-01');
    expect(slot.hour).toBe(14);
  });

  it('formate la période affichée', () => {
    const label = getModelingDisplayedPeriod(23, 'fr-FR', now);
    expect(label).toMatch(/13/);
    expect(label).toMatch(/14/);
  });
});
