import { describe, it, expect } from 'vitest';
import { resolveCampaignPeriod } from '../campaignPeriod';

const NOW = new Date('2026-11-19T10:00:00Z');

describe('resolveCampaignPeriod', () => {
  it('prend les dates de campagne quand elles sont renseignées', () => {
    // #87 « 25 - Campagne Quinquennale » (relevé du 2026-11-19)
    const p = resolveCampaignPeriod(
      {
        start_date: '2025-04-10T00:00:00+00:00',
        end_date: '2026-03-20T00:00:00+00:00',
        devices: [
          { id: 'a', start_date: '2025-04-11T00:00:00+00:00', end_date: '2026-03-19T00:00:00+00:00' },
        ],
      },
      NOW
    );
    expect(p.start?.toISOString()).toBe('2025-04-10T00:00:00.000Z');
    expect(p.startSource).toBe('campaign');
    expect(p.end.toISOString()).toBe('2026-03-20T00:00:00.000Z');
    expect(p.endSource).toBe('campaign');
    expect(p.earlierDeviceStart).toBeNull();
  });

  it('se rabat sur le capteur le plus ancien sans start_date, et sur maintenant si un capteur est ouvert', () => {
    // #53 « Capt'Air Citoyen » : ni début ni fin
    const p = resolveCampaignPeriod(
      {
        start_date: null,
        end_date: null,
        devices: [
          { id: 'a', start_date: '2025-01-01T00:00:00+00:00', end_date: null },
          { id: 'b', start_date: '2024-11-15T08:00:00+00:00', end_date: '2025-02-01T00:00:00+00:00' },
        ],
      },
      NOW
    );
    expect(p.start?.toISOString()).toBe('2024-11-15T08:00:00.000Z');
    expect(p.startSource).toBe('oldestDevice');
    expect(p.end).toEqual(NOW);
    expect(p.endSource).toBe('today');
  });

  it('prend la fin du dernier capteur quand tous sont clos et que la campagne n’a pas de fin', () => {
    const p = resolveCampaignPeriod(
      {
        start_date: '2023-01-01T00:00:00+00:00',
        end_date: null,
        devices: [
          { id: 'a', start_date: '2023-01-02T00:00:00+00:00', end_date: '2024-05-01T00:00:00+00:00' },
          { id: 'b', start_date: '2023-01-02T00:00:00+00:00', end_date: '2026-10-30T00:00:00+00:00' },
        ],
      },
      NOW
    );
    expect(p.end.toISOString()).toBe('2026-10-30T00:00:00.000Z');
    expect(p.endSource).toBe('lastDevice');
  });

  it('plafonne une fin prévisionnelle à maintenant', () => {
    // #132 « 26-27-CAPTEURS TOTEMS CASA » : fin au 2027-12-31
    const p = resolveCampaignPeriod(
      {
        start_date: '2026-04-01T00:00:00+00:00',
        end_date: '2027-12-31T00:00:00+00:00',
        devices: [{ id: 'a', start_date: '2026-04-01T00:00:00+00:00', end_date: null }],
      },
      NOW
    );
    expect(p.end).toEqual(NOW);
    expect(p.endSource).toBe('today');
  });

  it('garde la date de campagne mais signale des capteurs plus anciens (#48)', () => {
    const p = resolveCampaignPeriod(
      {
        start_date: '2026-09-15T00:00:00+00:00',
        end_date: null,
        devices: [
          { id: 'a', start_date: '2023-01-11T00:00:00+00:00', end_date: '2026-10-30T00:00:00+00:00' },
        ],
      },
      NOW
    );
    expect(p.start?.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(p.startSource).toBe('campaign');
    expect(p.earlierDeviceStart?.toISOString()).toBe('2023-01-11T00:00:00.000Z');
  });

  it('laisse le début vide quand rien n’est daté', () => {
    const p = resolveCampaignPeriod({ start_date: null, end_date: null, devices: [] }, NOW);
    expect(p.start).toBeNull();
    expect(p.startSource).toBe('none');
    expect(p.endSource).toBe('today');
  });
});
