/**
 * Géocodage inverse par l'API Adresse (BAN), opérée par l'IGN sur la
 * Géoplateforme depuis le transfert depuis api-adresse.data.gouv.fr.
 *
 * Sert à nommer les localisations déclarées des capteurs citoyens, que l'API
 * microspot appelle « auto created for device … ». CORS ouvert, sans clé,
 * 50 requêtes/s par IP : on limite la concurrence et on met en cache.
 *
 * Les coordonnées envoyées peuvent être des domiciles de particuliers : n'appeler
 * ce service que pour l'affichage aux utilisateurs connectés.
 */

export const BAN_REVERSE_URL = 'https://data.geopf.fr/geocodage/reverse';

/** Au-delà, l'adresse la plus proche ne décrit plus le lieu. */
export const MAX_ADDRESS_DISTANCE_M = 200;
const MAX_CONCURRENCY = 4;

/** France métropolitaine et Corse : la BAN ne couvre pas l'étranger (ex. Livourne). */
const FRANCE_BBOX = { minLat: 41.2, maxLat: 51.2, minLon: -5.3, maxLon: 9.7 };

export const isInFrance = (lat: number, lon: number): boolean =>
  lat >= FRANCE_BBOX.minLat &&
  lat <= FRANCE_BBOX.maxLat &&
  lon >= FRANCE_BBOX.minLon &&
  lon <= FRANCE_BBOX.maxLon;

interface BanFeature {
  properties?: {
    name?: string;
    postcode?: string;
    city?: string;
    label?: string;
    distance?: number;
  };
}

const cache = new Map<string, Promise<string | null>>();
let active = 0;
const waiting: (() => void)[] = [];

const acquire = async () => {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
};

const release = () => {
  active -= 1;
  waiting.shift()?.();
};

/** « 12 Rue X, 13001 Marseille » à partir d'un résultat BAN. */
export const formatBanAddress = (feature: BanFeature | undefined): string | null => {
  const p = feature?.properties;
  if (!p) return null;
  if (typeof p.distance === 'number' && p.distance > MAX_ADDRESS_DISTANCE_M) return null;
  const place = [p.postcode, p.city].filter(Boolean).join(' ');
  const label = [p.name, place].filter(Boolean).join(', ');
  return label || p.label || null;
};

const cacheKey = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

/** Adresse la plus proche, ou null (hors France, trop loin, erreur). */
export function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!isInFrance(lat, lon)) return Promise.resolve(null);
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached) return cached;

  let failed = false;
  const promise = (async () => {
    await acquire();
    try {
      const params = new URLSearchParams({
        lon: String(lon),
        lat: String(lat),
        index: 'address',
        limit: '1',
      });
      const response = await fetch(`${BAN_REVERSE_URL}?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        failed = true;
        return null;
      }
      const body = (await response.json()) as { features?: BanFeature[] };
      return formatBanAddress(body.features?.[0]);
    } catch {
      failed = true;
      return null;
    } finally {
      release();
    }
  })();
  // Une erreur (réseau, HTTP) n'est pas mise en cache ; « pas d'adresse » l'est.
  void promise.then(() => {
    if (failed) cache.delete(key);
  });
  cache.set(key, promise);
  return promise;
}

/** Réservé aux tests. */
export const __resetBanCache = () => {
  cache.clear();
};
