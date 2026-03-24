import React from "react";
import {
  StationInfo,
  SignalAirReport,
  MobileAirRoute,
  MobileAirDataPoint,
} from "../../types";
import StationSidePanel from "../panels/StationSidePanel";
import MicroSidePanel from "../panels/MicroSidePanel";
import NebuleAirSidePanel from "../panels/NebuleAirSidePanel";
import SensorCommunitySidePanel from "../panels/SensorCommunitySidePanel";
import PurpleAirSidePanel from "../panels/PurpleAirSidePanel";
import ComparisonSidePanel from "../panels/ComparisonSidePanel";
import MobileAirSelectionPanel from "../panels/MobileAirSelectionPanel";
import MobileAirDetailPanel from "../panels/MobileAirDetailPanel";
import SignalAirSelectionPanel from "../panels/SignalAirSelectionPanel";
import SignalAirDetailPanel from "../panels/SignalAirDetailPanel";

interface MapPanelsContainerProps {
  sidePanels: any;
  signalAir: any;
  mobileAir: any;
  selectedPollutant: string;
  signalAirSelectedTypes: string[];
  signalAirPeriod: { startDate: string; endDate: string };
  onSignalAirTypesChange: (types: string[]) => void;
  onSignalAirPeriodChange: (startDate: string, endDate: string) => void;
  isSignalAirLoading: boolean;
  signalAirHasLoaded: boolean;
  signalAirReportsCount: number;
  isComparisonPanelVisible: boolean;
  handleRemoveStationFromComparison: (stationId: string) => void;
  handleLoadComparisonData: () => Promise<void>;
  purpleAirDeviceData: Record<
    string,
    {
      rssi: number;
      uptime: number;
      confidence: number;
      temperature: number;
      humidity: number;
      pm1Value: number;
      pm25Value: number;
      pm10Value: number;
    }
  >;
}

const MapPanelsContainer: React.FC<MapPanelsContainerProps> = ({
  sidePanels,
  signalAir,
  mobileAir,
  selectedPollutant,
  signalAirSelectedTypes,
  signalAirPeriod,
  onSignalAirTypesChange,
  onSignalAirPeriodChange,
  isSignalAirLoading,
  signalAirHasLoaded,
  signalAirReportsCount,
  isComparisonPanelVisible,
  handleRemoveStationFromComparison,
  handleLoadComparisonData,
  purpleAirDeviceData,
}) => {
  return (
    <>
      {sidePanels.comparisonState.isComparisonMode &&
        sidePanels.comparisonState.comparedStations.length > 0 &&
        sidePanels.panelSize !== "hidden" && (
          <ComparisonSidePanel
            isOpen={true}
            comparisonState={sidePanels.comparisonState}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            onRemoveStation={handleRemoveStationFromComparison}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            onLoadComparisonData={handleLoadComparisonData}
          />
        )}

      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "atmoRef" &&
        sidePanels.panelSize !== "hidden" && (
          <StationSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation as StationInfo}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            isComparisonMode={sidePanels.comparisonState.isComparisonMode}
          />
        )}

      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "atmoMicro" &&
        sidePanels.panelSize !== "hidden" && (
          <MicroSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation as StationInfo}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            isComparisonMode={sidePanels.comparisonState.isComparisonMode}
          />
        )}

      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "nebuleair" &&
        sidePanels.panelSize !== "hidden" && (
          <NebuleAirSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation as StationInfo}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            isComparisonMode={sidePanels.comparisonState.isComparisonMode}
          />
        )}

      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "sensorCommunity" &&
        sidePanels.panelSize !== "hidden" && (
          <SensorCommunitySidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation as StationInfo}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
          />
        )}

      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "purpleair" &&
        sidePanels.panelSize !== "hidden" && (
          <PurpleAirSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation as StationInfo}
            deviceData={
              sidePanels.selectedStation
                ? purpleAirDeviceData[sidePanels.selectedStation.id]
                : undefined
            }
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
          />
        )}

      <SignalAirDetailPanel
        isOpen={signalAir.isSignalAirDetailPanelOpen}
        report={signalAir.selectedSignalAirReport as SignalAirReport}
        onClose={signalAir.handleCloseSignalAirDetailPanel}
        onSizeChange={signalAir.handleSignalAirDetailPanelSizeChange}
        panelSize={signalAir.signalAirDetailPanelSize}
        onCenterMap={signalAir.handleCenterOnSignalAirReport}
      />

      <SignalAirSelectionPanel
        isOpen={signalAir.isSignalAirPanelOpen}
        selectedPollutant={selectedPollutant}
        selectedTypes={signalAirSelectedTypes}
        period={signalAirPeriod}
        onClose={signalAir.handleCloseSignalAirPanel}
        onTypesChange={onSignalAirTypesChange}
        onPeriodChange={onSignalAirPeriodChange}
        onLoadReports={signalAir.handleSignalAirLoad}
        onSizeChange={signalAir.handleSignalAirPanelSizeChange}
        onHidden={signalAir.handleSignalAirPanelHidden}
        panelSize={signalAir.signalAirPanelSize}
        isLoading={isSignalAirLoading}
        hasLoaded={signalAirHasLoaded}
        reportsCount={signalAirReportsCount}
      />

      <MobileAirSelectionPanel
        isOpen={mobileAir.isMobileAirSelectionPanelOpen}
        initialPollutant={selectedPollutant}
        onClose={mobileAir.handleCloseMobileAirSelectionPanel}
        onHidden={() => mobileAir.handleMobileAirSelectionPanelSizeChange("hidden")}
        onSizeChange={mobileAir.handleMobileAirSelectionPanelSizeChange}
        panelSize={mobileAir.mobileAirSelectionPanelSize}
        onSensorSelected={mobileAir.handleMobileAirSensorsSelected}
      />

      <MobileAirDetailPanel
        isOpen={mobileAir.isMobileAirDetailPanelOpen}
        selectedRoute={mobileAir.selectedMobileAirRoute as MobileAirRoute | null}
        activeRoute={mobileAir.activeMobileAirRoute as MobileAirRoute | null}
        allRoutes={mobileAir.mobileAirRoutes as MobileAirRoute[]}
        initialPollutant={selectedPollutant}
        highlightedPoint={mobileAir.highlightedMobileAirPoint as MobileAirDataPoint | null}
        onClose={mobileAir.handleCloseMobileAirDetailPanel}
        onHidden={() => mobileAir.handleMobileAirDetailPanelSizeChange("hidden")}
        onSizeChange={mobileAir.handleMobileAirDetailPanelSizeChange}
        panelSize={mobileAir.mobileAirDetailPanelSize}
        onPointHover={mobileAir.handleMobileAirPointHover}
        onPointHighlight={mobileAir.handleMobileAirPointHighlight}
        onRouteSelect={mobileAir.openMobileAirDetailPanelForRoute}
      />
    </>
  );
};

export default MapPanelsContainer;
