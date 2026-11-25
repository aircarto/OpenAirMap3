import { describe, it, expect } from 'vitest';
import {
  assignStoreToLocalisations,
  buildCampaignLocalisations,
  distanceMeters,
  LocalisationResolver,
  MERGE_DISTANCE_M,
} from '../campaignLocalisations';
import { CampaignDataStore } from '../campaignDataStore';
import type { MicrospotDeviceWithLocationHistory, MicrospotObservation } from '../../../types';

const AUTO = 'auto created for device 103F66F9D108';

/** Historique réel de Neb-139 (relevé du 2026-11-20), campagne « 25 - FNE13/CAN ». */
const NEB139: MicrospotDeviceWithLocationHistory = {
  id: '103F66F9D108',
  name: 'Neb-139',
  locations_history: [
    { study: 'Citoyens', campaign: "Capt'Air Citoyen", location: AUTO, lat: '43.34746444', lon: '5.46972156', start_date: '2025-04-01T13:14:19+00:00', end_date: '2025-04-01T14:43:08+00:00' },
    { study: 'Citoyens', campaign: '25 - FNE13/CAN', location: null, lat: null, lon: null, start_date: '2025-04-01T14:43:08+00:00', end_date: '2025-04-03T10:13:38+00:00' },
    { study: 'Citoyens', campaign: '25 - FNE13/CAN', location: AUTO, lat: '43.34777652', lon: '5.46990395', start_date: '2025-04-03T10:13:38+00:00', end_date: '2025-04-03T10:13:59+00:00' },
    { study: 'Citoyens', campaign: '25 - FNE13/CAN', location: AUTO, lat: '43.34746444', lon: '5.46972156', start_date: '2025-04-03T10:14:00+00:00', end_date: '2025-04-04T13:21:54+00:00' },
    { study: 'Citoyens', campaign: '25 - FNE13/CAN', location: AUTO, lat: '43.34745274', lon: '5.46974301', start_date: '2025-04-04T13:23:27+00:00', end_date: '2025-05-04T16:21:57+00:00' },
    { study: 'Citoyens', campaign: '25 - FNE13/CAN', location: AUTO, lat: '43.34744104', lon: '5.46973229', start_date: '2025-05-04T16:29:22+00:00', end_date: '2026-02-24T13:45:28+00:00' },
    { study: 'Citoyens', campaign: '25 - FNE13/CAN', location: AUTO, lat: '43.89582046', lon: '4.79116559', start_date: '2026-03-30T09:10:38+00:00', end_date: null },
  ],
};

const CAMPAIGN = {
  name: '25 - FNE13/CAN',
  devices: [
    { id: '103F66F9D108', start_date: '2025-04-01T14:43:08+00:00', end_date: null },
    { id: 'NO-HISTORY', start_date: '2025-01-01T00:00:00+00:00', end_date: null },
    { id: 'A1', start_date: null, end_date: null },
    { id: 'A2', start_date: null, end_date: null },
  ],
};

const SITE_HISTORY = (id: string, name: string): MicrospotDeviceWithLocationHistory => ({
  id,
  name,
  locations_history: [
    { study: 'Port', campaign: '25 - FNE13 / CAN', location: 'Port Nord', lat: '43.33', lon: '5.35', start_date: '2025-01-01T00:00:00+00:00', end_date: null },
  ],
});

const build = () =>
  buildCampaignLocalisations(CAMPAIGN, [NEB139, SITE_HISTORY('A1', 'Capteur A'), SITE_HISTORY('A2', 'Capteur B')]);

describe('buildCampaignLocalisations', () => {
  it('fusionne les déclarations d’un même capteur à moins de 10 m et sépare les autres', () => {
    const locs = build();
    const declared = locs.filter((l) => l.kind === 'declared');
    // Même endroit à 2 m près (3 déclarations) ; point à ~40 m ; déménagement à ~60 km
    expect(declared).toHaveLength(3);
    const home = declared.find((l) => l.devices[0]!.presences.length === 3)!;
    expect(home.points).toHaveLength(3);
    for (const p of home.points) {
      expect(distanceMeters(p, { lat: home.lat!, lon: home.lon! })).toBeLessThanOrEqual(MERGE_DISTANCE_M);
    }
    // L'entrée de l'autre campagne (Capt'Air Citoyen) est ignorée
    expect(declared.flatMap((l) => l.devices[0]!.presences).some((p) => p.start?.startsWith('2025-04-01T13'))).toBe(false);
  });

  it('regroupe un site nommé partagé par plusieurs capteurs (nom de campagne normalisé)', () => {
    const named = build().filter((l) => l.kind === 'named');
    expect(named).toHaveLength(1);
    expect(named[0]!.apiName).toBe('Port Nord');
    expect(named[0]!.devices.map((d) => d.deviceId)).toEqual(['A1', 'A2']);
  });

  it('crée une période « sans site » pour les trous de déclaration et les capteurs sans historique', () => {
    const undeclared = build().filter((l) => l.kind === 'undeclared');
    expect(undeclared.map((l) => l.key).sort()).toEqual(['undeclared:103F66F9D108', 'undeclared:NO-HISTORY']);
    const noHistory = undeclared.find((l) => l.key === 'undeclared:NO-HISTORY')!;
    expect(noHistory.devices[0]!.presences).toEqual([{ start: '2025-01-01T00:00:00+00:00', end: null }]);
  });

  it('ordonne : sites nommés, déclarations, puis périodes sans site', () => {
    expect(build().map((l) => l.kind)).toEqual(['named', 'declared', 'declared', 'declared', 'undeclared', 'undeclared']);
  });
});

describe('LocalisationResolver', () => {
  it('rattache une mesure par nom, par proximité, puis crée une localisation découverte', () => {
    const locs = build();
    const resolver = new LocalisationResolver(locs);
    const t = Date.parse('2025-06-01T00:00:00Z');

    expect(resolver.resolve('A1', 'Capteur A', { locationName: 'Port Nord', lat: 43.33, lon: 5.35 }, t).localisation.key).toBe(
      'named:portnord'
    );
    const home = resolver.resolve('103F66F9D108', 'Neb-139', { locationName: AUTO, lat: 43.34745, lon: 5.46974 }, t);
    expect(home.localisation.points).toHaveLength(3);
    expect(home.byTime).toBe(false);
    expect(resolver.resolve('103F66F9D108', 'Neb-139', { locationName: null, lat: null, lon: null }, t).localisation.key).toBe(
      'undeclared:103F66F9D108'
    );

    const elsewhere = resolver.resolve('103F66F9D108', 'Neb-139', { locationName: AUTO, lat: 44.5, lon: 6.1 }, Date.parse('2024-01-01T00:00:00Z'));
    expect(elsewhere.localisation.discovered).toBe(true);
    expect(resolver.discovered).toHaveLength(1);
  });
});

describe('assignStoreToLocalisations', () => {
  const obs = (time: string, lat: number | null, lon: number | null, name: string | null): MicrospotObservation => ({
    id: '103F66F9D108',
    name: 'Neb-139',
    location_id: name ? `103F66F9D108_${lat}` : null,
    location_name: name,
    variable_iso_code: '39',
    variable_name: 'PM 2.5',
    time,
    lat: lat ?? undefined,
    lon: lon ?? undefined,
    value: 5,
    value_ref: 5,
    unit: 'µg/m3',
  } as MicrospotObservation);

  it('répartit les lignes d’un capteur qui déménage entre ses localisations', () => {
    const store = new CampaignDataStore();
    store.addRows([
      obs('2025-04-02T00:00:00+00:00', null, null, null),
      obs('2025-04-05T00:00:00+00:00', 43.34745274, 5.46974301, AUTO),
      obs('2025-06-05T00:00:00+00:00', 43.34744104, 5.46973229, AUTO),
      obs('2026-04-05T00:00:00+00:00', 43.89582046, 4.79116559, AUTO),
    ]);
    const locs = build();
    const { rowKeys, parts } = assignStoreToLocalisations(store, locs);
    const keys = rowKeys.get('103F66F9D108|39')!;
    expect(keys[0]).toBe('undeclared:103F66F9D108');
    expect(keys[1]).toBe(keys[2]); // même lieu malgré deux location_id
    expect(keys[3]).not.toBe(keys[1]);
    expect(parts.get(keys[1]!)!.get('103F66F9D108|39')).toEqual([1, 2]);
  });

  it('garde les deux mesures de l’heure d’un déménagement, une par site (#134, 2026-10-16 15:00)', () => {
    const store = new CampaignDataStore();
    const at = '2026-10-16T15:00:00+00:00';
    store.addRows([
      obs(at, 43.34745274, 5.46974301, AUTO),
      obs(at, 43.89582046, 4.79116559, AUTO),
      // vrai doublon (recouvrement de fenêtres) : même heure, même site
      obs(at, 43.89582046, 4.79116559, AUTO),
    ]);
    expect(store.finalizedRowCount).toBe(2);
    const { parts } = assignStoreToLocalisations(store, build());
    expect([...parts.values()].map((p) => p.get('103F66F9D108|39')!.length)).toEqual([1, 1]);
  });
});
