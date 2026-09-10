import { useEffect } from "react";
import type { RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { BaseLayerKey } from "../../../constants/mapLayers";

/** Fonds dont l'imagerie est sombre : les surfaces de verre doivent s'opacifier */
const DARK_BASE_LAYERS: readonly BaseLayerKey[] = ["Satellite IGN"];

/**
 * Publie sur la colonne carte deux indices consommés par les surfaces de verre
 * (voir les règles `[data-basemap]` et `[data-map-moving]` dans index.css).
 *
 * - `data-basemap="satellite"` : le chrome ne bascule pas de thème quand le fond
 *   devient sombre, c'est l'opacité qui compense. Une UI qui s'inverse au
 *   changement de fond désoriente et double la surface de tokens.
 * - `data-map-moving="true"` : pendant un déplacement, l'arrière-plan change à
 *   chaque frame et `backdrop-filter` impose une relecture par frame. Couper le
 *   flou à ce moment précis est la mitigation de performance à plus fort
 *   rendement, et elle est invisible car la surface s'opacifie simultanément.
 */
export const useMapSurfaceHints = (
  columnRef: RefObject<HTMLElement | null>,
  mapRef: RefObject<LeafletMap | null>,
  currentBaseLayer: BaseLayerKey,
  /**
   * Compteur incrémenté quand l'instance Leaflet devient disponible.
   *
   * Indispensable : l'identité d'une ref ne change jamais, donc un effet qui ne
   * dépend que de `mapRef` s'exécute une seule fois au montage — moment où
   * `mapRef.current` est encore nul — et n'attacherait jamais les écouteurs.
   */
  mapReadyVersion: number
): void => {
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    column.dataset.basemap = DARK_BASE_LAYERS.includes(currentBaseLayer)
      ? "satellite"
      : "light";
  }, [columnRef, currentBaseLayer]);

  useEffect(() => {
    const column = columnRef.current;
    const map = mapRef.current;
    if (!column || !map) return;

    const start = () => {
      column.dataset.mapMoving = "true";
    };
    const stop = () => {
      delete column.dataset.mapMoving;
    };

    map.on("movestart", start);
    map.on("zoomstart", start);
    map.on("moveend", stop);
    map.on("zoomend", stop);
    return () => {
      map.off("movestart", start);
      map.off("zoomstart", start);
      map.off("moveend", stop);
      map.off("zoomend", stop);
      stop();
    };
  }, [columnRef, mapRef, mapReadyVersion]);
};
