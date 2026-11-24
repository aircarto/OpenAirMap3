import { describe, it, expect, vi } from 'vitest';
import {
  buildExtractionTargets,
  planChunks,
  runExtraction,
  splitChunk,
  windowDaysFor,
  type ExtractionChunk,
  type ExtractionRequest,
} from '../campaignExtraction';
import { MicrospotAuthError, MicrospotHttpError } from '../MicrospotCampaignClient';
import type { MicrospotObservation } from '../../../types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const baseRequest = (overrides: Partial<ExtractionRequest> = {}): ExtractionRequest => ({
  campaignId: 48,
  variables: ['39', '24', '68'],
  from: new Date('2025-01-01T00:00:00Z'),
  to: new Date('2026-01-01T00:00:00Z'),
  targets: [{ deviceId: 'dev1', intervals: [{ start: null, end: null }] }],
  ...overrides,
});

/** Lignes horaires pour une tranche donnée (une variable). */
const rowsFor = (deviceId: string, from: Date, to: Date): MicrospotObservation[] => {
  const rows: MicrospotObservation[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += HOUR) {
    rows.push({
      id: deviceId,
      name: deviceId,
      location_id: 'L1',
      location_name: 'Site 1',
      variable_iso_code: '39',
      variable_name: 'PM 2.5',
      time: new Date(t).toISOString(),
      lat: 43.3,
      lon: 5.4,
      value: null,
      value_ref: 10,
      unit: 'µg/m3',
    });
  }
  return rows;
};

describe('planChunks', () => {
  it('dimensionne la fenêtre selon le nombre de variables', () => {
    expect(windowDaysFor(3)).toBe(208);
    expect(windowDaysFor(1)).toBe(625);
    expect(windowDaysFor(6)).toBe(104);
  });

  it('découpe la période d’un capteur en tranches contiguës qui couvrent tout', () => {
    const chunks = planChunks(baseRequest());
    expect(chunks.length).toBe(2); // 365 j / 208 j
    expect(chunks[0]!.from.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(chunks[0]!.to.getTime()).toBe(chunks[1]!.from.getTime());
    expect(chunks.at(-1)!.to.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('restreint chaque capteur à sa présence sur la campagne et saute les capteurs hors période', () => {
    const chunks = planChunks(
      baseRequest({
        targets: [
          { deviceId: 'in', intervals: [{ start: '2025-06-01T10:30:00+00:00', end: '2025-07-01T00:00:00+00:00' }] },
          { deviceId: 'out', intervals: [{ start: '2024-01-01T00:00:00+00:00', end: '2024-06-01T00:00:00+00:00' }] },
        ],
      })
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.deviceId).toBe('in');
    // Aligné sur l'heure pleine
    expect(chunks[0]!.from.toISOString()).toBe('2025-06-01T10:00:00.000Z');
    expect(chunks[0]!.to.toISOString()).toBe('2025-07-01T00:00:00.000Z');
  });
});

describe('planChunks : périodes multiples', () => {
  it('fusionne les présences contiguës et garde le bucket horaire d’une déclaration de quelques minutes', () => {
    const chunks = planChunks(
      baseRequest({
        targets: [
          {
            deviceId: 'cit',
            intervals: [
              { start: '2025-03-01T00:00:00+00:00', end: '2025-03-02T10:20:00+00:00' },
              // déclaration de 47 s, juste après
              { start: '2025-03-02T10:20:00+00:00', end: '2025-03-02T10:20:47+00:00' },
              // plus tard, disjointe
              { start: '2025-05-01T00:00:00+00:00', end: '2025-05-02T00:00:00+00:00' },
            ],
          },
        ],
      })
    );
    expect(chunks.map((c) => [c.from.toISOString(), c.to.toISOString()])).toEqual([
      ['2025-03-01T00:00:00.000Z', '2025-03-02T11:00:00.000Z'],
      ['2025-05-01T00:00:00.000Z', '2025-05-02T00:00:00.000Z'],
    ]);
  });
});

describe('buildExtractionTargets', () => {
  const devices = [{ id: 'd1', start_date: '2025-01-01T00:00:00+00:00', end_date: null }];
  const loc = (key: string, start: string, end: string | null) => ({
    key,
    kind: 'declared' as const,
    apiName: null,
    lat: 43.3,
    lon: 5.4,
    points: [],
    firstStart: start,
    devices: [{ deviceId: 'd1', deviceName: 'Neb-1', presences: [{ start, end }] }],
  });
  const locs = [
    loc('declared:d1:0', '2025-01-01T00:00:00+00:00', '2025-06-01T00:00:00+00:00'),
    loc('declared:d1:1', '2025-06-01T00:00:00+00:00', null),
  ];

  it('prend la période de campagne du capteur quand tous ses sites sont cochés', () => {
    expect(buildExtractionTargets(devices, locs, new Set(['declared:d1:0', 'declared:d1:1']))).toEqual([
      { deviceId: 'd1', intervals: [{ start: '2025-01-01T00:00:00+00:00', end: null }] },
    ]);
  });

  it('se limite aux présences des sites cochés, et ignore un capteur sans site coché', () => {
    expect(buildExtractionTargets(devices, locs, new Set(['declared:d1:1']))).toEqual([
      { deviceId: 'd1', intervals: [{ start: '2025-06-01T00:00:00+00:00', end: null }] },
    ]);
    expect(buildExtractionTargets(devices, locs, new Set())).toEqual([]);
  });
});

describe('splitChunk', () => {
  it('coupe à l’heure près et refuse en deçà d’une heure', () => {
    const chunk: ExtractionChunk = {
      deviceId: 'd',
      from: new Date('2025-01-01T00:00:00Z'),
      to: new Date('2025-01-02T01:00:00Z'),
    };
    const [a, b] = splitChunk(chunk)!;
    expect(a.to.getTime() % HOUR).toBe(0);
    expect(a.to.getTime()).toBe(b.from.getTime());
    expect(splitChunk({ deviceId: 'd', from: new Date(0), to: new Date(HOUR) })).toBeNull();
  });
});

describe('runExtraction', () => {
  const sleep = () => Promise.resolve();

  it('rassemble toutes les lignes horaires de toutes les tranches', async () => {
    const request = baseRequest({ to: new Date('2025-01-11T00:00:00Z') });
    const chunks = planChunks(request);
    const client = {
      fetchObservationsChunk: vi.fn(async (p: { deviceId: string; from: Date; to: Date }) => ({
        rows: rowsFor(p.deviceId, p.from, p.to),
        truncated: false,
      })),
    };
    const result = await runExtraction(request, chunks, { client, sleep });
    expect(result.failures).toEqual([]);
    expect(result.store.finalizedRowCount).toBe(10 * 24);
  });

  it('coupe en deux une tranche tronquée au lieu de l’accepter', async () => {
    const request = baseRequest({ to: new Date('2025-01-05T00:00:00Z') });
    const chunks = planChunks(request);
    const client = {
      fetchObservationsChunk: vi.fn(async (p: { deviceId: string; from: Date; to: Date }) => {
        const span = p.to.getTime() - p.from.getTime();
        // Tronque tout ce qui dépasse 1 jour
        if (span > DAY) return { rows: rowsFor(p.deviceId, p.from, p.to).slice(0, 5), truncated: true };
        return { rows: rowsFor(p.deviceId, p.from, p.to), truncated: false };
      }),
    };
    const progress: number[][] = [];
    const result = await runExtraction(request, chunks, {
      client,
      sleep,
      onProgress: (p) => progress.push([p.done, p.total]),
    });
    expect(result.failures).toEqual([]);
    expect(result.store.finalizedRowCount).toBe(4 * 24);
    const last = progress.at(-1)!;
    expect(last[0]).toBe(last[1]);
  });

  it('relance les 504 puis réussit, et liste les échecs définitifs', async () => {
    const request = baseRequest({
      to: new Date('2025-01-02T00:00:00Z'),
      targets: [
        { deviceId: 'flaky', intervals: [{ start: null, end: null }] },
        { deviceId: 'broken', intervals: [{ start: null, end: null }] },
      ],
    });
    const calls: Record<string, number> = {};
    const client = {
      fetchObservationsChunk: vi.fn(async (p: { deviceId: string; from: Date; to: Date }) => {
        calls[p.deviceId] = (calls[p.deviceId] ?? 0) + 1;
        if (p.deviceId === 'flaky' && calls.flaky === 1) throw new MicrospotHttpError(504, 'timeout');
        if (p.deviceId === 'broken') throw new MicrospotHttpError(400, 'bad');
        return { rows: rowsFor(p.deviceId, p.from, p.to), truncated: false };
      }),
    };
    const result = await runExtraction(request, planChunks(request), { client, sleep });
    expect(calls.flaky).toBe(2);
    expect(calls.broken).toBe(1); // 400 : pas de relance
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.chunk.deviceId).toBe('broken');
    expect(result.store.finalizedRowCount).toBe(24);
  });

  it('remonte une erreur d’authentification', async () => {
    const request = baseRequest({ to: new Date('2025-01-02T00:00:00Z') });
    const client = {
      fetchObservationsChunk: vi.fn(async () => {
        throw new MicrospotAuthError();
      }),
    };
    await expect(runExtraction(request, planChunks(request), { client, sleep })).rejects.toBeInstanceOf(
      MicrospotAuthError
    );
  });

  it('s’arrête sur annulation', async () => {
    const request = baseRequest({
      targets: Array.from({ length: 20 }, (_, i) => ({ deviceId: `d${i}`, intervals: [{ start: null, end: null }] })),
    });
    const controller = new AbortController();
    const client = {
      fetchObservationsChunk: vi.fn(async (p: { deviceId: string; from: Date; to: Date }) => {
        controller.abort();
        return { rows: rowsFor(p.deviceId, p.from, new Date(p.from.getTime() + HOUR)), truncated: false };
      }),
    };
    const result = await runExtraction(request, planChunks(request), {
      client,
      sleep,
      concurrency: 2,
      signal: controller.signal,
    });
    expect(result.aborted).toBe(true);
    expect(client.fetchObservationsChunk.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
