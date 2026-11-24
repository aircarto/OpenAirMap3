import { describe, it, expect } from 'vitest';
import {
  buildCampaignCsvBlob,
  CAMPAIGN_CSV_COLUMNS,
  campaignCsvFilename,
  escapeCsv,
  formatParisLocal,
  formatUtc,
} from '../campaignCsv';
import { CampaignDataStore } from '../campaignDataStore';
import type { MicrospotObservation } from '../../../types';

const row = (overrides: Partial<MicrospotObservation>): MicrospotObservation => ({
  id: '2451381',
  name: 'Antibes 1',
  location_id: '2250',
  location_name: 'Antibes, Place Guynemer',
  variable_iso_code: '24',
  variable_name: 'PM 10',
  time: '2026-10-01T00:00:00+00:00',
  lat: 43.58,
  lon: 7.12,
  value: 3.7,
  value_ref: 3.7,
  value_raw: 6.4,
  value_n1: 3.7,
  is_n1_applied: true,
  is_n2_applied: false,
  manually_validated: false,
  unit: 'µg/m3',
  ...overrides,
});

/** jsdom n'implémente pas Blob.arrayBuffer : passage par FileReader. */
const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const blobText = async (blob: Blob): Promise<string> =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blobBytes(blob));

describe('formatParisLocal', () => {
  it('applique +02:00 en été et +01:00 en hiver', () => {
    expect(formatParisLocal(Date.parse('2026-08-11T07:00:00Z'))).toBe('2026-08-11T09:00:00+02:00');
    expect(formatParisLocal(Date.parse('2026-01-15T23:00:00Z'))).toBe('2026-01-16T00:00:00+01:00');
  });

  it('gère le passage à l’heure d’hiver (deux 02:00 locales)', () => {
    // 2026-10-25 : 03:00 CEST → 02:00 CET à 01:00 UTC
    expect(formatParisLocal(Date.parse('2026-10-25T00:00:00Z'))).toBe('2026-10-25T02:00:00+02:00');
    expect(formatParisLocal(Date.parse('2026-10-25T01:00:00Z'))).toBe('2026-10-25T02:00:00+01:00');
  });

  it('formatUtc renvoie de l’ISO sans millisecondes', () => {
    expect(formatUtc(Date.parse('2026-08-11T07:00:00Z'))).toBe('2026-08-11T07:00:00Z');
  });
});

describe('escapeCsv', () => {
  it('protège séparateurs, guillemets et sauts de ligne', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('dit "x"')).toBe('"dit ""x"""');
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(12.5)).toBe('12.5');
  });
});

describe('buildCampaignCsvBlob', () => {
  it('écrit une ligne par capteur × variable × heure, triée et dédoublonnée', async () => {
    const store = new CampaignDataStore();
    store.addRows([
      row({ time: '2026-10-01T01:00:00+00:00' }),
      row({ time: '2026-10-01T00:00:00+00:00' }),
      // doublon de bord de fenêtre
      row({ time: '2026-10-01T01:00:00+00:00' }),
      row({
        variable_iso_code: '39',
        variable_name: 'PM 2.5',
        value: null,
        value_n1: null,
        is_n1_applied: false,
        status_code: 'I',
      }),
    ]);

    const blob = await buildCampaignCsvBlob(store, {
      studyId: 7,
      studyName: 'Service Capteur',
      campaignId: 71,
      campaignName: 'GPMM',
      statusLabels: new Map([['I', 'Invalide']]),
      siteFor: (key) => ({ key: 'named:antibes', label: `Antibes (${key})` }),
    });
    const bytes = await blobBytes(blob);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM

    const lines = (await blobText(blob)).replace(/^\uFEFF/, '').trimEnd().split('\n');
    expect(lines[0]).toBe(CAMPAIGN_CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(1 + 3);

    const header = lines[0]!.split(',');
    const col = (line: string, name: string) => {
      // Aucun champ de ce test ne contient de virgule hormis location_name, entre guillemets
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, ''));
      return cells[header.indexOf(name)];
    };

    // Tri par code ISO : '24' (PM 10) avant '39' (PM 2.5)
    expect(col(lines[1]!, 'variable_iso_code')).toBe('24');
    expect(col(lines[1]!, 'time_utc')).toBe('2026-10-01T00:00:00Z');
    expect(col(lines[1]!, 'time_local')).toBe('2026-10-01T02:00:00+02:00');
    expect(col(lines[2]!, 'time_utc')).toBe('2026-10-01T01:00:00Z');
    expect(col(lines[1]!, 'location_name')).toBe('"Antibes, Place Guynemer"');
    expect(col(lines[1]!, 'value_raw')).toBe('6.4');
    expect(col(lines[1]!, 'is_n1_applied')).toBe('true');
    expect(col(lines[1]!, 'campaign_name')).toBe('GPMM');
    expect(col(lines[1]!, 'study_id')).toBe('7');
    expect(col(lines[1]!, 'site_key')).toBe('named:antibes');
    expect(col(lines[1]!, 'site_label')).toBe('Antibes (2451381|24)');

    expect(col(lines[3]!, 'variable_iso_code')).toBe('39');
    expect(col(lines[3]!, 'value')).toBe('');
    expect(col(lines[3]!, 'status_code')).toBe('I');
    expect(col(lines[3]!, 'status_label')).toBe('Invalide');
  });
});

describe('campaignCsvFilename', () => {
  it('normalise le nom de campagne', () => {
    expect(
      campaignCsvFilename(
        48,
        'Essais en Atelier — désimperméabilisation',
        new Date(2026, 8, 15), // minuit local
        new Date(2026, 10, 20) // fin exclusive : minuit local du lendemain
      )
    ).toBe('campagne_48_essais-en-atelier-desimpermeabilisation_2026-09-15_2026-11-19_horaire.csv');
  });
});
