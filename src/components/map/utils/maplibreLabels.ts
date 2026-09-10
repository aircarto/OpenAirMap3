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
 * Applique un facteur d'échelle à une valeur `text-size`.
 *
 * On ne peut pas simplement envelopper l'expression dans `['*', expr, scale]` :
 * MapLibre n'autorise `['zoom']` qu'en entrée directe d'un `step`/`interpolate`
 * de premier niveau. Le facteur est donc appliqué aux valeurs de sortie
 * (stops) de l'expression, pas à l'expression elle-même.
 *
 * Renvoie `null` quand la valeur n'est pas reconnue et dépend du zoom : mieux
 * vaut laisser la taille d'origine qu'émettre un style invalide.
 */
const scaleTextSize = (value: unknown, scale: number): unknown | null => {
  if (typeof value === 'number') return value * scale;

  if (Array.isArray(value)) {
    const [operator] = value;

    // ['interpolate', interpolation, input, stop, output, stop, output, …]
    if (
      operator === 'interpolate' ||
      operator === 'interpolate-hcl' ||
      operator === 'interpolate-lab'
    ) {
      const head = value.slice(0, 3);
      const stops = value.slice(3);
      const scaled: unknown[] = [];
      for (let i = 0; i < stops.length; i += 2) {
        const output = scaleTextSize(stops[i + 1], scale);
        if (output === null) return null;
        scaled.push(stops[i], output);
      }
      return [...head, ...scaled];
    }

    // ['step', input, defaultOutput, stop, output, stop, output, …]
    if (operator === 'step') {
      const fallback = scaleTextSize(value[2], scale);
      if (fallback === null) return null;
      const stops = value.slice(3);
      const scaled: unknown[] = [];
      for (let i = 0; i < stops.length; i += 2) {
        const output = scaleTextSize(stops[i + 1], scale);
        if (output === null) return null;
        scaled.push(stops[i], output);
      }
      return [value[0], value[1], fallback, ...scaled];
    }

    // Expression non reconnue : sûre à multiplier seulement sans ['zoom']
    return JSON.stringify(value).includes('"zoom"')
      ? null
      : ['*', value, scale];
  }

  // Style function historique : { base?, stops: [[zoom, size], …] }
  if (value && typeof value === 'object' && 'stops' in value) {
    const fn = value as { stops: [number, unknown][] };
    if (!Array.isArray(fn.stops)) return null;
    const stops: [number, unknown][] = [];
    for (const [stop, output] of fn.stops) {
      const scaled = scaleTextSize(output, scale);
      if (scaled === null) return null;
      stops.push([stop, scaled]);
    }
    return { ...fn, stops };
  }

  return null;
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
      const scaledSize = scaleTextSize(currentSize, PLACE_LABEL_SIZE_SCALE);
      if (scaledSize !== null) {
        map.setLayoutProperty(
          layer.id,
          'text-size',
          scaledSize as ExpressionSpecification | number
        );
      }
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
