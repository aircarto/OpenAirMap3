import L from 'leaflet';
import { DOMAIN_CONFIG } from '../config/domainConfig';

/** GWIS expose les couches temporelles (today / week / month / season) — WMS + WFS hotspots */
const EFFIS_GWIS_BASE_URL = 'https://maps.effis.emergency.copernicus.eu/gwis';
/** Feux actifs sur les 7 derniers jours — aligné sur une fenêtre glissante de 7 jours (WMS) */
const EFFIS_HOTSPOTS_LAYER = 'all.hs.week';
/** Même couche en WFS GeoJSON (GWIS) */
const EFFIS_HOTSPOTS_WFS_TYPENAME = 'ms:all.hs.week';
const EFFIS_HOTSPOTS_MAX_FEATURES = 500;

/** Zones brûlées saison — WFS MapServer */
const EFFIS_WFS_BASE_URL = 'https://maps.effis.emergency.copernicus.eu/effis';
const EFFIS_BURNED_AREAS_TYPENAME = 'ms:modis.ba.poly.season';
/** Plafond requis côté serveur EFFIS (évite 500 / timeout) */
const EFFIS_BURNED_AREAS_MAX_FEATURES = 500;

/** Emprise région Sud — Leaflet ne charge les tuiles WMS que dans ces bounds */
const REGION_SUD_BOUNDS = L.latLngBounds(DOMAIN_CONFIG.default.mapBounds);

const commonWmsOptions: L.WMSOptions = {
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  opacity: 0.85,
  minZoom: 1,
  maxZoom: 18,
  pane: 'overlayPane',
  bounds: REGION_SUD_BOUNDS,
};

const burnedAreaStyle: L.PathOptions = {
  color: '#c2410c',
  weight: 1.5,
  opacity: 0.9,
  fillColor: '#ea580c',
  fillOpacity: 0.35,
};

const burnedAreaHoverStyle: L.PathOptions = {
  color: '#9a3412',
  weight: 2.5,
  opacity: 1,
  fillColor: '#f97316',
  fillOpacity: 0.5,
};

interface EffisBurnedAreaProperties {
  id?: string;
  FIREDATE?: string;
  FINALDATE?: string;
  LASTUPDATE?: string;
  COUNTRY?: string;
  PROVINCE?: string;
  COMMUNE?: string;
  AREA_HA?: string;
  BROADLEA?: string;
  CONIFER?: string;
  MIXED?: string;
  SCLEROPH?: string;
  TRANSIT?: string;
  OTHERNATLC?: string;
  AGRIAREAS?: string;
  ARTIFSURF?: string;
  OTHERLC?: string;
  PERCNA2K?: string;
  CLASS?: string;
}

interface EffisHotspotProperties {
  id?: string;
  acq_at?: string;
  CLASS?: string;
}

/** Suffixe satellite dans CLASS (ex. 7DAYS_N, 1DAY_S) */
const HOTSPOT_SATELLITE_LABELS: Record<string, string> = {
  N: 'VIIRS NOAA-20',
  '1': 'VIIRS NOAA-21',
  '2': 'VIIRS S-NPP',
  T: 'MODIS Terra',
  A: 'MODIS Aqua',
  S: 'Sentinel-3',
  B: 'GOES',
};

/**
 * Construit le BBOX WFS 1.1.0 (minLon,minLat,maxLon,maxLat) depuis mapBounds
 */
function getRegionSudBbox(): string {
  const [[south, west], [north, east]] = DOMAIN_CONFIG.default.mapBounds;
  return `${west},${south},${east},${north}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPercent(value?: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num <= 0) {
    return null;
  }
  return `${num.toFixed(1)} %`;
}

function formatDateLabel(value?: string): string {
  if (!value) {
    return '—';
  }
  // "2026-06-28 13:21:00" → garder YYYY-MM-DD (et heure si présente)
  return escapeHtml(value.replace('T', ' ').trim());
}

function buildBurnedAreaPopupHtml(props: EffisBurnedAreaProperties): string {
  const location = [props.COMMUNE, props.PROVINCE, props.COUNTRY]
    .filter(Boolean)
    .map((v) => escapeHtml(String(v)))
    .join(' · ');

  const landCoverRows: Array<[string, string | null]> = [
    ['Sclérophylles', formatPercent(props.SCLEROPH)],
    ['Conifères', formatPercent(props.CONIFER)],
    ['Feuillus', formatPercent(props.BROADLEA)],
    ['Mixte', formatPercent(props.MIXED)],
    ['Agricole', formatPercent(props.AGRIAREAS)],
    ['Artificiel', formatPercent(props.ARTIFSURF)],
    ['Autres nat.', formatPercent(props.OTHERNATLC)],
  ].filter(([, v]) => v !== null) as Array<[string, string]>;

  const natura = formatPercent(props.PERCNA2K);
  const areaHa = props.AREA_HA ? escapeHtml(String(props.AREA_HA)) : '—';

  const landCoverHtml =
    landCoverRows.length > 0
      ? `<div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:6px;">
          <div style="font-weight:600;margin-bottom:4px;">Occupation du sol</div>
          ${landCoverRows
            .map(
              ([label, value]) =>
                `<div style="display:flex;justify-content:space-between;gap:12px;">
                  <span>${label}</span><span>${value}</span>
                </div>`
            )
            .join('')}
        </div>`
      : '';

  return `
    <div class="effis-burned-popup" style="min-width:220px;font-size:13px;line-height:1.35;">
      <div style="font-weight:700;margin-bottom:6px;">Zone brûlée EFFIS</div>
      <div><strong>Lieu :</strong> ${location || '—'}</div>
      <div><strong>Début :</strong> ${formatDateLabel(props.FIREDATE)}</div>
      <div><strong>Fin :</strong> ${formatDateLabel(props.FINALDATE)}</div>
      <div><strong>Surface :</strong> ${areaHa} ha</div>
      ${natura ? `<div><strong>Natura 2000 :</strong> ${natura}</div>` : ''}
      ${landCoverHtml}
      <div style="margin-top:6px;font-size:11px;color:#6b7280;">Copernicus EFFIS — saison</div>
    </div>
  `;
}

function decodeHotspotSatellite(classCode?: string): string {
  if (!classCode) {
    return '—';
  }
  const suffix = classCode.includes('_')
    ? classCode.slice(classCode.lastIndexOf('_') + 1)
    : classCode;
  return HOTSPOT_SATELLITE_LABELS[suffix] || escapeHtml(classCode);
}

function isRecentHotspot(classCode?: string): boolean {
  return Boolean(classCode && classCode.startsWith('1DAY'));
}

function getHotspotMarkerStyle(classCode?: string): L.CircleMarkerOptions {
  const recent = isRecentHotspot(classCode);
  return {
    radius: 5,
    weight: 1,
    opacity: 0.95,
    fillOpacity: 0.75,
    color: recent ? '#991b1b' : '#c2410c',
    fillColor: recent ? '#ef4444' : '#f97316',
    pane: 'overlayPane',
  };
}

function buildHotspotPopupHtml(props: EffisHotspotProperties): string {
  const classCode = props.CLASS ? escapeHtml(String(props.CLASS)) : '—';
  const period = props.CLASS?.startsWith('1DAY')
    ? 'Dernières 24 h'
    : props.CLASS?.startsWith('7DAYS')
      ? '7 derniers jours'
      : '—';

  return `
    <div class="effis-hotspot-popup" style="min-width:200px;font-size:13px;line-height:1.35;">
      <div style="font-weight:700;margin-bottom:6px;">Point de chaleur EFFIS</div>
      <div><strong>Détection :</strong> ${formatDateLabel(props.acq_at)}</div>
      <div><strong>Période :</strong> ${escapeHtml(period)}</div>
      <div><strong>Satellite :</strong> ${decodeHotspotSatellite(props.CLASS)}</div>
      <div><strong>Classe :</strong> ${classCode}</div>
      ${props.id ? `<div><strong>Id :</strong> ${escapeHtml(String(props.id))}</div>` : ''}
      <div style="margin-top:6px;font-size:11px;color:#6b7280;">
        Copernicus EFFIS / GWIS — précision ~1,5 km
      </div>
    </div>
  `;
}

/**
 * Cree un layer WMS Leaflet affichant les feux actifs EFFIS (7 derniers jours)
 * Conservé comme repli si le WFS échoue
 */
export function createEffisHotspotsWmsLayer(): L.TileLayer.WMS {
  return L.tileLayer.wms(EFFIS_GWIS_BASE_URL, {
    ...commonWmsOptions,
    layers: EFFIS_HOTSPOTS_LAYER,
    attribution: 'Copernicus EFFIS',
  });
}

/**
 * Charge les points de chaleur (7 jours) via WFS GeoJSON GWIS sur l'emprise region Sud
 */
export async function createEffisHotspotsGeoJSONLayer(): Promise<L.GeoJSON> {
  const wfsUrl = new URL(EFFIS_GWIS_BASE_URL);
  wfsUrl.searchParams.set('SERVICE', 'WFS');
  wfsUrl.searchParams.set('VERSION', '1.1.0');
  wfsUrl.searchParams.set('REQUEST', 'GetFeature');
  wfsUrl.searchParams.set('TYPENAME', EFFIS_HOTSPOTS_WFS_TYPENAME);
  wfsUrl.searchParams.set('BBOX', getRegionSudBbox());
  wfsUrl.searchParams.set('OUTPUTFORMAT', 'geojson');
  wfsUrl.searchParams.set(
    'MAXFEATURES',
    String(EFFIS_HOTSPOTS_MAX_FEATURES)
  );

  const response = await fetch(wfsUrl.toString());
  if (!response.ok) {
    throw new Error(
      `Erreur WFS EFFIS hotspots: ${response.status} ${response.statusText}`
    );
  }

  const geoJsonData = await response.json();
  const featureCount = Array.isArray(geoJsonData?.features)
    ? geoJsonData.features.length
    : 0;

  if (featureCount >= EFFIS_HOTSPOTS_MAX_FEATURES) {
    console.warn(
      `EFFIS hotspots: plafond MAXFEATURES=${EFFIS_HOTSPOTS_MAX_FEATURES} atteint — résultats éventuellement tronqués`
    );
  }

  return L.geoJSON(geoJsonData as GeoJSON.GeoJsonObject, {
    pane: 'overlayPane',
    attribution: 'Copernicus EFFIS',
    pointToLayer: (feature, latlng) => {
      const props = (feature.properties || {}) as EffisHotspotProperties;
      return L.circleMarker(latlng, getHotspotMarkerStyle(props.CLASS));
    },
    onEachFeature: (feature, layer) => {
      const props = (feature.properties || {}) as EffisHotspotProperties;
      layer.bindPopup(buildHotspotPopupHtml(props), {
        maxWidth: 280,
        className: 'effis-hotspot-popup',
      });
    },
  });
}

/**
 * Charge les zones brulees de la saison via WFS (GeoJSON) sur l'emprise region Sud
 */
export async function createEffisBurnedAreasGeoJSONLayer(): Promise<L.GeoJSON> {
  const wfsUrl = new URL(EFFIS_WFS_BASE_URL);
  wfsUrl.searchParams.set('SERVICE', 'WFS');
  wfsUrl.searchParams.set('VERSION', '1.1.0');
  wfsUrl.searchParams.set('REQUEST', 'GetFeature');
  wfsUrl.searchParams.set('TYPENAME', EFFIS_BURNED_AREAS_TYPENAME);
  wfsUrl.searchParams.set('BBOX', getRegionSudBbox());
  wfsUrl.searchParams.set('OUTPUTFORMAT', 'geojson');
  wfsUrl.searchParams.set(
    'MAXFEATURES',
    String(EFFIS_BURNED_AREAS_MAX_FEATURES)
  );

  const response = await fetch(wfsUrl.toString());
  if (!response.ok) {
    throw new Error(
      `Erreur WFS EFFIS zones brûlées: ${response.status} ${response.statusText}`
    );
  }

  const geoJsonData = await response.json();
  const featureCount = Array.isArray(geoJsonData?.features)
    ? geoJsonData.features.length
    : 0;

  if (featureCount >= EFFIS_BURNED_AREAS_MAX_FEATURES) {
    console.warn(
      `EFFIS zones brûlées: plafond MAXFEATURES=${EFFIS_BURNED_AREAS_MAX_FEATURES} atteint — résultats éventuellement tronqués`
    );
  }

  return L.geoJSON(geoJsonData as GeoJSON.GeoJsonObject, {
    style: burnedAreaStyle,
    pane: 'overlayPane',
    attribution: 'Copernicus EFFIS',
    onEachFeature: (feature, layer) => {
      const props = (feature.properties || {}) as EffisBurnedAreaProperties;
      layer.bindPopup(buildBurnedAreaPopupHtml(props), {
        maxWidth: 320,
        className: 'effis-burned-area-popup',
      });

      layer.on({
        mouseover: (e) => {
          const path = e.target as L.Path;
          path.setStyle(burnedAreaHoverStyle);
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            path.bringToFront();
          }
        },
        mouseout: (e) => {
          const path = e.target as L.Path;
          path.setStyle(burnedAreaStyle);
        },
      });
    },
  });
}

/**
 * URL de la legende GetLegendGraphic pour les feux actifs EFFIS (7 jours)
 * Indépendante de l'affichage WFS/WMS
 */
export function getEffisHotspotsLegendUrl(): string {
  return `${EFFIS_GWIS_BASE_URL}?version=1.1.1&service=WMS&request=GetLegendGraphic&layer=${EFFIS_HOTSPOTS_LAYER}&format=image/png&STYLE=default`;
}
