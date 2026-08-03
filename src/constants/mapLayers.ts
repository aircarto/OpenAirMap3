import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import { applyFrenchLabelsWhenReady } from '../components/map/utils/maplibreLabels';

export const BASE_LAYER_KEYS = [
  'Carte standard',
  'Carte OSM',
  'Satellite IGN',
] as const;

export type BaseLayerKey = (typeof BASE_LAYER_KEYS)[number];

const OPENFREEMAP_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const IGN_ATTRIBUTION = '&copy; <a href="https://www.ign.fr/">IGN</a>';

const BASE_LAYER_MAX_ZOOM: Record<BaseLayerKey, number> = {
  'Carte standard': 20,
  'Carte OSM': 19,
  'Satellite IGN': 19,
};

export const getBaseLayerMaxZoom = (key: BaseLayerKey): number =>
  BASE_LAYER_MAX_ZOOM[key] ?? 18;

const createPositronLayer = (): L.Layer => {
  const layer = L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/positron',
    // Le bridge lit customAttribution via getAttribution() (pas options.attribution)
    attributionControl: {
      customAttribution: OPENFREEMAP_ATTRIBUTION,
    },
  });

  // getMaplibreMap() n'existe qu'après onAdd — labels FR une fois la couche montée
  layer.once('add', () => {
    const glMap = layer.getMaplibreMap();
    if (glMap) {
      applyFrenchLabelsWhenReady(glMap);
    }
  });

  return layer;
};

/**
 * Crée une nouvelle instance de fond de carte pour la clé donnée.
 * À appeler à chaque bascule (ne pas réutiliser une ancienne instance MapLibre).
 */
export const createBaseLayer = (key: BaseLayerKey): L.Layer => {
  switch (key) {
    case 'Carte standard':
      return createPositronLayer();
    case 'Carte OSM':
      return L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: OSM_ATTRIBUTION,
          pane: 'tilePane',
          minZoom: 1,
          maxZoom: getBaseLayerMaxZoom(key),
        }
      );
    case 'Satellite IGN':
      return L.tileLayer(
        'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
        {
          attribution: IGN_ATTRIBUTION,
          pane: 'tilePane',
          minZoom: 1,
          maxZoom: getBaseLayerMaxZoom(key),
        }
      );
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
};

// Types de layers de modélisation
export type ModelingLayerType =
  | 'pollutant' // Modélisation polluant sélectionné
  | 'vent'; // Vent

export const modelingLayers: Record<ModelingLayerType, string> = {
  pollutant: 'Modélisation polluant sélectionné',
  vent: 'Vent',
};
