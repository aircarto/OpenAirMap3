import L from "leaflet";
import { mapInstantToAromeUtc } from "../constants/aromeDomains";

// Configuration WMTS
const WMTS_CONFIG = {
  url: "https://azurh-geoservices.atmosud.org/geoserver/gwc/service/wmts",
  folder: "azur_heure",
  version: "1.1.1",
  opacity: 0.7,
  tilematrixset: "EPSG:900913",
  tilesize: 256,
  format: "image/png8",
  attribution: "AtmoSud",
  min_zoom: 0,
  max_zoom: 16,
};

const GEOSERVER_BASE_URL = "https://azurh-geoservices.atmosud.org/geoserver";

// Mapping des polluants vers les layers (à compléter selon les données disponibles)
const POLLUTANT_LAYER_MAPPING: Record<string, { variable: string; libelle: string }> = {
  pm25: { variable: "pm2_5", libelle: "PM₂.₅" },
  pm10: { variable: "pm10", libelle: "PM₁₀" },
  pm1: { variable: "pm1", libelle: "PM₁" },
  no2: { variable: "no2", libelle: "NO₂" },
  o3: { variable: "o3", libelle: "O₃" },
  so2: { variable: "so2", libelle: "SO₂" },
};

function getHourRangeLabel(hourSuffix: string | null): string {
  if (!hourSuffix) {
    return "";
  }

  const now = new Date();
  const currentHour = now.getHours();

  let startHour = currentHour;

  if (hourSuffix === "24") {
    startHour = currentHour;
  } else if (hourSuffix === "23") {
    startHour = (currentHour - 1 + 24) % 24;
  } else {
    const suffixNumber = parseInt(hourSuffix, 10);
    const delta = suffixNumber - 24;
    startHour = (currentHour + delta + 24) % 24;
  }

  const endHour = (startHour + 1) % 24;

  return `${startHour}h-${endHour}h`;
}

function getPollutantTitleFromVariable(variable: string): string {
  for (const [, info] of Object.entries(POLLUTANT_LAYER_MAPPING)) {
    if (info.variable === variable) {
      return info.libelle;
    }
  }

  return variable.replace(/_/g, " ").toUpperCase();
}

/**
 * Calcule l'index horaire (0-47) à afficher selon le pas de temps
 * Les layers vont de h00 à h47, où :
 * - h24 = heure en cours
 * - h23 = heure précédente
 * - h22 = il y a 2 heures
 * - etc.
 * @param timeStep - Le pas de temps sélectionné
 * @returns L'index horaire (0-47) correspondant au suffixe du layer (ex: 24 pour h24) ou -1 si indisponible
 */
export function getModelingLayerHour(timeStep: string): number {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  
  // Calculer l'index du layer (h24 = maintenant, h23 = il y a 1h, etc.)
  let layerIndex: number;

  switch (timeStep) {
    case "heure":
      // Dernière heure pleine = heure précédente = h23
      layerIndex = 23;
      break;

    case "quartHeure":
      // Pendant les 15 premières minutes : heure précédente = h23
      // Pendant les 15 dernières minutes : heure actuelle = h24
      if (currentMinutes < 15) {
        layerIndex = 23;
      } else {
        layerIndex = 24;
      }
      break;

    case "deuxMin":
      // Toujours l'heure actuelle = h24
      layerIndex = 24;
      break;

    case "instantane":
    case "scan":
      // Désactivé pour scan
      return -1;

    default:
      // Par défaut, dernière heure pleine = h23
      layerIndex = 23;
  }

  return layerIndex;
}

/**
 * Génère le nom du layer horaire
 * @param hour - L'heure (0-47, représentant h00 à h47)
 * @returns Le nom du layer (ex: "paca_icairh_h24")
 */
export function formatHourLayerName(hour: number): string {
  return `h${hour.toString().padStart(2, "0")}`;
}

/**
 * Génère le nom complet du layer pour ICAIR'H
 * @param hour - L'heure formatée (ex: "h24")
 * @returns Le nom complet du layer (ex: "azur_heure:paca_icairh_h24")
 */
export function getIcairehLayerName(hour: string): string {
  return `${WMTS_CONFIG.folder}:paca_icairh_${hour}`;
}

/**
 * Génère le nom complet du layer pour un polluant
 * @param pollutant - Le code du polluant (ex: "pm25")
 * @param hour - L'heure formatée (ex: "h24")
 * @returns Le nom complet du layer (ex: "azur_heure:paca_pm2_5_h24")
 */
export function getPollutantLayerName(pollutant: string, hour: string): string {
  const pollutantInfo = POLLUTANT_LAYER_MAPPING[pollutant];
  if (!pollutantInfo) {
    throw new Error(`Polluant non supporté: ${pollutant}`);
  }
  return `${WMTS_CONFIG.folder}:paca_${pollutantInfo.variable}_${hour}`;
}

/**
 * Crée un layer WMTS Leaflet pour la modélisation
 * @param layerName - Le nom complet du layer (ex: "azur_heure:paca_icairh_h24")
 * @returns Un layer Leaflet WMTS
 */
export function createModelingWMTSLayer(layerName: string): L.TileLayer {
  // Construction de l'URL template pour WMTS selon le format GeoServer qui fonctionne
  // Format: {url}?SERVICE=WMTS&REQUEST=GetTile&VERSION={version}&LAYER={layer}&TILEMATRIXSET={tilematrixset}&FORMAT={format}&TILEMATRIX={tilematrixset}:{z}&TILEROW={y}&TILECOL={x}
  // Note: 
  // - Pas de paramètre STYLE
  // - TILEMATRIX doit inclure le préfixe du TILEMATRIXSET (ex: EPSG:900913:11)
  // - Ordre des paramètres important pour GeoServer
  const urlTemplate = `${WMTS_CONFIG.url}?SERVICE=WMTS&REQUEST=GetTile&VERSION=${WMTS_CONFIG.version}&LAYER=${layerName}&TILEMATRIXSET=${WMTS_CONFIG.tilematrixset}&FORMAT=${WMTS_CONFIG.format}&TILEMATRIX=${WMTS_CONFIG.tilematrixset}:{z}&TILEROW={y}&TILECOL={x}`;
  
  return L.tileLayer(urlTemplate, {
    attribution: WMTS_CONFIG.attribution,
    opacity: WMTS_CONFIG.opacity,
    minZoom: WMTS_CONFIG.min_zoom,
    maxZoom: WMTS_CONFIG.max_zoom,
    pane: "overlayPane", // Au-dessus du fond de carte mais sous les marqueurs
    tileSize: WMTS_CONFIG.tilesize,
  });
}

/**
 * Génère l'URL de la légende WMS associée à un layer de modélisation
 * @param layerName - Le nom complet du layer (ex: "azur_heure:paca_icairh_h24")
 * @returns L'URL du graphique de légende
 */
export function getModelingLegendUrl(layerName: string): string {
  if (!layerName.includes(":")) {
    throw new Error(`Nom de layer invalide pour la légende: ${layerName}`);
  }

  const [workspace] = layerName.split(":");
  const wmsUrl = `${GEOSERVER_BASE_URL}/${workspace}/wms`;

  const params = new URLSearchParams({
    REQUEST: "GetLegendGraphic",
    VERSION: WMTS_CONFIG.version,
    FORMAT: "image/png",
    WIDTH: "20",
    HEIGHT: "10",
    LAYER: layerName,
    TRANSPARENT: "true",
  });

  return `${wmsUrl}?${params.toString()}`;
}

/**
 * Génère un titre lisible pour la légende d'un layer de modélisation
 * @param layerName - Le nom complet du layer (ex: "azur_heure:paca_icairh_h24")
 * @returns Le titre à afficher dans la légende
 */
export function getModelingLegendTitle(layerName: string): string {
  const baseName = layerName.includes(":")
    ? layerName.split(":")[1]
    : layerName;

  const hourMatch = baseName.match(/_h(\d{2})$/);
  const hourSuffix = hourMatch ? hourMatch[1] : null;

  const timeLabel = getHourRangeLabel(hourSuffix);

  const heading = "Modélisation horaire";

  if (baseName.startsWith("paca_icairh_")) {
    const subtitle = timeLabel
      ? `ICAIR'H ${timeLabel}`
      : "ICAIR'H";
    return `${heading}\n${subtitle}`;
  }

  const pollutantMatch = baseName.match(/^paca_(.+)_h\d{2}$/);
  if (pollutantMatch) {
    const pollutantKey = pollutantMatch[1];
    const pollutantTitle = getPollutantTitleFromVariable(pollutantKey);
    const subtitle = timeLabel
      ? `${pollutantTitle} ${timeLabel}`
      : pollutantTitle;
    return `${heading}\n${subtitle}`;
  }

  const subtitle = timeLabel ? `${baseName} ${timeLabel}` : baseName;
  return `${heading}\n${subtitle}`;
}

/**
 * Détermine si les modélisations sont disponibles pour un pas de temps donné
 * @param timeStep - Le pas de temps
 * @returns true si les modélisations sont disponibles
 */
export function isModelingAvailable(timeStep: string): boolean {
  return timeStep !== "instantane" && timeStep !== "scan";
}

/**
 * Charge les données de vent depuis l'API AtmoSud
 * @param dateStr - La date au format YYYYMMDD (ex: "20240115")
 * @param hourStr - L'heure au format HH (ex: "14")
 * @returns Les données de vent au format JSON
 * @throws Error si la requête HTTP échoue
 */
export async function loadWindFromAtmoSud(
  dateStr: string,
  hourStr: string
): Promise<any> {
  const windUrl = `https://meteo.atmosud.org/${dateStr}/wind_field_${hourStr}.json`;

  const response = await fetch(windUrl);
  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }
  return await response.json();
}

/** Instant calendaire pour le POC AROME (date ISO + heure 0–23). */
export type AromeInstant = {
  date: string;
  hour: number;
};

export type AromeFieldOverlay = {
  objectUrl: string;
  bounds: L.LatLngBoundsExpression;
  units: string;
  min: number;
  max: number;
  varName: string;
};

/**
 * Vent AROME (u10/v10) au format wind-js via l'API locale.
 * `instant` est en heure locale carte ; conversion UTC avant fetch.
 */
export async function loadAromeWind(
  instant: AromeInstant,
  domain: string = 'Marseille'
): Promise<unknown> {
  const utc = mapInstantToAromeUtc(instant);
  const params = new URLSearchParams({
    date: utc.date,
    hour: String(utc.hour),
    domain,
  });
  const response = await fetch(`/api/arome/wind?${params.toString()}`);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) detail = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return response.json();
}

/**
 * Champ scalaire AROME (PNG) + bounds pour L.imageOverlay.
 * `instant` est en heure locale carte ; conversion UTC avant fetch.
 * L'appelant doit révoquer `objectUrl` au cleanup.
 */
export async function loadAromeField(
  instant: AromeInstant,
  varName: string = 't2m',
  domain: string = 'Marseille'
): Promise<AromeFieldOverlay> {
  const utc = mapInstantToAromeUtc(instant);
  const params = new URLSearchParams({
    date: utc.date,
    hour: String(utc.hour),
    var: varName,
    domain,
  });
  const response = await fetch(`/api/arome/field?${params.toString()}`);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) detail = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const boundsHeader = response.headers.get('X-Arome-Bounds');
  if (!boundsHeader) {
    throw new Error('En-tête X-Arome-Bounds manquant');
  }
  const [south, west, north, east] = boundsHeader.split(',').map(Number);
  if ([south, west, north, east].some((n) => Number.isNaN(n))) {
    throw new Error(`Bounds AROME invalides: ${boundsHeader}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    bounds: [
      [south, west],
      [north, east],
    ],
    units: response.headers.get('X-Arome-Units') || '',
    min: Number(response.headers.get('X-Arome-Min') || 'NaN'),
    max: Number(response.headers.get('X-Arome-Max') || 'NaN'),
    varName: response.headers.get('X-Arome-Var') || varName,
  };
}

export async function listAromeDates(
  domain: string = 'Marseille'
): Promise<string[]> {
  const params = new URLSearchParams({ domain });
  const response = await fetch(`/api/arome/dates?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Liste dates AROME: HTTP ${response.status}`);
  }
  const body = (await response.json()) as { dates?: string[] };
  return body.dates ?? [];
}

