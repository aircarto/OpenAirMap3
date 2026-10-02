import React, { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";

export interface MapViewportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface MapViewSyncHandlerProps {
  onViewChange?: (
    center: [number, number],
    zoom: number,
    bounds: MapViewportBounds
  ) => void;
}

const MapViewSyncHandler: React.FC<MapViewSyncHandlerProps> = ({
  onViewChange,
}) => {
  const hasInitialisedRef = useRef(false);
  const onViewChangeRef = useRef(onViewChange);
  const lastSentRef = useRef<{ lat: number; lng: number; zoom: number } | null>(
    null
  );

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useMapEvents({
    moveend: (event) => {
      if (!onViewChangeRef.current) {
        return;
      }

      if (!hasInitialisedRef.current) {
        hasInitialisedRef.current = true;
        // Premier moveend : émettre aussi pour initialiser bbox MF
        const map = event.target;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const b = map.getBounds();
        lastSentRef.current = { lat: center.lat, lng: center.lng, zoom };
        onViewChangeRef.current([center.lat, center.lng], zoom, {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        });
        return;
      }

      const map = event.target;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const last = lastSentRef.current;
      // Évite une boucle moveend → setState → setView sur dérive flottante.
      if (
        last &&
        last.zoom === zoom &&
        Math.abs(last.lat - center.lat) < 1e-7 &&
        Math.abs(last.lng - center.lng) < 1e-7
      ) {
        return;
      }
      lastSentRef.current = { lat: center.lat, lng: center.lng, zoom };
      const b = map.getBounds();
      onViewChangeRef.current([center.lat, center.lng], zoom, {
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
  });

  return null;
};

export default MapViewSyncHandler;
