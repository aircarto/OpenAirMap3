import { useEffect, useRef, useState } from "react";
import L from "leaflet";

interface UseMapViewProps {
  center: [number, number];
  zoom: number;
  spiderfyConfig: {
    enabled: boolean;
    autoSpiderfy: boolean;
    autoSpiderfyZoomThreshold: number;
  };
}

/** Tolérance anti-boucle setView ↔ moveend (dérive flottante Leaflet). */
const CENTER_EPS = 1e-7;

const centersDiffer = (
  a: [number, number] | null,
  b: [number, number]
): boolean => {
  if (!a) return true;
  return Math.abs(a[0] - b[0]) > CENTER_EPS || Math.abs(a[1] - b[1]) > CENTER_EPS;
};

export const useMapView = ({
  center,
  zoom,
  spiderfyConfig,
}: UseMapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const previousCenterRef = useRef<[number, number] | null>(null);
  const previousZoomRef = useRef<number | null>(null);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [isSpiderfyActive, setIsSpiderfyActive] = useState(false);

  // Effet pour mettre à jour la vue de la carte
  useEffect(() => {
    if (mapRef.current) {
      const centerChanged = centersDiffer(previousCenterRef.current, center);
      const zoomChanged = previousZoomRef.current !== zoom;

      if (centerChanged || zoomChanged) {
        mapRef.current.setView(center, zoom, { animate: false });
        previousCenterRef.current = center;
        previousZoomRef.current = zoom;
        setCurrentZoom(zoom);
      }
    }
  }, [center, zoom]);

  // Effet pour gérer l'activation automatique du spiderfier basée sur le zoom
  useEffect(() => {
    if (mapRef.current && spiderfyConfig.enabled) {
      const map = mapRef.current;
      const handleZoomEnd = () => {
        const currentZoomLevel = map.getZoom() || 0;
        setCurrentZoom(currentZoomLevel);

        // Activer le spiderfier si le zoom dépasse le seuil OU si autoSpiderfy est activé
        const shouldActivateSpiderfy = spiderfyConfig.autoSpiderfy
          ? currentZoomLevel >= spiderfyConfig.autoSpiderfyZoomThreshold
          : true; // Toujours actif si autoSpiderfy est désactivé mais spiderfier activé

        if (shouldActivateSpiderfy && !isSpiderfyActive) {
          setIsSpiderfyActive(true);
        } else if (!shouldActivateSpiderfy && isSpiderfyActive) {
          setIsSpiderfyActive(false);
        }
      };

      // Ajouter l'écouteur d'événement zoom
      map.on("zoomend", handleZoomEnd);

      // Nettoyer l'écouteur
      return () => {
        map.off("zoomend", handleZoomEnd);
      };
    }
  }, [
    spiderfyConfig.enabled,
    spiderfyConfig.autoSpiderfy,
    spiderfyConfig.autoSpiderfyZoomThreshold,
    isSpiderfyActive,
  ]);

  return {
    mapRef,
    currentZoom,
    isSpiderfyActive,
  };
};
