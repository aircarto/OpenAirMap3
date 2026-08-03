import type { Map as MaplibreMap, ExpressionSpecification } from 'maplibre-gl';

const FRENCH_TEXT_FIELD: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:fr'],
  ['get', 'name:latin'],
  ['get', 'name'],
];

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
 * Applique les labels FR dès que le style MapLibre est chargé.
 */
export const applyFrenchLabelsWhenReady = (map: MaplibreMap): void => {
  if (map.isStyleLoaded()) {
    applyFrenchLabels(map);
    return;
  }

  map.once('load', () => {
    applyFrenchLabels(map);
  });
};
