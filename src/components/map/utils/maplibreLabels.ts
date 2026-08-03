import type { Map as MaplibreMap, ExpressionSpecification } from 'maplibre-gl';

const FRENCH_TEXT_FIELD: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:fr'],
  ['get', 'name:latin'],
  ['get', 'name'],
];

/** Facteur de taille pour les toponymes de lieux (villes, pays…) */
const PLACE_LABEL_SIZE_SCALE = 0.82;

/** Couleur plus discrète que le noir Positron (#000) */
const PLACE_LABEL_COLOR = '#6b6b6b';

/** Opacité légère pour diminuer la présence visuelle */
const PLACE_LABEL_OPACITY = 0.85;

/**
 * Force les labels toponymiques en français (fallback latin / name).
 * Ignore les couches de type blason (text-field basé sur ref).
 */
export const applyFrenchLabels = (map: MaplibreMap): void => {
  const layers = map.getStyle()?.layers;
  if (!layers) return;

  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;

    const textField = layer.layout?.['text-field'];
    if (textField == null) continue;

    const serialized = JSON.stringify(textField);
    if (!serialized.includes('name')) continue;
    if (serialized.includes('"ref"') && !serialized.includes('"name')) continue;

    map.setLayoutProperty(layer.id, 'text-field', FRENCH_TEXT_FIELD);
  }
};

/**
 * Adoucit les labels de lieux (villes, villages, pays…) du style Positron :
 * taille réduite, gris, Regular à la place de Bold.
 */
export const softenPlaceLabels = (map: MaplibreMap): void => {
  const layers = map.getStyle()?.layers;
  if (!layers) return;

  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    // Couches place du style Positron OpenFreeMap : label_city, label_town, etc.
    if (!layer.id.startsWith('label_')) continue;

    const currentSize = map.getLayoutProperty(layer.id, 'text-size');
    if (currentSize != null) {
      map.setLayoutProperty(layer.id, 'text-size', [
        '*',
        currentSize as ExpressionSpecification | number,
        PLACE_LABEL_SIZE_SCALE,
      ]);
    }

    const currentFont = map.getLayoutProperty(layer.id, 'text-font') as
      | string[]
      | undefined;
    if (Array.isArray(currentFont)) {
      map.setLayoutProperty(
        layer.id,
        'text-font',
        currentFont.map((font) => font.replace(/Bold/g, 'Regular'))
      );
    }

    map.setPaintProperty(layer.id, 'text-color', PLACE_LABEL_COLOR);
    map.setPaintProperty(layer.id, 'text-opacity', PLACE_LABEL_OPACITY);
    map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(255,255,255,0.7)');
    map.setPaintProperty(layer.id, 'text-halo-width', 1);
  }
};

/**
 * Applique labels FR + style adouci dès que le style MapLibre est chargé.
 */
export const applyFrenchLabelsWhenReady = (map: MaplibreMap): void => {
  const apply = () => {
    applyFrenchLabels(map);
    softenPlaceLabels(map);
  };

  if (map.isStyleLoaded()) {
    apply();
    return;
  }

  map.once('load', apply);
};
