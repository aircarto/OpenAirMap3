/**
 * Détection des microcapteurs AtmoMicro en co-location sur une station de
 * référence (phase QAQC / calibration).
 *
 * Filtrage carte : Set de `location_id` microspot à masquer.
 *
 * 1. **Jointure officielle** (cible) : AtmoRef `/observations/stations`
 *    expose `id_site` = `location_id` microspot. Dès qu'il est renseigné,
 *    on l'ajoute au set.
 * 2. **Repli heuristique** (transitoire) : nom / code FRxxxxx / proximité
 *    < 50 m — à retirer quand `id_site` est généralisé côté API.
 *
 * Ancienne API capteurs (`id_site` numérique historique) : pas de
 * `location_id` microspot — repli via `getLegacySiteQaqcExclusionReason`.
 */

export interface QaqcRefStation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  /**
   * Identifiant site microspot (`location_id`), renvoyé par AtmoRef
   * sous le champ `id_site`. Null tant que l'API ne le renseigne pas.
   */
  idSite: string | null;
}

export interface QaqcMicrospotLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Distance max (m) pour le repli proximité. */
export const QAQC_STATION_PROXIMITY_M = 50;

const REF_STATION_CODE_RE = /FR\d{5}/i;

/** Toutes les stations (actives + hors service) : Contes FR24023 n'est plus active. */
const ATMO_REF_STATIONS_URL =
  'https://api.atmosud.org/observations/stations?format=json&download=false&metadata=true';

const CACHE_DURATION_MS = 30 * 60 * 1000;

let stationsCache: QaqcRefStation[] | null = null;
let stationsFetchedAt = 0;
let stationsFetchPromise: Promise<QaqcRefStation[]> | null = null;

let locationIdsCache: Set<string> | null = null;
let locationIdsCacheKey = '';
let locationIdsFetchedAt = 0;

/** Destiné aux tests : vide les caches QAQC. */
export function resetQaqcStationsCache(): void {
  stationsCache = null;
  stationsFetchedAt = 0;
  stationsFetchPromise = null;
  locationIdsCache = null;
  locationIdsCacheKey = '';
  locationIdsFetchedAt = 0;
}

/** Normalise `id_site` AtmoRef vers la clé string utilisée comme `location_id`. */
export function normalizeStationIdSite(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export function normalizePlaceName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function hasRefStationCode(
  value: string | null | undefined
): boolean {
  if (!value) return false;
  return REF_STATION_CODE_RE.test(value);
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function findNearbyRefStation(
  lat: number,
  lon: number,
  stations: QaqcRefStation[],
  maxDistanceM: number = QAQC_STATION_PROXIMITY_M
): QaqcRefStation | null {
  let best: { station: QaqcRefStation; distance: number } | null = null;

  for (const station of stations) {
    if (
      station.latitude === null ||
      station.longitude === null ||
      Number.isNaN(station.latitude) ||
      Number.isNaN(station.longitude)
    ) {
      continue;
    }
    const distance = haversineMeters(
      lat,
      lon,
      station.latitude,
      station.longitude
    );
    if (distance > maxDistanceM) continue;
    if (!best || distance < best.distance) {
      best = { station, distance };
    }
  }

  return best?.station ?? null;
}

export type QaqcLocationMatchReason =
  | 'nom contient code station FRxxxxx'
  | 'nom identique a une station AtmoRef'
  | 'proximite station AtmoRef';

/**
 * Repli heuristique : pourquoi un site microspot est une co-location QAQC.
 * @deprecated À retirer quand `id_site` AtmoRef est généralisé.
 */
export function getQaqcLocationMatchReason(
  location: QaqcMicrospotLocation,
  stations: QaqcRefStation[]
): QaqcLocationMatchReason | null {
  if (hasRefStationCode(location.name)) {
    return 'nom contient code station FRxxxxx';
  }

  const normalizedName = normalizePlaceName(location.name);
  if (normalizedName) {
    const nameMatch = stations.some(
      (station) => normalizePlaceName(station.name) === normalizedName
    );
    if (nameMatch) {
      return 'nom identique a une station AtmoRef';
    }
  }

  if (
    typeof location.lat === 'number' &&
    typeof location.lon === 'number' &&
    !Number.isNaN(location.lat) &&
    !Number.isNaN(location.lon) &&
    stations.length > 0 &&
    findNearbyRefStation(location.lat, location.lon, stations)
  ) {
    return 'proximite station AtmoRef';
  }

  return null;
}

/**
 * location_id issus uniquement du champ AtmoRef `id_site`.
 */
export function locationIdsFromStationIdSites(
  stations: QaqcRefStation[]
): Set<string> {
  const ids = new Set<string>();
  for (const station of stations) {
    if (station.idSite) {
      ids.add(station.idSite);
    }
  }
  return ids;
}

/**
 * Construit le set des `location_id` microspot en co-location station.
 *
 * Priorité : `id_site` AtmoRef. Complément : heuristiques (repli temporaire).
 */
export function buildQaqcLocationIdSet(
  locations: Iterable<QaqcMicrospotLocation>,
  stations: QaqcRefStation[]
): Set<string> {
  const ids = locationIdsFromStationIdSites(stations);

  // Repli heuristique — à supprimer une fois id_site généralisé.
  for (const location of locations) {
    if (!location?.id) continue;
    const locationId = String(location.id);
    if (ids.has(locationId)) continue;
    if (getQaqcLocationMatchReason(location, stations)) {
      ids.add(locationId);
    }
  }

  return ids;
}

/** Repli ancienne API : un site sans location_id microspot. */
export type QaqcSiteExclusionReason =
  | 'code_station_commun FRxxxxx'
  | QaqcLocationMatchReason;

export function getLegacySiteQaqcExclusionReason(input: {
  lat?: number | null;
  lon?: number | null;
  locationName?: string | null;
  codeStationCommun?: string | null;
  stations: QaqcRefStation[];
}): QaqcSiteExclusionReason | null {
  if (hasRefStationCode(input.codeStationCommun)) {
    return 'code_station_commun FRxxxxx';
  }

  if (
    input.locationName == null ||
    typeof input.lat !== 'number' ||
    typeof input.lon !== 'number'
  ) {
    if (hasRefStationCode(input.locationName)) {
      return 'nom contient code station FRxxxxx';
    }
    return null;
  }

  return getQaqcLocationMatchReason(
    {
      id: '',
      name: input.locationName,
      lat: input.lat,
      lon: input.lon,
    },
    input.stations
  );
}

function parseStationCoords(
  lat: unknown,
  lon: unknown
): { latitude: number; longitude: number } | null {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    return null;
  }
  return { latitude: lat, longitude: lon };
}

/**
 * Charge (et met en cache) les stations AtmoRef utiles au filtre QAQC.
 * Inclut les stations hors service (ex. Contes FR24023).
 */
export async function getCachedQaqcRefStations(
  request: (url: string) => Promise<unknown>
): Promise<QaqcRefStation[]> {
  const now = Date.now();
  if (stationsCache && now - stationsFetchedAt < CACHE_DURATION_MS) {
    return stationsCache;
  }

  if (stationsFetchPromise) {
    return stationsFetchPromise;
  }

  stationsFetchPromise = (async () => {
    try {
      const response = (await request(ATMO_REF_STATIONS_URL)) as {
        stations?: Array<{
          id_station?: string;
          nom_station?: string;
          latitude?: number;
          longitude?: number;
          id_site?: string | number | null;
        }>;
      };
      const raw = Array.isArray(response?.stations) ? response.stations : [];
      const stations: QaqcRefStation[] = [];

      for (const station of raw) {
        const idSite = normalizeStationIdSite(station.id_site);
        const coords = parseStationCoords(station.latitude, station.longitude);
        // Garder la station si on a une jointure id_site et/ou des coords
        // pour le repli heuristique.
        if (!idSite && !coords) {
          continue;
        }
        stations.push({
          id: String(station.id_station ?? ''),
          name: String(station.nom_station ?? ''),
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          idSite,
        });
      }

      stationsCache = stations;
      stationsFetchedAt = Date.now();
      return stations;
    } catch (error) {
      console.warn(
        '[AtmoMicro][QAQC] Impossible de charger les stations AtmoRef pour le filtre:',
        error
      );
      return stationsCache ?? [];
    } finally {
      stationsFetchPromise = null;
    }
  })();

  return stationsFetchPromise;
}

/**
 * Set des location_id QAQC, mis en cache tant que le catalogue locations
 * et les stations n'ont pas changé (clé = taille + âge stations).
 */
export function getCachedQaqcLocationIdSet(
  locations: Map<string, QaqcMicrospotLocation> | QaqcMicrospotLocation[],
  stations: QaqcRefStation[]
): Set<string> {
  const list = Array.isArray(locations)
    ? locations
    : Array.from(locations.values());
  const idSiteCount = stations.filter((s) => s.idSite).length;
  const cacheKey = `${list.length}:${stations.length}:${idSiteCount}:${stationsFetchedAt}`;
  const now = Date.now();

  if (
    locationIdsCache &&
    locationIdsCacheKey === cacheKey &&
    now - locationIdsFetchedAt < CACHE_DURATION_MS
  ) {
    return locationIdsCache;
  }

  locationIdsCache = buildQaqcLocationIdSet(list, stations);
  locationIdsCacheKey = cacheKey;
  locationIdsFetchedAt = now;
  return locationIdsCache;
}
