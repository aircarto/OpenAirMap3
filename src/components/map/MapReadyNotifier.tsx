import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface MapReadyNotifierProps {
  onReady: () => void;
}

/**
 * Notifie le parent dès que l'instance Leaflet est disponible (via useMap).
 * Nécessaire pour monter le fond Positron/OSM/IGN depuis useMapLayers.
 */
const MapReadyNotifier = ({ onReady }: MapReadyNotifierProps) => {
  const map = useMap();

  useEffect(() => {
    onReady();
  }, [map, onReady]);

  return null;
};

export default MapReadyNotifier;
