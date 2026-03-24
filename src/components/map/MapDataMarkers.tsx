import React from "react";
import L from "leaflet";
import CustomSpiderfiedMarkers from "./CustomSpiderfiedMarkers";
import MarkerWithTooltip from "./MarkerWithTooltip";
import MobileAirRoutes from "./MobileAirRoutes";
import CustomSpiderfiedSignalAirMarkers from "./CustomSpiderfiedSignalAirMarkers";

interface MapDataMarkersProps {
  sortedDevices: any[];
  spiderfyConfig: { enabled: boolean; autoSpiderfyZoomThreshold: number };
  createCustomIconWrapper: (device: any) => L.Icon;
  handleMarkerClick: (device: any) => void;
  getMarkerKeyWrapper: (device: any) => string;
  mapRef: React.RefObject<L.Map>;
  calculateZIndexOffset: (device: any) => number;
  isMobileAirVisible: boolean;
  mobileAir: any;
  selectedPollutant: string;
  handleMobileAirPointClickWrapper: (route: any, point: any) => void;
  handleMobileAirRouteClickWrapper: (route: any) => void;
  isSignalAirVisible: boolean;
  reports: any[];
  createSignalIconWrapper: (report: any) => L.Icon;
  handleSignalAirMarkerClickWrapper: (report: any) => void;
}

const MapDataMarkers: React.FC<MapDataMarkersProps> = ({
  sortedDevices,
  spiderfyConfig,
  createCustomIconWrapper,
  handleMarkerClick,
  getMarkerKeyWrapper,
  mapRef,
  calculateZIndexOffset,
  isMobileAirVisible,
  mobileAir,
  selectedPollutant,
  handleMobileAirPointClickWrapper,
  handleMobileAirRouteClickWrapper,
  isSignalAirVisible,
  reports,
  createSignalIconWrapper,
  handleSignalAirMarkerClickWrapper,
}) => {
  const devicesWithoutMobileAir = sortedDevices.filter(
    (device) => device.source !== "mobileair"
  );

  return (
    <>
      {spiderfyConfig.enabled ? (
        <CustomSpiderfiedMarkers
          devices={devicesWithoutMobileAir}
          createCustomIcon={createCustomIconWrapper}
          handleMarkerClick={handleMarkerClick}
          enabled={spiderfyConfig.enabled}
          nearbyDistance={10}
          zoomThreshold={spiderfyConfig.autoSpiderfyZoomThreshold}
          getMarkerKey={getMarkerKeyWrapper}
          mapRef={mapRef}
        />
      ) : (
        devicesWithoutMobileAir.map((device) => (
          <MarkerWithTooltip
            key={getMarkerKeyWrapper(device)}
            device={device}
            position={[device.latitude, device.longitude]}
            icon={createCustomIconWrapper(device)}
            interactive={true}
            bubblingMouseEvents={true}
            minZoom={11}
            mapRef={mapRef as React.RefObject<L.Map>}
            zIndexOffset={calculateZIndexOffset(device)}
            eventHandlers={{ click: () => handleMarkerClick(device) }}
          />
        ))
      )}

      {isMobileAirVisible && (
        <MobileAirRoutes
          routes={mobileAir.activeMobileAirRoute ? [mobileAir.activeMobileAirRoute] : []}
          selectedPollutant={selectedPollutant}
          onPointClick={handleMobileAirPointClickWrapper}
          onPointHover={mobileAir.handleMobileAirPointHover}
          onRouteClick={handleMobileAirRouteClickWrapper}
          highlightedPoint={mobileAir.highlightedMobileAirPoint}
          hoveredPoint={mobileAir.hoveredMobileAirPoint}
        />
      )}

      {isSignalAirVisible && (
        <CustomSpiderfiedSignalAirMarkers
          reports={reports}
          createSignalIcon={createSignalIconWrapper}
          handleMarkerClick={handleSignalAirMarkerClickWrapper}
          enabled={spiderfyConfig.enabled}
          zoomThreshold={spiderfyConfig.autoSpiderfyZoomThreshold}
        />
      )}
    </>
  );
};

export default MapDataMarkers;
