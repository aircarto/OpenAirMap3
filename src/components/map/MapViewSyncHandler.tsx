import React, { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";

interface MapViewSyncHandlerProps {
  onViewChange?: (center: [number, number], zoom: number) => void;
}

const MapViewSyncHandler: React.FC<MapViewSyncHandlerProps> = ({
  onViewChange,
}) => {
  const hasInitialisedRef = useRef(false);
  const onViewChangeRef = useRef(onViewChange);

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
        return;
      }

      const map = event.target;
      const center = map.getCenter();
      const zoom = map.getZoom();

      onViewChangeRef.current([center.lat, center.lng], zoom);
    },
  });

  return null;
};

export default MapViewSyncHandler;
