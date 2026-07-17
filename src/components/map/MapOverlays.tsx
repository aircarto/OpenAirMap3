import React from "react";
import BaseLayerControl from "../controls/BaseLayerControl";
import Legend from "./Legend";
import DeviceStatistics from "./DeviceStatistics";
import OverlayLegendsCard, {
  OverlayLegendItem,
  OverlayLegendsMobile,
} from "./OverlayLegendsPanel";

interface MapOverlaysProps {
  signalAir: any;
  t: (key: string) => string;
  sidePanels: any;
  currentBaseLayer: string;
  setCurrentBaseLayer: (layer: any) => void;
  isCommunalLayerEnabled: boolean;
  setIsCommunalLayerEnabled: (enabled: boolean) => void;
  isFirmsLayerEnabled: boolean;
  setIsFirmsLayerEnabled: (enabled: boolean) => void;
  isEffisHotspotsEnabled: boolean;
  setIsEffisHotspotsEnabled: (enabled: boolean) => void;
  isEffisBurnedAreasEnabled: boolean;
  setIsEffisBurnedAreasEnabled: (enabled: boolean) => void;
  isWildfireVisible: boolean;
  setIsWildfireLayerEnabledByControl: (enabled: boolean) => void;
  shouldShowStandardLegend: boolean;
  selectedPollutant: string;
  isComparisonPanelVisible: boolean;
  mapLayers: any;
  wildfire: any;
  visibleDevices: any[];
  visibleReports: any[];
  totalDevices: number;
  totalReports: number;
  selectedSources: string[];
  selectedTimeStep: string;
  historicalCurrentDate?: string;
  statistics: any;
  sourceStatistics: any;
}

const MapOverlays: React.FC<MapOverlaysProps> = ({
  signalAir,
  t,
  sidePanels,
  currentBaseLayer,
  setCurrentBaseLayer,
  isCommunalLayerEnabled,
  setIsCommunalLayerEnabled,
  isFirmsLayerEnabled,
  setIsFirmsLayerEnabled,
  isEffisHotspotsEnabled,
  setIsEffisHotspotsEnabled,
  isEffisBurnedAreasEnabled,
  setIsEffisBurnedAreasEnabled,
  isWildfireVisible,
  setIsWildfireLayerEnabledByControl,
  shouldShowStandardLegend,
  selectedPollutant,
  isComparisonPanelVisible,
  mapLayers,
  wildfire,
  visibleDevices,
  visibleReports,
  totalDevices,
  totalReports,
  selectedSources,
  selectedTimeStep,
  historicalCurrentDate,
  statistics,
  sourceStatistics,
}) => {
  const sidePanelOffset =
    sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden";

  const overlayLegendItems: OverlayLegendItem[] = [];

  if (mapLayers.currentModelingLegendUrl) {
    overlayLegendItems.push({
      id: "modeling",
      chipLabel: t("baseLayer.overlayLegendsModelingChip"),
      title:
        mapLayers.currentModelingLegendTitle ??
        t("baseLayer.overlayLegendsModelingChip"),
      imageUrl: mapLayers.currentModelingLegendUrl,
      accentClass: "bg-blue-50 text-blue-900 border-blue-200",
    });
  }

  if (mapLayers.currentFirmsLegendUrl) {
    overlayLegendItems.push({
      id: "firms",
      chipLabel: t("baseLayer.overlayLegendsFirmsChip"),
      title: t("baseLayer.firmsLegendTitle"),
      imageUrl: mapLayers.currentFirmsLegendUrl,
      accentClass: "bg-orange-50 text-orange-900 border-orange-200",
    });
  }

  if (mapLayers.currentEffisHotspotsLegendUrl) {
    overlayLegendItems.push({
      id: "effis-hotspots",
      chipLabel: t("baseLayer.overlayLegendsEffisHotspotsChip"),
      title: t("baseLayer.effisHotspotsLegendTitle"),
      imageUrl: mapLayers.currentEffisHotspotsLegendUrl,
      accentClass: "bg-orange-50 text-orange-900 border-orange-200",
    });
  }

  if (mapLayers.currentEffisBurnedAreasLegendUrl) {
    overlayLegendItems.push({
      id: "effis-burned",
      chipLabel: t("baseLayer.overlayLegendsEffisBurnedChip"),
      title: t("baseLayer.effisBurnedAreasLegendTitle"),
      imageUrl: mapLayers.currentEffisBurnedAreasLegendUrl,
      accentClass: "bg-amber-50 text-amber-900 border-amber-200",
    });
  }

  return (
    <>
      {signalAir.signalAirFeedback && (
        <div className="absolute top-24 right-4 z-[1000] max-w-sm bg-white border border-blue-200 text-blue-800 text-sm px-3 py-2 rounded-lg shadow-lg">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p>{signalAir.signalAirFeedback}</p>
            </div>
            <button
              type="button"
              onClick={signalAir.handleDismissSignalAirFeedback}
              className="text-blue-600 hover:text-blue-800"
              aria-label={t("panels.closeSignalAirMessage")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-20 left-4 z-[1000] flex flex-col space-y-2 transition-all duration-300 ${
          sidePanelOffset ? "hidden md:flex" : "flex"
        }`}
      >
        <BaseLayerControl
          currentBaseLayer={currentBaseLayer as any}
          onBaseLayerChange={setCurrentBaseLayer}
          isCommunalLayerEnabled={isCommunalLayerEnabled}
          onCommunalLayerToggle={setIsCommunalLayerEnabled}
          isFirmsLayerEnabled={isFirmsLayerEnabled}
          onFirmsLayerToggle={setIsFirmsLayerEnabled}
          isEffisHotspotsEnabled={isEffisHotspotsEnabled}
          onEffisHotspotsToggle={setIsEffisHotspotsEnabled}
          isEffisBurnedAreasEnabled={isEffisBurnedAreasEnabled}
          onEffisBurnedAreasToggle={setIsEffisBurnedAreasEnabled}
          isWildfireLayerEnabled={isWildfireVisible}
          onWildfireLayerToggle={setIsWildfireLayerEnabledByControl}
        />
      </div>

      {shouldShowStandardLegend && (
        <Legend
          selectedPollutant={selectedPollutant}
          isSidePanelOpen={sidePanels.isSidePanelOpen}
          panelSize={sidePanels.panelSize}
          isComparisonPanelVisible={
            isComparisonPanelVisible && sidePanels.panelSize !== "hidden"
          }
        />
      )}

      <OverlayLegendsMobile
        items={overlayLegendItems}
        sidePanelOffset={sidePanelOffset}
      />

      {isWildfireVisible &&
        wildfire.wildfireLoading &&
        wildfire.wildfireReports.length === 0 && (
          <div className="absolute top-24 right-4 z-[1000] max-w-xs bg-white border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-md shadow-lg">
            {t("panels.loadingFireReports")}
          </div>
        )}

      {isWildfireVisible && wildfire.wildfireError && (
        <div className="absolute top-36 right-4 z-[1000] max-w-xs bg-white border border-red-200 text-red-700 text-xs px-3 py-2 rounded-md shadow-lg">
          {wildfire.wildfireError}
        </div>
      )}

      {/* Colonne droite desktop : légendes au-dessus des stats, sans chevauchement */}
      <div
        className={`absolute ${
          sidePanelOffset ? "bottom-8 right-4" : "bottom-6 right-0"
        } z-[1000] hidden lg:flex flex-col gap-2 items-end max-h-[min(70vh,calc(100%-6rem))]`}
      >
        {overlayLegendItems.length > 0 && (
          <div className="min-h-0 overflow-y-auto shrink">
            <OverlayLegendsCard items={overlayLegendItems} />
          </div>
        )}
        <div className="bg-white px-3 py-2 rounded-md shadow-lg shrink-0">
          <DeviceStatistics
            visibleDevices={visibleDevices}
            visibleReports={visibleReports}
            totalDevices={totalDevices}
            totalReports={totalReports}
            selectedPollutant={selectedPollutant}
            selectedSources={selectedSources}
            selectedTimeStep={selectedTimeStep}
            historicalCurrentDate={historicalCurrentDate}
            statistics={statistics}
            sourceStatistics={sourceStatistics}
            showDetails={false}
          />
          {isWildfireVisible && wildfire.wildfireReports.length > 0 && (
            <div className="mt-1 text-xs text-gray-600">
              • {wildfire.wildfireReports.length} incendie
              {wildfire.wildfireReports.length > 1 ? "s" : ""} en cours
              {" "}
              <span className="text-gray-400">(feuxdeforet.fr)</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MapOverlays;
