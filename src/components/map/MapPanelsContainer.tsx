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
import MobileAirDetailPanel from "../panels/MobileAirDetailPanel";
import SignalAirDetailPanel from "../panels/SignalAirDetailPanel";
import type { TimeRange } from "../../utils/historicalTimeRange";

interface MapPanelsContainerProps {
  sidePanels: any;
  signalAir: any;
  mobileAir: any;
  selectedPollutant: string;
  isComparisonPanelVisible: boolean;
  handleRemoveStationFromComparison: (stationId: string) => void;
  handleLoadComparisonData: (
    stations: StationInfo[],
    pollutant: string,
    timeRange: TimeRange,
    timeStep: string
  ) => Promise<void>;
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
  isHistoricalModeActive?: boolean;
  historicalStartDate?: string;
  historicalEndDate?: string;
  historicalTimeStep?: string;
  historicalPlaybackDate?: string;
  selectedMobileAirSensors?: string[];
  mobileAirSensorVisibility?: Record<string, boolean>;
  mobileAirSensorStatus?: Record<string, string>;
  mobileAirSensorPeriods?: Record<string, { startDate: string; endDate: string }>;
  mobileAirDefaultPeriod?: { startDate: string; endDate: string };
  onMobileAirSensorRemove?: (sensorId: string) => void;
  onMobileAirSensorPeriodChange?: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  onMobileAirSensorVisibilityChange?: (sensorId: string, visible: boolean) => void;
}

const MapPanelsContainer: React.FC<MapPanelsContainerProps> = ({
  sidePanels,
  signalAir,
  mobileAir,
  selectedPollutant,
  isComparisonPanelVisible,
  handleRemoveStationFromComparison,
  handleLoadComparisonData,
  purpleAirDeviceData,
  isHistoricalModeActive = false,
  historicalStartDate,
  historicalEndDate,
  historicalTimeStep,
  historicalPlaybackDate,
  selectedMobileAirSensors = [],
  mobileAirSensorVisibility = {},
  mobileAirSensorStatus = {},
  mobileAirSensorPeriods = {},
  mobileAirDefaultPeriod = { startDate: "", endDate: "" },
  onMobileAirSensorRemove,
  onMobileAirSensorPeriodChange,
  onMobileAirSensorVisibilityChange,
}) => {
  const historicalMode =
    isHistoricalModeActive &&
    historicalStartDate &&
    historicalEndDate &&
    historicalTimeStep
      ? {
          startDate: historicalStartDate,
          endDate: historicalEndDate,
          timeStep: historicalTimeStep,
          currentDate: historicalPlaybackDate,
        }
      : null;

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
            historicalMode={historicalMode}
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
            historicalMode={historicalMode}
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
            historicalMode={historicalMode}
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
        onRouteSelect={mobileAir.focusRouteForDetail}
        loadedSensorIds={selectedMobileAirSensors}
        sensorVisibility={mobileAirSensorVisibility}
        sensorStatus={
          mobileAirSensorStatus as Record<
            string,
            import("../../constants/mobileAir").MobileAirSensorStatus
          >
        }
        sensorPeriods={mobileAirSensorPeriods}
        defaultPeriod={mobileAirDefaultPeriod}
        isSessionOnMap={mobileAir.isSessionOnMap}
        onSensorVisibilityChange={onMobileAirSensorVisibilityChange}
        onSensorRemove={onMobileAirSensorRemove}
        onSensorPeriodChange={onMobileAirSensorPeriodChange}
        onToggleSessionOnMap={mobileAir.toggleSessionOnMap}
        onSetSensorSessionsVisible={mobileAir.setSensorSessionsVisible}
      />
    </>
  );
};

export default MapPanelsContainer;
