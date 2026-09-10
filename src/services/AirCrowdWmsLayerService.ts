import L from 'leaflet';

/**
 * PoC : couches WMS cartographie AirCrowd (preprod GeoServer).
 *
 * Pattern layer :
 *   aircrowd:aircrowd_{polluant}_{YYYY}_{MM}_{DD}_{HHh}
 * Exemple :
 *   aircrowd:aircrowd_pm10_2026_09_02_11h
 *
 * L’URL relative `/aircrowd-wms/wms` passe par le proxy Vite (dev) pour éviter
 * NS_ERROR_DOM_NETWORK_ERR quand le navigateur n’atteint pas le GeoServer
 * preprod (VPN / réseau interne). Cible réelle :
 * https://preprod-geoservices.atmosud.org/aircrowd/wms
 */

export const AIRCROWD_WMS_UPSTREAM =
  'https://preprod-geoservices.atmosud.org/aircrowd';

/** Endpoint WMS same-origin (proxy Vite → preprod). */
export const AIRCROWD_WMS_URL = '/aircrowd-wms/wms';

/** Première carto générée (PoC) — borne basse du sélecteur de date. */
export const AIRCROWD_WMS_DEFAULT_START_DATE = '2026-09-02';

/**
 * Dernière date connue côté GeoServer PoC (fallback si GetCapabilities échoue).
 * Au-delà, les GetMap renvoient LayerNotDefined → tuiles transparentes.
 */
export const AIRCROWD_WMS_DEFAULT_END_DATE = '2026-09-04';

/** Date/heure de démo connue pour exister côté GeoServer (PoC). */
export const AIRCROWD_WMS_DEMO_DATE = '2026-09-02';
export const AIRCROWD_WMS_DEMO_HOUR = 11;

const LAYER_NAME_RE =
  /^aircrowd_(pm10|pm25)_(\d{4})_(\d{2})_(\d{2})_(\d{2})h$/i;

export type AirCrowdWmsAvailability = {
  /** polluant → date ISO → heures 0–23 disponibles */
  byPollutant: Record<string, Record<string, number[]>>;
  minDate: string;
  maxDate: string;
};

const getAirCrowdWmsUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${AIRCROWD_WMS_URL}`;
  }
  return AIRCROWD_WMS_URL;
};

const WMS_CONFIG = {
  workspace: 'aircrowd',
  version: '1.1.0',
  format: 'image/png',
  opacity: 0.7,
  attribution: 'AtmoSud — AirCrowd',
  minZoom: 1,
  maxZoom: 18,
} as const;

/** Mapping code polluant UI → segment dans le nom de layer GeoServer. */
const POLLUTANT_LAYER_SEGMENT: Record<string, string> = {
  pm10: 'pm10',
  pm25: 'pm25',
};

export const isAirCrowdWmsPollutantSupported = (pollutant: string): boolean =>
  Object.prototype.hasOwnProperty.call(POLLUTANT_LAYER_SEGMENT, pollutant);

export const formatAirCrowdWmsHour = (hour: number): string => {
  const clamped = Math.max(0, Math.min(23, Math.floor(hour)));
  return `${String(clamped).padStart(2, '0')}h`;
};

/** YYYY-MM-DD local (pas UTC) pour coller aux noms de layers. */
export const formatLocalIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getAirCrowdWmsToday = (): string => formatLocalIsoDate(new Date());

export const clampAirCrowdWmsDate = (
  dateIso: string,
  startDate: string = AIRCROWD_WMS_DEFAULT_START_DATE,
  endDate: string = getAirCrowdWmsToday()
): string => {
  if (dateIso < startDate) return startDate;
  if (dateIso > endDate) return endDate;
  return dateIso;
};

/**
 * Construit le nom qualifié du layer WMS.
 * @param pollutant code UI (pm10, pm25, …)
 * @param dateIso YYYY-MM-DD
 * @param hour 0–23
 */
export const buildAirCrowdLayerName = (
  pollutant: string,
  dateIso: string,
  hour: number
): string => {
  const segment = POLLUTANT_LAYER_SEGMENT[pollutant];
  if (!segment) {
    throw new Error(`Polluant non supporté pour AirCrowd WMS: ${pollutant}`);
  }
  const [year, month, day] = dateIso.split('-');
  if (!year || !month || !day) {
    throw new Error(`Date invalide pour AirCrowd WMS: ${dateIso}`);
  }
  const hourSuffix = formatAirCrowdWmsHour(hour);
  return `${WMS_CONFIG.workspace}:aircrowd_${segment}_${year}_${month}_${day}_${hourSuffix}`;
};

export const getAirCrowdWmsLegendUrl = (layerName: string): string => {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: WMS_CONFIG.version,
    REQUEST: 'GetLegendGraphic',
    FORMAT: 'image/png',
    LAYER: layerName,
  });
  return `${getAirCrowdWmsUrl()}?${params.toString()}`;
};

/** Parse les noms de layers GetCapabilities → calendrier disponible. */
export const parseAirCrowdWmsAvailability = (
  capabilitiesXml: string
): AirCrowdWmsAvailability => {
  const byPollutant: AirCrowdWmsAvailability['byPollutant'] = {};
  const nameMatches = capabilitiesXml.matchAll(/<Name>([^<]+)<\/Name>/gi);

  for (const match of nameMatches) {
    const raw = match[1]?.trim() ?? '';
    const unqualified = raw.includes(':') ? raw.split(':').pop()! : raw;
    const parsed = unqualified.match(LAYER_NAME_RE);
    if (!parsed) continue;

    const pollutant = parsed[1].toLowerCase();
    const dateIso = `${parsed[2]}-${parsed[3]}-${parsed[4]}`;
    const hour = Number(parsed[5]);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;

    if (!byPollutant[pollutant]) byPollutant[pollutant] = {};
    if (!byPollutant[pollutant][dateIso]) byPollutant[pollutant][dateIso] = [];
    if (!byPollutant[pollutant][dateIso].includes(hour)) {
      byPollutant[pollutant][dateIso].push(hour);
    }
  }

  for (const dates of Object.values(byPollutant)) {
    for (const dateIso of Object.keys(dates)) {
      dates[dateIso].sort((a, b) => a - b);
    }
  }

  const allDates = Object.values(byPollutant).flatMap((dates) =>
    Object.keys(dates)
  );
  allDates.sort();

  return {
    byPollutant,
    minDate: allDates[0] ?? AIRCROWD_WMS_DEFAULT_START_DATE,
    maxDate: allDates[allDates.length - 1] ?? AIRCROWD_WMS_DEFAULT_END_DATE,
  };
};

export const fetchAirCrowdWmsAvailability =
  async (): Promise<AirCrowdWmsAvailability> => {
    const params = new URLSearchParams({
      service: 'WMS',
      version: WMS_CONFIG.version,
      request: 'GetCapabilities',
    });
    const response = await fetch(`${getAirCrowdWmsUrl()}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`GetCapabilities AirCrowd WMS: HTTP ${response.status}`);
    }
    const xml = await response.text();
    return parseAirCrowdWmsAvailability(xml);
  };

export const getAvailableHoursForAirCrowd = (
  availability: AirCrowdWmsAvailability | null,
  pollutant: string,
  dateIso: string
): number[] => {
  if (!availability) return [];
  return availability.byPollutant[pollutant]?.[dateIso] ?? [];
};

export const isAirCrowdLayerAvailable = (
  availability: AirCrowdWmsAvailability | null,
  pollutant: string,
  dateIso: string,
  hour: number
): boolean => {
  if (!availability) {
    // Sans catalogue : on ne bloque pas (fallback PoC).
    return true;
  }
  return getAvailableHoursForAirCrowd(availability, pollutant, dateIso).includes(
    hour
  );
};

export const pickNearestAvailableAirCrowdHour = (
  hours: number[],
  preferredHour: number
): number | null => {
  if (hours.length === 0) return null;
  let best = hours[0];
  let bestDist = Math.abs(best - preferredHour);
  for (let i = 1; i < hours.length; i += 1) {
    const dist = Math.abs(hours[i] - preferredHour);
    if (dist < bestDist) {
      best = hours[i];
      bestDist = dist;
    }
  }
  return best;
};

export const createAirCrowdWMSLayer = (layerName: string): L.TileLayer.WMS => {
  // URL absolue same-origin : évite les soucis Firefox avec les chemins relatifs
  // et force le passage par le proxy Vite (/aircrowd-wms → preprod).
  return L.tileLayer.wms(getAirCrowdWmsUrl(), {
    layers: layerName,
    format: WMS_CONFIG.format,
    transparent: true,
    version: WMS_CONFIG.version,
    attribution: WMS_CONFIG.attribution,
    opacity: WMS_CONFIG.opacity,
    minZoom: WMS_CONFIG.minZoom,
    maxZoom: WMS_CONFIG.maxZoom,
    pane: 'overlayPane',
    // Ne pas bloquer sur les layers absents (réponse XML LayerNotDefined)
    errorTileUrl:
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  });
};
