import React, { useEffect, useRef, useCallback } from "react";
import { Marker, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { MeasurementDevice } from "../../types";
import { useCustomSpiderfier } from "../../hooks/useCustomSpiderfier";
import MarkerWithTooltip from "./MarkerWithTooltip";
import { calculateZIndexOffset } from "./utils/mapIconUtils";

interface CustomSpiderfiedMarkersProps {
  devices: MeasurementDevice[];
  createCustomIcon: (device: MeasurementDevice) => any;
  handleMarkerClick: (device: MeasurementDevice) => void;
  enabled: boolean;
  nearbyDistance?: number;
  zoomThreshold?: number;
  getMarkerKey?: (device: MeasurementDevice) => string;
  sensorMetadataMap?: Map<string, {
    sensorModel?: string;
    sensorBrand?: string;
    measuredPollutants?: string[];
  }>;
  mapRef?: React.RefObject<L.Map | null>;
}

const CustomSpiderfiedMarkers: React.FC<CustomSpiderfiedMarkersProps> = ({
  devices,
  createCustomIcon,
  handleMarkerClick,
  enabled,
  nearbyDistance = 20,
  zoomThreshold = 12,
  getMarkerKey,
  sensorMetadataMap,
  mapRef,
}) => {
  const markerRefs = useRef<Map<string, any>>(new Map());
  const {
    getMarkerPosition,
    isMarkerSpiderfied,
    getSpiderfiedData,
    spiderfiedMarkers,
    groupCenters,
  } = useCustomSpiderfier({
    devices,
    enabled,
    nearbyDistance,
    zoomThreshold,
  });

  // Mettre à jour la position des marqueurs éclatés manuellement
  useEffect(() => {
    markerRefs.current.forEach((marker, deviceId) => {
      if (!marker) return;

      const device = devices.find((d) => d.id === deviceId);
      if (!device) return;

      const newPosition = getMarkerPosition(device);
      const leafletMarker = (marker as any).leafletElement || marker;

      if (!leafletMarker || typeof leafletMarker.setLatLng !== "function")
        return;

      const currentLatLng = leafletMarker.getLatLng();
      const newLatLng = L.latLng(newPosition[0], newPosition[1]);

      // Mettre à jour la position seulement si elle a changé
      if (!currentLatLng || !currentLatLng.equals(newLatLng)) {
        // Mettre à jour la position
        leafletMarker.setLatLng(newLatLng);
      }
    });
  }, [
    devices,
    getMarkerPosition,
    spiderfiedMarkers,
  ]);

  // Mémoriser les eventHandlers pour éviter les re-renders inutiles
  // Ce handler est utilisé pour les marqueurs NON-ÉCLATÉS (React-Leaflet eventHandlers)
  const clickHandler = useCallback(
    (device: MeasurementDevice) => (e: L.LeafletMouseEvent) => {
      // Ne pas utiliser stopPropagation pour permettre au click de se propager correctement
      handleMarkerClick(device);
    },
    [handleMarkerClick]
  );

  return (
    <>
      {/* Marqueurs normaux ou éclatés */}
      {devices.map((device) => {
        const position = getMarkerPosition(device);
        const isSpiderfied = isMarkerSpiderfied(device);
        const spiderfiedData = getSpiderfiedData(device);
        const markerKey = getMarkerKey ? getMarkerKey(device) : device.id;

        return (
          <React.Fragment key={markerKey}>
            <MarkerWithTooltip
              key={markerKey}
              device={device}
              position={position}
              icon={createCustomIcon(device)}
              interactive={true}
              bubblingMouseEvents={true}
              sensorMetadata={sensorMetadataMap?.get(device.id)}
              minZoom={11}
              mapRef={mapRef}
              zIndexOffset={calculateZIndexOffset(device)}
              eventHandlers={
                // Pour les marqueurs éclatés, on n'utilise pas les eventHandlers React-Leaflet
                // car ils ne fonctionnent pas correctement quand la position change
                // On utilise uniquement les eventHandlers Leaflet natifs attachés dans le useEffect
                isSpiderfied
                  ? {
                      // Pour les marqueurs éclatés, les handlers sont attachés via Leaflet natif dans le useEffect/ref
                      // On peut quand même ajouter des handlers React-Leaflet comme fallback
                      click: (e: L.LeafletMouseEvent) => {
                        handleMarkerClick(device);
                      },
                    }
                  : {
                      click: clickHandler(device),
                    }
              }
              // La gestion interne de la ref (marker Leaflet et tooltips) est faite par MarkerWithTooltip.
              // On garde une ref locale uniquement pour pouvoir ajuster la position via Leaflet.
              // @ts-expect-error MarkerWithTooltip ne déclare pas explicitement la prop ref dans ses props,
              // mais React.forwardRef/l'implémentation interne la supporte au runtime.
              ref={(marker) => {
                if (marker) {
                  markerRefs.current.set(device.id, marker);
                } else {
                  markerRefs.current.delete(device.id);
                }
              }}
            />

            {/* Trait de connexion pour les marqueurs éclatés */}
            {isSpiderfied && spiderfiedData && (
              <Polyline
                positions={[
                  spiderfiedData.originalPosition,
                  spiderfiedData.spiderfiedPosition,
                ]}
                color="#3388ff"
                weight={2}
                opacity={0.8}
                dashArray="5, 5"
                interactive={false}
                bubblingMouseEvents={false}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Points centraux pour indiquer l'emplacement initial des groupes éclatés */}
      {groupCenters.map(([groupIndex, centerPosition]) => (
        <CircleMarker
          key={`center-${groupIndex}`}
          center={centerPosition}
          radius={3}
          color="#3388ff"
          weight={1}
          opacity={0.6}
          fillColor="#3388ff"
          fillOpacity={0.4}
          interactive={false}
          bubblingMouseEvents={false}
        />
      ))}
    </>
  );
};

export default CustomSpiderfiedMarkers;
