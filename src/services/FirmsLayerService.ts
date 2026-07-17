import L from "leaflet";
import { DOMAIN_CONFIG } from "../config/domainConfig";

const FIRMS_MAP_KEY = import.meta.env.VITE_FIRMS_MAP_KEY as string | undefined;
const FIRMS_WMS_BASE_URL = `https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/${FIRMS_MAP_KEY}/`;
const FIRMS_LAYER_NAME = "fires_viirs_7";

/** Emprise région Sud — Leaflet ne charge les tuiles WMS que dans ces bounds */
const REGION_SUD_BOUNDS = L.latLngBounds(DOMAIN_CONFIG.default.mapBounds);

/**
 * Indique si une cle NASA FIRMS est configuree (VITE_FIRMS_MAP_KEY)
 */
export function isFirmsLayerAvailable(): boolean {
  return Boolean(FIRMS_MAP_KEY);
}

/**
 * Cree un layer WMS Leaflet affichant les points chauds/incendies VIIRS des 7 derniers jours
 */
export function createFirmsWmsLayer(): L.TileLayer.WMS {
  return L.tileLayer.wms(FIRMS_WMS_BASE_URL, {
    layers: FIRMS_LAYER_NAME,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    attribution: "NASA FIRMS (VIIRS)",
    opacity: 0.85,
    minZoom: 1,
    maxZoom: 18,
    pane: "overlayPane",
    bounds: REGION_SUD_BOUNDS,
  });
}

/**
 * URL de la legende GetLegendGraphic pour la couche FIRMS affichee
 */
export function getFirmsLegendUrl(): string {
  return `${FIRMS_WMS_BASE_URL}?version=1.1.1&service=WMS&request=GetLegendGraphic&layer=${FIRMS_LAYER_NAME}&format=image/png&STYLE=default`;
}
