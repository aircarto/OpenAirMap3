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
      // Vérifier si les valeurs ont réellement changé
      const centerChanged =
        !previousCenterRef.current ||
        previousCenterRef.current[0] !== center[0] ||
        previousCenterRef.current[1] !== center[1];
      const zoomChanged = previousZoomRef.current !== zoom;

      if (centerChanged || zoomChanged) {
        mapRef.current.setView(center, zoom);
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
