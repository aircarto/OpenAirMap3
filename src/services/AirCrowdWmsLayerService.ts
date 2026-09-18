import L from 'leaflet';
import { readEnv } from '../lib/env';

/**
 * PoC : couches WMS cartographie AirCrowd (preprod GeoServer).
 *
 * Pattern layer :
 *   aircrowd:aircrowd_{polluant}_{YYYY}_{MM}_{DD}_{HHh}
 * Exemple :
 *   aircrowd:aircrowd_pm10_2026_09_02_11h
 *
 * Convention temporelle :
 * - TimeBar / MapInstant : heure de **début** du créneau local (14 = 14h–15h)
 * - Nom GeoServer AirCrowd : heure de **fin** locale (créneau 14h–15h → `15h`)
 * - Mesures API : timestamps UTC en heure de fin (même créneau → 13:00Z en CEST)
 *
 * URL de service :
 * - override : `NEXT_PUBLIC_AIRCROWD_WMS_URL` (ou alias `VITE_AIRCROWD_WMS_URL`)
 * - défaut : `/aircrowd-wms/wms` (rewrite Next → preprod-geoservices)
 *
 * Dans l’onglet Réseau du navigateur, chercher `/aircrowd-wms` (same-origin),
 * pas l’hôte upstream `preprod-geoservices` (proxy côté serveur).
 */

export const AIRCROWD_WMS_UPSTREAM =
  'https://preprod-geoservices.atmosud.org/aircrowd';

/** Chemin same-origin (proxy Vite en local, nginx éventuel en prod). */
export const AIRCROWD_WMS_PROXY_PATH = '/aircrowd-wms/wms';

/** @deprecated alias — préférer AIRCROWD_WMS_PROXY_PATH */
export const AIRCROWD_WMS_URL = AIRCROWD_WMS_PROXY_PATH;

const AIRCROWD_WMS_ERROR_TILE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

/** Première carto générée (PoC) — borne basse du sélecteur de date. */
export const AIRCROWD_WMS_DEFAULT_START_DATE = '2026-09-02';

/**
 * Dernière date connue côté GeoServer PoC (fallback si GetCapabilities échoue).
 * Préférer `getAirCrowdWmsToday()` côté UI quand le catalogue n’est pas encore chargé.
 */
export const AIRCROWD_WMS_DEFAULT_END_DATE = '2026-09-04';

/** @deprecated Ancienne date/heure de démo PoC — préférer getAirCrowdWmsToday() / heure locale. */
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

/**
 * Résout l’endpoint WMS (absolu) selon env / rewrite Next.
 * Exposé pour les tests.
 */
export const getAirCrowdWmsUrl = (): string => {
  const configured = (
    readEnv('NEXT_PUBLIC_AIRCROWD_WMS_URL') ??
    readEnv('VITE_AIRCROWD_WMS_URL') ??
    ''
  ).trim();
  // Toujours le proxy same-origin par défaut (rewrites Next en dev et standalone).
  const raw = configured || AIRCROWD_WMS_PROXY_PATH;

  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
    return raw;
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
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

/**
 * Titre de légende lisible (sans nom technique GeoServer).
 * Ex. : "Cartographie AirCrowd\nPM₂.₅ · 18/09/2026 · 14h–15h"
 */
export const getAirCrowdWmsLegendTitle = (
  pollutant: string,
  dateIso: string,
  startHour: number,
  heading = 'Cartographie AirCrowd'
): string => {
  const pollutantLabel =
    pollutant === 'pm25'
      ? 'PM₂.₅'
      : pollutant === 'pm10'
        ? 'PM₁₀'
        : pollutant.toUpperCase();

  const clamped = Math.max(0, Math.min(23, Math.floor(startHour)));
  const startLabel = formatAirCrowdWmsHour(clamped);
  const endLabel =
    clamped === 23 ? '00h' : formatAirCrowdWmsHour(clamped + 1);

  const [, month, day] = dateIso.split('-');
  const dateLabel =
    month && day ? `${day}/${month}` : dateIso;

  return `${heading}\n${pollutantLabel} · ${dateLabel} · ${startLabel}–${endLabel}`;
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
 * TimeBar (début local) → suffixe / date du layer GeoServer (fin locale).
 * Créneau 14h–15h → { dateIso, endHour: 15 } ; 23h–00h → lendemain 00h.
 */
export const mapInstantStartToAirCrowdEnd = (
  dateIso: string,
  startHour: number
): { dateIso: string; endHour: number } => {
  const h = Math.max(0, Math.min(23, Math.floor(startHour)));
  if (h >= 23) {
    const [y, m, d] = dateIso.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    return { dateIso: formatLocalIsoDate(next), endHour: 0 };
  }
  return { dateIso, endHour: h + 1 };
};

/**
 * Suffixe layer GeoServer (fin locale) → heure de début TimeBar.
 * `15h` le 18 → début 14 ; `00h` le 19 → début 23 le 18.
 */
export const airCrowdEndToMapInstantStart = (
  dateIso: string,
  endHour: number
): { dateIso: string; startHour: number } => {
  const h = Math.max(0, Math.min(23, Math.floor(endHour)));
  if (h === 0) {
    const [y, m, d] = dateIso.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    return { dateIso: formatLocalIsoDate(prev), startHour: 23 };
  }
  return { dateIso, startHour: h - 1 };
};

/**
 * Construit le nom qualifié du layer WMS.
 * @param pollutant code UI (pm10, pm25, …)
 * @param dateIso YYYY-MM-DD du créneau TimeBar (début)
 * @param startHour heure de début locale 0–23 (TimeBar / MapInstant)
 */
export const buildAirCrowdLayerName = (
  pollutant: string,
  dateIso: string,
  startHour: number
): string => {
  const segment = POLLUTANT_LAYER_SEGMENT[pollutant];
  if (!segment) {
    throw new Error(`Polluant non supporté pour AirCrowd WMS: ${pollutant}`);
  }
  const { dateIso: layerDate, endHour } = mapInstantStartToAirCrowdEnd(
    dateIso,
    startHour
  );
  const [year, month, day] = layerDate.split('-');
  if (!year || !month || !day) {
    throw new Error(`Date invalide pour AirCrowd WMS: ${dateIso}`);
  }
  const hourSuffix = formatAirCrowdWmsHour(endHour);
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
  startHour: number
): boolean => {
  if (!availability) {
    // Sans catalogue : on ne bloque pas (fallback PoC).
    return true;
  }
  const { dateIso: layerDate, endHour } = mapInstantStartToAirCrowdEnd(
    dateIso,
    startHour
  );
  return getAvailableHoursForAirCrowd(
    availability,
    pollutant,
    layerDate
  ).includes(endHour);
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
    // Layers absents (XML LayerNotDefined) → tuile transparente, sans bruit UI
    errorTileUrl: AIRCROWD_WMS_ERROR_TILE,
  });
};
