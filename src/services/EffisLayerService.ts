import L from 'leaflet';
import { DomainConfig } from '../config/domainConfig';
import { cellKey } from '../utils/fireCellKey.mjs';
import recurrenceMask from '../data/fireRecurrenceMask.json';

/** Emprise carte d'une instance (voir DomainConfig.mapBounds) — passée par l'appelant, pas supposée fixe. */
type MapBounds = DomainConfig['mapBounds'];

/**
 * GWIS sert les points de chaleur. On interroge `all.hs.query` plutôt que les couches
 * temporelles `all.hs.today` / `.week` : c'est la MÊME donnée, mais son schéma expose
 * 23 attributs au lieu de 3 (frp, confidence, satellite, night, name_2…), ce qui permet
 * à la fois la symbologie proportionnelle, le débruitage et une popup utile.
 * En contrepartie elle n'a pas de découpage temporel intégré : on filtre sur `acq_at`.
 */
const EFFIS_GWIS_BASE_URL = 'https://maps.effis.emergency.copernicus.eu/gwis';
const EFFIS_HOTSPOTS_TYPENAME = 'ms:all.hs.query';

/** Zones brûlées MODIS — WFS MapServer, instance distincte de GWIS */
const EFFIS_WFS_BASE_URL = 'https://maps.effis.emergency.copernicus.eu/effis';

/**
 * Rétention de `all.hs.query` : fenêtre glissante de 365 jours, mesurée sur le service
 * (aucune détection avant J-365). Au-delà, le mode historique doit signaler la limite
 * plutôt que d'afficher une couche vide.
 */
export const EFFIS_HOTSPOTS_RETENTION_DAYS = 365;

/** Première année disponible en archive de zones brûlées (modis.ba.poly.YYYY) */
export const EFFIS_BURNED_AREAS_FIRST_ARCHIVE_YEAR = 2016;

/**
 * Pas de MAXFEATURES : le plafond historique de 500 tronquait la couche en pleine
 * saison (867 features sur l'emprise PACA, 2759 sur l'emprise France) et la coupe
 * était arbitraire — ordre serveur, pas les plus récents. Le service accepte la
 * requête complète. Seuil de veille uniquement, pour repérer une dérive de volume.
 */
const HOTSPOTS_VOLUME_WARN_THRESHOLD = 5000;
const BURNED_AREAS_VOLUME_WARN_THRESHOLD = 2000;

/** Périodes proposées pour les points de chaleur */
export type HotspotPeriod = '24h' | '7d';
/** Périodes proposées pour les zones brûlées */
export type BurnedAreaPeriod = 'today' | 'week' | 'season';

const HOTSPOT_PERIOD_HOURS: Record<HotspotPeriod, number> = {
  '24h': 24,
  '7d': 24 * 7,
};

const BURNED_AREA_TYPENAMES: Record<BurnedAreaPeriod, string> = {
  today: 'ms:modis.ba.poly.today',
  week: 'ms:modis.ba.poly.week',
  season: 'ms:modis.ba.poly.season',
};

/**
 * Masque des sources de chaleur permanentes (torchères industrielles, sidérurgie…).
 * Généré par `npm run build:fire-mask` — voir scripts/build-fire-mask.mjs pour le
 * calibrage. Sans lui, la seule zone de Fos-sur-Mer représente un tiers des points
 * affichés sur l'emprise PACA.
 */
const MASKED_CELLS = new Set<string>(recurrenceMask.cells);

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

/** Schéma de ms:all.hs.query (cf. DescribeFeatureType) — tous les champs arrivent en chaîne */
interface EffisHotspotProperties {
  id?: string;
  acq_at?: string;
  acq_date?: string;
  acq_time?: string;
  lat?: string;
  lon?: string;
  frp?: string;
  confidence?: string;
  night?: string;
  satellite?: string;
  bright_mir?: string;
  bright_tir?: string;
  name_1?: string;
  name_2?: string;
  CLASS?: string;
}

export interface EffisHotspotStats {
  /** Points effectivement affichés (après masque) */
  displayed: number;
  /** Points écartés comme sources permanentes */
  maskedOut: number;
  /** Puissance radiative maximale parmi les points affichés, en MW */
  maxFrp: number;
  /** Détection la plus récente affichée (`acq_at`, UTC) */
  latestAcquisition: string | null;
}

export interface EffisBurnedAreaStats {
  displayed: number;
  /** Surface cumulée des polygones affichés, en hectares */
  totalAreaHa: number;
  latestFireDate: string | null;
}

export interface EffisHotspotsLayerResult {
  layer: L.GeoJSON;
  stats: EffisHotspotStats;
}

export interface EffisBurnedAreasLayerResult {
  layer: L.GeoJSON;
  stats: EffisBurnedAreaStats;
}

interface HotspotLayerOptions {
  /**
   * Renderer Leaflet partagé. Un `L.canvas()` est fortement recommandé : l'emprise
   * France remonte ~2700 points sur 7 jours, volume auquel le rendu SVG par défaut
   * devient pénible au zoom et au déplacement.
   */
  renderer?: L.Renderer;
  /**
   * Fin de la fenêtre glissante. Absent = temps réel (fenêtre ouverte sur maintenant).
   * Renseigné = mode historique, la fenêtre se ferme à cette date.
   */
  referenceDate?: Date;
  signal?: AbortSignal;
}

interface BurnedAreaLayerOptions {
  referenceDate?: Date;
  signal?: AbortSignal;
}

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

/**
 * Construit le BBOX WFS 1.1 depuis mapBounds.
 * Attention : en WFS 1.1 / EPSG:4326 l'ordre est lat,lon (et non lon,lat comme en 1.0).
 */
function getBboxCoordinates(mapBounds: MapBounds): string {
  const [[south, west], [north, east]] = mapBounds;
  return `${south},${west} ${north},${east}`;
}

/** BBOX en paramètre de requête (zones brûlées) — ordre lon,lat attendu par le service */
function getBboxParam(mapBounds: MapBounds): string {
  const [[south, west], [north, east]] = mapBounds;
  return `${west},${south},${east},${north}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formate une date au format attendu par le service (`YYYY-MM-DD HH:mm:ss`).
 *
 * En UTC impérativement : `acq_at` est horodaté en UTC côté EFFIS. Formater en heure
 * locale décalerait la fenêtre de 1 à 2 h en France et amputerait les détections
 * les plus récentes — exactement celles qui intéressent l'utilisateur.
 */
export function formatWfsDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function formatWfsDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Filtre OGC 1.1 pour les points de chaleur : emprise + fenêtre temporelle.
 *
 * En temps réel on ne pose qu'une borne basse : une borne haute calée sur l'horloge
 * du navigateur masquerait les détections arrivées pendant un décalage d'horloge.
 * En mode historique les deux bornes sont nécessaires.
 */
export function buildHotspotsFilter(
  mapBounds: MapBounds,
  period: HotspotPeriod,
  referenceDate?: Date
): string {
  const end = referenceDate ?? new Date();
  const start = new Date(
    end.getTime() - HOTSPOT_PERIOD_HOURS[period] * 60 * 60 * 1000
  );

  const bbox =
    '<BBOX><PropertyName>msGeometry</PropertyName>' +
    `<Box srsName="EPSG:4326"><coordinates>${getBboxCoordinates(mapBounds)}</coordinates></Box>` +
    '</BBOX>';

  const temporal = referenceDate
    ? '<PropertyIsBetween><PropertyName>acq_at</PropertyName>' +
      `<LowerBoundary><Literal>${escapeXml(formatWfsDateTime(start))}</Literal></LowerBoundary>` +
      `<UpperBoundary><Literal>${escapeXml(formatWfsDateTime(end))}</Literal></UpperBoundary>` +
      '</PropertyIsBetween>'
    : '<PropertyIsGreaterThan><PropertyName>acq_at</PropertyName>' +
      `<Literal>${escapeXml(formatWfsDateTime(start))}</Literal>` +
      '</PropertyIsGreaterThan>';

  return `<Filter xmlns="http://www.opengis.net/ogc"><And>${bbox}${temporal}</And></Filter>`;
}

/**
 * Choisit la couche de zones brûlées.
 *
 * Les couches `today` / `week` / `season` sont relatives à aujourd'hui : en mode
 * historique elles ne conviennent pas, et on bascule sur l'archive annuelle
 * `modis.ba.poly.YYYY` (disponible de 2016 à l'année dernière révolue).
 */
export function resolveBurnedAreasTypename(
  period: BurnedAreaPeriod,
  referenceDate?: Date
): string {
  if (!referenceDate) {
    return BURNED_AREA_TYPENAMES[period];
  }
  const year = referenceDate.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  if (year >= currentYear) {
    return BURNED_AREA_TYPENAMES[period];
  }
  if (year < EFFIS_BURNED_AREAS_FIRST_ARCHIVE_YEAR) {
    return `ms:modis.ba.poly.${EFFIS_BURNED_AREAS_FIRST_ARCHIVE_YEAR}`;
  }
  return `ms:modis.ba.poly.${year}`;
}

/**
 * Un point tombe-t-il sur une source de chaleur permanente ?
 *
 * Garde-fou : au-delà de `frpOverrideMw`, on affiche malgré le masque. Sur 12 mois,
 * la puissance radiative des points masqués plafonne à 134 MW (p99 = 17 MW) quand
 * celle des points conservés monte à 2764 MW — un incendie réel déclaré sur un site
 * industriel reste donc visible.
 */
export function isPermanentSource(props: EffisHotspotProperties): boolean {
  const lat = Number.parseFloat(props.lat ?? '');
  const lon = Number.parseFloat(props.lon ?? '');
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return false;
  }
  const frp = Number.parseFloat(props.frp ?? '0');
  if (!Number.isNaN(frp) && frp >= recurrenceMask.frpOverrideMw) {
    return false;
  }
  return MASKED_CELLS.has(cellKey(lat, lon, recurrenceMask.cellSize));
}

/**
 * Rayon du marqueur d'après la puissance radiative.
 * Échelle logarithmique : le FRP s'étale de 0,2 à 2764 MW, une échelle linéaire
 * écraserait la quasi-totalité des points contre le minimum.
 */
export function getHotspotRadius(frpRaw?: string): number {
  const frp = Number.parseFloat(frpRaw ?? '');
  if (Number.isNaN(frp) || frp <= 0) {
    return 4;
  }
  return Math.min(14, Math.max(4, 4 + 3 * Math.log10(frp + 1)));
}

const CONFIDENCE_FILL_OPACITY: Record<string, number> = {
  High: 0.8,
  Nominal: 0.6,
  Low: 0.4,
};

/** Une détection de moins de 24 h avant la date de référence est signalée en rouge */
function isRecentHotspot(props: EffisHotspotProperties, reference: Date): boolean {
  if (!props.acq_at) {
    return false;
  }
  // `acq_at` est en UTC mais sans suffixe : le suffixe Z est ajouté pour éviter
  // une interprétation en heure locale par le moteur JS.
  const acquired = Date.parse(`${props.acq_at.replace(' ', 'T')}Z`);
  if (Number.isNaN(acquired)) {
    return false;
  }
  return reference.getTime() - acquired <= 24 * 60 * 60 * 1000;
}

function getHotspotMarkerStyle(
  props: EffisHotspotProperties,
  reference: Date,
  renderer?: L.Renderer
): L.CircleMarkerOptions {
  const recent = isRecentHotspot(props, reference);
  return {
    radius: getHotspotRadius(props.frp),
    weight: 1,
    opacity: 0.95,
    fillOpacity: CONFIDENCE_FILL_OPACITY[props.confidence ?? ''] ?? 0.6,
    color: recent ? '#991b1b' : '#c2410c',
    fillColor: recent ? '#ef4444' : '#f97316',
    pane: 'overlayPane',
    renderer,
  };
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
  return escapeHtml(value.replace('T', ' ').trim());
}

/** Arrondit le FRP : le service renvoie « 5.2000000000000000 » */
function formatFrp(value?: string): string {
  const frp = Number.parseFloat(value ?? '');
  if (Number.isNaN(frp)) {
    return '—';
  }
  return `${frp.toFixed(1)} MW`;
}

function buildBurnedAreaPopupHtml(props: EffisBurnedAreaProperties): string {
  const location = [props.COMMUNE, props.PROVINCE, props.COUNTRY]
    .filter(Boolean)
    .map((v) => escapeHtml(String(v)))
    .join(' · ');

  const landCoverRows: Array<[string, string]> = (
    [
      ['Sclérophylles', formatPercent(props.SCLEROPH)],
      ['Conifères', formatPercent(props.CONIFER)],
      ['Feuillus', formatPercent(props.BROADLEA)],
      ['Mixte', formatPercent(props.MIXED)],
      ['Agricole', formatPercent(props.AGRIAREAS)],
      ['Artificiel', formatPercent(props.ARTIFSURF)],
      ['Autres nat.', formatPercent(props.OTHERNATLC)],
    ] as Array<[string, string | null]>
  ).filter((row): row is [string, string] => row[1] !== null);

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
      <div style="margin-top:6px;font-size:11px;color:#6b7280;">Copernicus EFFIS — MODIS</div>
    </div>
  `;
}

function buildHotspotPopupHtml(props: EffisHotspotProperties): string {
  const location = [props.name_2, props.name_1]
    .filter(Boolean)
    .map((v) => escapeHtml(String(v)))
    .join(' · ');

  const moment =
    props.night === 'Night'
      ? 'Nuit'
      : props.night === 'Day'
        ? 'Jour'
        : '—';

  const confidenceLabels: Record<string, string> = {
    High: 'Élevée',
    Nominal: 'Nominale',
    Low: 'Faible',
  };
  const confidence = props.confidence
    ? (confidenceLabels[props.confidence] ?? escapeHtml(props.confidence))
    : '—';

  return `
    <div class="effis-hotspot-popup" style="min-width:210px;font-size:13px;line-height:1.35;">
      <div style="font-weight:700;margin-bottom:6px;">Point de chaleur EFFIS</div>
      <div><strong>Détection :</strong> ${formatDateLabel(props.acq_at)} UTC</div>
      ${location ? `<div><strong>Lieu :</strong> ${location}</div>` : ''}
      <div><strong>Puissance :</strong> ${formatFrp(props.frp)}</div>
      <div><strong>Confiance :</strong> ${confidence}</div>
      <div><strong>Satellite :</strong> ${props.satellite ? escapeHtml(props.satellite) : '—'}</div>
      <div><strong>Moment :</strong> ${moment}</div>
      <div style="margin-top:6px;font-size:11px;color:#6b7280;">
        Copernicus EFFIS / GWIS — précision ~375 m à 1 km
      </div>
    </div>
  `;
}

/** Début du jour UTC contenant `date` */
function startOfUtcDay(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Cache des détections en mode historique, une entrée par jour rejoué.
 *
 * Sans lui, parcourir une semaine au pas horaire déclencherait 168 requêtes pour
 * 7 journées de données. Chaque entrée couvre [début du jour − 24 h, fin du jour],
 * soit le sur-ensemble de toutes les fenêtres glissantes de 24 h se terminant dans
 * la journée : le filtrage fin se fait ensuite côté client, sans nouvelle requête.
 *
 * Le cache ne sert QUE le mode historique : le temps réel doit rester frais.
 */
const hotspotsDayCache = new Map<string, Promise<GeoJSON.Feature[]>>();
const HOTSPOTS_DAY_CACHE_MAX_ENTRIES = 8;

async function fetchHotspotsDayBucket(
  mapBounds: MapBounds,
  referenceDate: Date
): Promise<GeoJSON.Feature[]> {
  const dayStart = startOfUtcDay(referenceDate);
  const cacheKey = `${dayStart.toISOString().slice(0, 10)}|${getBboxParam(mapBounds)}`;

  const cached = hotspotsDayCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bucketStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const bucketEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const wfsUrl = new URL(EFFIS_GWIS_BASE_URL);
  wfsUrl.searchParams.set('SERVICE', 'WFS');
  wfsUrl.searchParams.set('VERSION', '1.1.0');
  wfsUrl.searchParams.set('REQUEST', 'GetFeature');
  wfsUrl.searchParams.set('TYPENAME', EFFIS_HOTSPOTS_TYPENAME);
  wfsUrl.searchParams.set('OUTPUTFORMAT', 'geojson');
  wfsUrl.searchParams.set(
    'FILTER',
    '<Filter xmlns="http://www.opengis.net/ogc"><And>' +
      '<BBOX><PropertyName>msGeometry</PropertyName>' +
      `<Box srsName="EPSG:4326"><coordinates>${getBboxCoordinates(mapBounds)}</coordinates></Box></BBOX>` +
      '<PropertyIsBetween><PropertyName>acq_at</PropertyName>' +
      `<LowerBoundary><Literal>${escapeXml(formatWfsDateTime(bucketStart))}</Literal></LowerBoundary>` +
      `<UpperBoundary><Literal>${escapeXml(formatWfsDateTime(bucketEnd))}</Literal></UpperBoundary>` +
      '</PropertyIsBetween></And></Filter>'
  );

  /*
   * Volontairement sans AbortSignal : la promesse est partagée entre appelants, et
   * l'annulation de l'un tuerait la requête des autres. Un appelant qui n'a plus
   * besoin du résultat l'ignore simplement.
   */
  const pending = fetchGeoJson(wfsUrl, 'points de chaleur (historique)')
    .then((collection) => collection.features)
    .catch((error) => {
      // Ne pas empoisonner le cache avec un échec : la journée sera retentée.
      hotspotsDayCache.delete(cacheKey);
      throw error;
    });

  hotspotsDayCache.set(cacheKey, pending);

  if (hotspotsDayCache.size > HOTSPOTS_DAY_CACHE_MAX_ENTRIES) {
    const oldestKey = hotspotsDayCache.keys().next().value;
    if (oldestKey !== undefined) {
      hotspotsDayCache.delete(oldestKey);
    }
  }

  return pending;
}

/** Vide le cache historique — utile aux tests et à un changement d'emprise. */
export function clearHotspotsDayCache(): void {
  hotspotsDayCache.clear();
}

async function fetchGeoJson(
  url: URL,
  label: string,
  signal?: AbortSignal
): Promise<GeoJSON.FeatureCollection> {
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Erreur WFS EFFIS ${label}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data?.features)) {
    throw new Error(`Réponse WFS EFFIS ${label} inattendue : "features" absent`);
  }
  return data as GeoJSON.FeatureCollection;
}

/**
 * Charge les points de chaleur sur l'emprise de l'instance, pour la période demandée.
 * Les sources permanentes sont écartées silencieusement (voir isPermanentSource).
 */
export async function createEffisHotspotsGeoJSONLayer(
  mapBounds: MapBounds,
  period: HotspotPeriod,
  options: HotspotLayerOptions = {}
): Promise<EffisHotspotsLayerResult> {
  const { renderer, referenceDate, signal } = options;

  let sourceFeatures: GeoJSON.Feature[];

  if (referenceDate) {
    // Mode historique : on passe par le cache journalier puis on découpe la fenêtre
    // exacte côté client, ce qui rend le déplacement dans la timeline instantané.
    const bucket = await fetchHotspotsDayBucket(mapBounds, referenceDate);
    const windowStart =
      referenceDate.getTime() - HOTSPOT_PERIOD_HOURS[period] * 60 * 60 * 1000;
    const windowEnd = referenceDate.getTime();
    sourceFeatures = bucket.filter((feature) => {
      const props = (feature.properties ?? {}) as EffisHotspotProperties;
      if (!props.acq_at) return false;
      const acquired = Date.parse(`${props.acq_at.replace(' ', 'T')}Z`);
      return (
        !Number.isNaN(acquired) && acquired > windowStart && acquired <= windowEnd
      );
    });
  } else {
    const wfsUrl = new URL(EFFIS_GWIS_BASE_URL);
    wfsUrl.searchParams.set('SERVICE', 'WFS');
    wfsUrl.searchParams.set('VERSION', '1.1.0');
    wfsUrl.searchParams.set('REQUEST', 'GetFeature');
    wfsUrl.searchParams.set('TYPENAME', EFFIS_HOTSPOTS_TYPENAME);
    wfsUrl.searchParams.set('OUTPUTFORMAT', 'geojson');
    wfsUrl.searchParams.set('FILTER', buildHotspotsFilter(mapBounds, period));

    const geoJsonData = await fetchGeoJson(wfsUrl, 'points de chaleur', signal);
    sourceFeatures = geoJsonData.features;
  }

  if (sourceFeatures.length >= HOTSPOTS_VOLUME_WARN_THRESHOLD) {
    console.warn(
      `EFFIS points de chaleur : volume inhabituel (${sourceFeatures.length} détections) — vérifier l'emprise et la période`
    );
  }

  const reference = referenceDate ?? new Date();

  let maskedOut = 0;
  const retained = sourceFeatures.filter((feature) => {
    const props = (feature.properties ?? {}) as EffisHotspotProperties;
    if (isPermanentSource(props)) {
      maskedOut += 1;
      return false;
    }
    return true;
  });

  let maxFrp = 0;
  let latestAcquisition: string | null = null;
  for (const feature of retained) {
    const props = (feature.properties ?? {}) as EffisHotspotProperties;
    const frp = Number.parseFloat(props.frp ?? '');
    if (!Number.isNaN(frp) && frp > maxFrp) {
      maxFrp = frp;
    }
    // `acq_at` est un format trié lexicographiquement (YYYY-MM-DD HH:mm:ss)
    if (props.acq_at && (!latestAcquisition || props.acq_at > latestAcquisition)) {
      latestAcquisition = props.acq_at;
    }
  }

  const layer = L.geoJSON(
    { type: 'FeatureCollection', features: retained } as GeoJSON.GeoJsonObject,
    {
      pane: 'overlayPane',
      attribution: 'Copernicus EFFIS',
      pointToLayer: (feature, latlng) => {
        const props = (feature.properties ?? {}) as EffisHotspotProperties;
        return L.circleMarker(
          latlng,
          getHotspotMarkerStyle(props, reference, renderer)
        );
      },
      onEachFeature: (feature, mapLayer) => {
        const props = (feature.properties ?? {}) as EffisHotspotProperties;
        mapLayer.bindPopup(buildHotspotPopupHtml(props), {
          maxWidth: 280,
          className: 'effis-hotspot-popup',
        });
      },
    }
  );

  return {
    layer,
    stats: {
      displayed: retained.length,
      maskedOut,
      maxFrp,
      latestAcquisition,
    },
  };
}

/**
 * Charge les zones brûlées MODIS sur l'emprise de l'instance, pour la période demandée.
 */
export async function createEffisBurnedAreasGeoJSONLayer(
  mapBounds: MapBounds,
  period: BurnedAreaPeriod,
  options: BurnedAreaLayerOptions = {}
): Promise<EffisBurnedAreasLayerResult> {
  const { referenceDate, signal } = options;

  const wfsUrl = new URL(EFFIS_WFS_BASE_URL);
  wfsUrl.searchParams.set('SERVICE', 'WFS');
  wfsUrl.searchParams.set('VERSION', '1.1.0');
  wfsUrl.searchParams.set('REQUEST', 'GetFeature');
  wfsUrl.searchParams.set(
    'TYPENAME',
    resolveBurnedAreasTypename(period, referenceDate)
  );
  wfsUrl.searchParams.set('BBOX', getBboxParam(mapBounds));
  wfsUrl.searchParams.set('OUTPUTFORMAT', 'geojson');

  const geoJsonData = await fetchGeoJson(wfsUrl, 'zones brûlées', signal);

  if (geoJsonData.features.length >= BURNED_AREAS_VOLUME_WARN_THRESHOLD) {
    console.warn(
      `EFFIS zones brûlées : volume inhabituel (${geoJsonData.features.length} polygones)`
    );
  }

  /**
   * Sur une archive annuelle, la couche couvre l'année entière : on borne au jour de
   * référence pour ne pas montrer des feux postérieurs à la date rejouée.
   */
  const features = referenceDate
    ? geoJsonData.features.filter((feature) => {
        const props = (feature.properties ?? {}) as EffisBurnedAreaProperties;
        if (!props.FIREDATE) return true;
        return props.FIREDATE.slice(0, 10) <= formatWfsDate(referenceDate);
      })
    : geoJsonData.features;

  let totalAreaHa = 0;
  let latestFireDate: string | null = null;
  for (const feature of features) {
    const props = (feature.properties ?? {}) as EffisBurnedAreaProperties;
    const area = Number.parseFloat(props.AREA_HA ?? '');
    if (!Number.isNaN(area)) {
      totalAreaHa += area;
    }
    if (props.FIREDATE && (!latestFireDate || props.FIREDATE > latestFireDate)) {
      latestFireDate = props.FIREDATE;
    }
  }

  const layer = L.geoJSON(
    { type: 'FeatureCollection', features } as GeoJSON.GeoJsonObject,
    {
      style: burnedAreaStyle,
      pane: 'overlayPane',
      attribution: 'Copernicus EFFIS',
      onEachFeature: (feature, mapLayer) => {
        const props = (feature.properties ?? {}) as EffisBurnedAreaProperties;
        mapLayer.bindPopup(buildBurnedAreaPopupHtml(props), {
          maxWidth: 320,
          className: 'effis-burned-area-popup',
        });

        mapLayer.on({
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
    }
  );

  return {
    layer,
    stats: {
      displayed: features.length,
      totalAreaHa,
      latestFireDate,
    },
  };
}

/**
 * La date à partir de laquelle les points de chaleur ne sont plus disponibles.
 * Le mode historique s'en sert pour signaler la limite de rétention plutôt que
 * d'afficher une couche vide sans explication.
 */
export function getHotspotsRetentionStart(reference: Date = new Date()): Date {
  return new Date(
    reference.getTime() - EFFIS_HOTSPOTS_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
}

export function isWithinHotspotsRetention(
  date: Date,
  reference: Date = new Date()
): boolean {
  return date.getTime() >= getHotspotsRetentionStart(reference).getTime();
}

/** Métadonnées du masque, affichées en légende pour expliquer les points écartés */
export const fireMaskInfo = {
  cellCount: recurrenceMask.cells.length,
  thresholdDays: recurrenceMask.thresholdDays,
  generatedAt: recurrenceMask.generatedAt,
};
