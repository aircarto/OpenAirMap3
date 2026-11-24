import type {
  MicrospotCampaignListItem,
  MicrospotDeviceWithLocationHistory,
} from '../../types';
import type { CampaignDataStore } from './campaignDataStore';

/**
 * Localisations d'une campagne : l'entrée « par site » de la page Campagnes.
 *
 * Source : /lists/devices?locations_history=true, seule route qui couvre les
 * sites des capteurs citoyens. Pour eux, chaque déplacement déclaré crée un
 * nouveau site « auto created for device … », même pour quelques mètres, et
 * /lists/locations ne les liste pas (constaté le 2026-11-20 : Capt'Air Citoyen,
 * 2 entrées d'historique sur 331 pointent vers un site référencé).
 *
 * Trois sortes de localisation :
 * - `named`      : site nommé (opéré par AtmoSud), partagé entre capteurs ;
 * - `declared`   : déclarations « auto created » d'UN capteur, fusionnées
 *                  quand elles sont à moins de MERGE_DISTANCE_M ;
 * - `undeclared` : périodes sans site déclaré, par capteur.
 */

/** Rayon de fusion des déclarations d'un même capteur (choix : 100 m² ≈ 10 m). */
export const MERGE_DISTANCE_M = 10;

export type LocalisationKind = 'named' | 'declared' | 'undeclared';

export interface Presence {
  start: string | null;
  end: string | null;
}

export interface LocalisationDevice {
  deviceId: string;
  deviceName: string | null;
  presences: Presence[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface CampaignLocalisation {
  key: string;
  kind: LocalisationKind;
  /** Nom donné par l'API (sites nommés) ; null pour les déclarations et les périodes sans site. */
  apiName: string | null;
  /** Centre (moyenne des déclarations fusionnées) ; null sans position. */
  lat: number | null;
  lon: number | null;
  points: GeoPoint[];
  devices: LocalisationDevice[];
  /** Première présence connue, pour l'ordre d'affichage. */
  firstStart: string | null;
  /** Connue seulement par les mesures, absente de l'historique. */
  discovered?: boolean;
}

const AUTO_CREATED = /^auto created for device/i;

export const isAutoCreatedLocation = (name: string | null | undefined): boolean =>
  Boolean(name && AUTO_CREATED.test(name.trim()));

/** Minuscules, sans accents ni ponctuation : compare les noms de campagne et de site. */
export const normalizeName = (s: string | number | null | undefined): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const toCoord = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Distance en mètres (haversine). */
export const distanceMeters = (a: GeoPoint, b: GeoPoint): number => {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const centroid = (points: GeoPoint[]): GeoPoint | null =>
  points.length === 0
    ? null
    : {
        lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
        lon: points.reduce((s, p) => s + p.lon, 0) / points.length,
      };

const newLocalisation = (
  key: string,
  kind: LocalisationKind,
  apiName: string | null,
  points: GeoPoint[]
): CampaignLocalisation => {
  const c = centroid(points);
  return {
    key,
    kind,
    apiName,
    lat: c?.lat ?? null,
    lon: c?.lon ?? null,
    points,
    devices: [],
    firstStart: null,
  };
};

const addPresence = (
  loc: CampaignLocalisation,
  deviceId: string,
  deviceName: string | null,
  presence: Presence
) => {
  let dev = loc.devices.find((d) => d.deviceId === deviceId);
  if (!dev) {
    dev = { deviceId, deviceName, presences: [] };
    loc.devices.push(dev);
  }
  dev.presences.push(presence);
  if (presence.start && (!loc.firstStart || presence.start < loc.firstStart)) {
    loc.firstStart = presence.start;
  }
};

/** Regroupe des points par composantes connexes à ≤ maxDistance (union-find). */
const clusterPoints = (points: GeoPoint[], maxDistance: number): number[] => {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distanceMeters(points[i]!, points[j]!) <= maxDistance) parent[find(j)] = find(i);
    }
  }
  return points.map((_, i) => find(i));
};

const KIND_ORDER: Record<LocalisationKind, number> = { named: 0, declared: 1, undeclared: 2 };

const sortLocalisations = (locs: CampaignLocalisation[]): CampaignLocalisation[] =>
  locs.sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.kind === 'named') return (a.apiName ?? '').localeCompare(b.apiName ?? '');
    const da = a.devices[0]?.deviceName ?? a.devices[0]?.deviceId ?? '';
    const db = b.devices[0]?.deviceName ?? b.devices[0]?.deviceId ?? '';
    return (
      da.localeCompare(db, undefined, { numeric: true }) ||
      (a.firstStart ?? '').localeCompare(b.firstStart ?? '')
    );
  });

/**
 * Localisations d'une campagne à partir de l'historique des capteurs.
 * Un capteur de la campagne sans aucune entrée d'historique devient une
 * période « sans site déclaré » couvrant sa présence sur la campagne.
 */
export function buildCampaignLocalisations(
  campaign: Pick<MicrospotCampaignListItem, 'name' | 'devices'>,
  histories: MicrospotDeviceWithLocationHistory[]
): CampaignLocalisation[] {
  const campaignDevices = new Map((campaign.devices ?? []).map((d) => [d.id, d]));
  const campaignName = normalizeName(campaign.name);
  const byKey = new Map<string, CampaignLocalisation>();
  const covered = new Set<string>();

  const getOrCreate = (
    key: string,
    kind: LocalisationKind,
    apiName: string | null,
    points: GeoPoint[]
  ) => {
    let loc = byKey.get(key);
    if (!loc) {
      loc = newLocalisation(key, kind, apiName, points);
      byKey.set(key, loc);
    }
    return loc;
  };

  for (const device of histories) {
    if (!campaignDevices.has(device.id)) continue;
    const entries = (device.locations_history ?? [])
      .filter((e) => normalizeName(e.campaign) === campaignName)
      .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
    if (entries.length === 0) continue;
    covered.add(device.id);
    const deviceName = device.name ?? null;

    const declared: { point: GeoPoint; presence: Presence }[] = [];
    for (const e of entries) {
      const presence = { start: e.start_date, end: e.end_date };
      const lat = toCoord(e.lat);
      const lon = toCoord(e.lon);
      const located = lat !== null && lon !== null;

      if (!e.location || (isAutoCreatedLocation(e.location) && !located)) {
        const loc = getOrCreate(`undeclared:${device.id}`, 'undeclared', null, []);
        addPresence(loc, device.id, deviceName, presence);
      } else if (isAutoCreatedLocation(e.location)) {
        declared.push({ point: { lat: lat!, lon: lon! }, presence });
      } else {
        const loc = getOrCreate(
          `named:${normalizeName(e.location)}`,
          'named',
          e.location,
          located ? [{ lat: lat!, lon: lon! }] : []
        );
        addPresence(loc, device.id, deviceName, presence);
      }
    }

    // Déclarations du capteur : une localisation par groupe à ≤ MERGE_DISTANCE_M
    const roots = clusterPoints(
      declared.map((d) => d.point),
      MERGE_DISTANCE_M
    );
    const groupIndex = new Map<number, number>();
    declared.forEach((d, i) => {
      const root = roots[i]!;
      if (!groupIndex.has(root)) groupIndex.set(root, groupIndex.size);
      const n = groupIndex.get(root)!;
      const points = declared.filter((_, j) => roots[j] === root).map((x) => x.point);
      const loc = getOrCreate(`declared:${device.id}:${n}`, 'declared', null, points);
      addPresence(loc, device.id, deviceName, d.presence);
    });
  }

  for (const d of campaign.devices ?? []) {
    if (covered.has(d.id)) continue;
    const loc = getOrCreate(`undeclared:${d.id}`, 'undeclared', null, []);
    addPresence(loc, d.id, null, { start: d.start_date, end: d.end_date });
  }

  return sortLocalisations([...byKey.values()]);
}

const inPresence = (p: Presence, time: number): boolean => {
  const start = p.start ? Date.parse(p.start) : -Infinity;
  const end = p.end ? Date.parse(p.end) : Infinity;
  return time >= start && time < end;
};

export interface RowLocationRef {
  locationName: string | null;
  lat: number | null;
  lon: number | null;
}

/**
 * Rattache une mesure (capteur, site de la ligne, heure) à une localisation.
 * Ordre : nom du site, puis proximité (déclarations), puis période de présence.
 * À défaut, crée une localisation « découverte » (listée par `discovered`).
 */
export class LocalisationResolver {
  private readonly byKey = new Map<string, CampaignLocalisation>();
  private readonly declaredByDevice = new Map<string, CampaignLocalisation[]>();
  private readonly extra: CampaignLocalisation[] = [];

  constructor(localisations: CampaignLocalisation[]) {
    for (const loc of localisations) {
      this.byKey.set(loc.key, loc);
      if (loc.kind === 'declared') {
        for (const d of loc.devices) {
          const list = this.declaredByDevice.get(d.deviceId) ?? [];
          list.push(loc);
          this.declaredByDevice.set(d.deviceId, list);
        }
      }
    }
  }

  /** Localisations apparues dans les mesures, absentes de l'historique. */
  get discovered(): CampaignLocalisation[] {
    return this.extra;
  }

  private addDiscovered(loc: CampaignLocalisation): CampaignLocalisation {
    loc.discovered = true;
    this.byKey.set(loc.key, loc);
    this.extra.push(loc);
    if (loc.kind === 'declared') {
      for (const d of loc.devices) {
        const list = this.declaredByDevice.get(d.deviceId) ?? [];
        list.push(loc);
        this.declaredByDevice.set(d.deviceId, list);
      }
    }
    return loc;
  }

  /** `byTime` : rattachement par la seule période, à ne pas mémoïser par site. */
  resolve(
    deviceId: string,
    deviceName: string | null,
    row: RowLocationRef,
    time: number
  ): { localisation: CampaignLocalisation; byTime: boolean } {
    const located = row.lat !== null && row.lon !== null;

    if (!row.locationName || (isAutoCreatedLocation(row.locationName) && !located)) {
      const key = `undeclared:${deviceId}`;
      const loc =
        this.byKey.get(key) ??
        this.addDiscovered({
          ...newLocalisation(key, 'undeclared', null, []),
          devices: [{ deviceId, deviceName, presences: [] }],
        });
      return { localisation: loc, byTime: false };
    }

    if (!isAutoCreatedLocation(row.locationName)) {
      const key = `named:${normalizeName(row.locationName)}`;
      const loc =
        this.byKey.get(key) ??
        this.addDiscovered(
          newLocalisation(key, 'named', row.locationName, located ? [{ lat: row.lat!, lon: row.lon! }] : [])
        );
      return { localisation: loc, byTime: false };
    }

    const point = { lat: row.lat!, lon: row.lon! };
    const candidates = this.declaredByDevice.get(deviceId) ?? [];
    const near = candidates.find((loc) =>
      loc.points.some((p) => distanceMeters(p, point) <= MERGE_DISTANCE_M)
    );
    if (near) return { localisation: near, byTime: false };

    const declaredAtTime = candidates.find(
      (loc) =>
        !loc.discovered &&
        loc.devices.some((d) => d.deviceId === deviceId && d.presences.some((p) => inPresence(p, time)))
    );
    if (declaredAtTime) return { localisation: declaredAtTime, byTime: true };

    const n = candidates.filter((c) => c.discovered).length;
    const loc = this.addDiscovered({
      ...newLocalisation(`declared:${deviceId}:obs${n}`, 'declared', null, [point]),
      devices: [{ deviceId, deviceName, presences: [] }],
    });
    return { localisation: loc, byTime: false };
  }
}

export interface LocalisationAssignment {
  /** Clé de localisation de chaque ligne finalisée, par série du store. */
  rowKeys: Map<string, string[]>;
  /** Index des lignes de chaque série, par localisation. */
  parts: Map<string, Map<string, number[]>>;
  /** Localisations découvertes dans les mesures. */
  discovered: CampaignLocalisation[];
}

/** Rattache toutes les lignes du store à une localisation. */
export function assignStoreToLocalisations(
  store: CampaignDataStore,
  localisations: CampaignLocalisation[]
): LocalisationAssignment {
  const resolver = new LocalisationResolver(localisations);
  const rowKeys = new Map<string, string[]>();
  const parts = new Map<string, Map<string, number[]>>();

  for (const s of store.getSeries()) {
    const memo = new Map<number, string>();
    const keys: string[] = new Array(s.length);
    for (let i = 0; i < s.length; i += 1) {
      const locationIndex = s.locationIndex[i]!;
      let key = memo.get(locationIndex);
      if (key === undefined) {
        const loc = store.locations[locationIndex];
        const { localisation, byTime } = resolver.resolve(
          s.deviceId,
          s.deviceName,
          { locationName: loc?.locationName ?? null, lat: loc?.lat ?? null, lon: loc?.lon ?? null },
          s.time[i]!
        );
        key = localisation.key;
        if (!byTime) memo.set(locationIndex, key);
      }
      keys[i] = key;
      let bySeries = parts.get(key);
      if (!bySeries) {
        bySeries = new Map();
        parts.set(key, bySeries);
      }
      let indices = bySeries.get(s.key);
      if (!indices) {
        indices = [];
        bySeries.set(s.key, indices);
      }
      indices.push(i);
    }
    rowKeys.set(s.key, keys);
  }

  return { rowKeys, parts, discovered: resolver.discovered };
}
