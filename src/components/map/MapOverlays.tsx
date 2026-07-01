import React from "react";
import { MapPinPlus, X } from "lucide-react";
import BaseLayerControl from "../controls/BaseLayerControl";
import Legend from "./Legend";
import DeviceStatistics from "./DeviceStatistics";

interface MapOverlaysProps {
  signalAir: any;
  signalements: any;
  t: (key: string) => string;
  sidePanels: any;
  currentBaseLayer: string;
  setCurrentBaseLayer: (layer: any) => void;
  isCommunalLayerEnabled: boolean;
  setIsCommunalLayerEnabled: (enabled: boolean) => void;
  shouldShowStandardLegend: boolean;
  selectedPollutant: string;
  isComparisonPanelVisible: boolean;
  mapLayers: any;
  wildfire: any;
  boats: any;
  planes: any;
  zones: any;
  /** Mode Scan : bateaux/avions ne sont disponibles que dans ce mode */
  isScanMode: boolean;
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
  signalements,
  t,
  sidePanels,
  currentBaseLayer,
  setCurrentBaseLayer,
  isCommunalLayerEnabled,
  setIsCommunalLayerEnabled,
  shouldShowStandardLegend,
  selectedPollutant,
  isComparisonPanelVisible,
  mapLayers,
  wildfire,
  boats,
  planes,
  zones,
  isScanMode,
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

      {/* Bandeau d'aide quand le mode « ajout de signalement » est actif */}
      {signalements?.enabled && signalements.placingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] flex items-center gap-2 bg-purple-600 text-white text-sm px-3 py-2 rounded-full shadow-lg">
          <MapPinPlus className="w-4 h-4 flex-shrink-0" />
          <span>{t("signalements.placingHint")}</span>
          <button
            type="button"
            onClick={signalements.stopPlacing}
            className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-white/20"
            aria-label={t("signalements.placingCancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className={`absolute bottom-20 left-4 z-[1000] flex flex-col space-y-2 transition-all duration-300 ${
          sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden"
            ? "hidden md:flex"
            : "flex"
        }`}
      >
        {/* Bouton « Nouveau signalement » : alternative découvrable au clic droit */}
        {signalements?.enabled && (
          <button
            type="button"
            onClick={signalements.togglePlacing}
            title={t("signalements.addButton")}
            aria-pressed={signalements.placingMode}
            className={`rounded-md p-2 shadow-sm border transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${
              signalements.placingMode
                ? "bg-purple-600 border-purple-600 text-white"
                : "bg-white/90 backdrop-blur-sm border-gray-200/50 text-purple-600 hover:border-gray-300/70"
            }`}
          >
            <div className="flex items-center justify-center">
              <MapPinPlus className="w-4 h-4" />
            </div>
          </button>
        )}

        <BaseLayerControl
          currentBaseLayer={currentBaseLayer as any}
          onBaseLayerChange={setCurrentBaseLayer}
          isCommunalLayerEnabled={isCommunalLayerEnabled}
          onCommunalLayerToggle={setIsCommunalLayerEnabled}
          isBoatLayerAvailable={boats.isBoatLayerEnabled && isScanMode}
          isBoatLayerVisible={boats.isBoatLayerVisible}
          onBoatLayerToggle={boats.setIsBoatLayerVisible}
          isPlaneLayerAvailable={planes.isPlaneLayerEnabled && isScanMode}
          isPlaneLayerVisible={planes.isPlaneLayerVisible}
          onPlaneLayerToggle={planes.setIsPlaneLayerVisible}
          zonesVisible={zones.visible}
          zonesLoading={zones.loading}
          onZoneToggle={zones.toggle}
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

      {mapLayers.currentModelingLegendUrl && (
        <div
          className={`absolute hidden lg:block ${
            sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden"
              ? "bottom-28 right-4"
              : "bottom-24 right-0"
          } z-[1000] transition-all duration-300`}
        >
          <div className="bg-white px-3 py-2 rounded-md shadow-lg border border-gray-200/70">
            <p className="text-xs text-gray-600 font-medium mb-1 whitespace-pre-line">
              {mapLayers.currentModelingLegendTitle ?? "Légende modélisation"}
            </p>
            <img
              src={mapLayers.currentModelingLegendUrl}
              alt="Légende de la couche de modélisation"
              className="max-h-32 w-auto"
            />
          </div>
        </div>
      )}

      {wildfire.isWildfireLayerEnabled &&
        wildfire.wildfireLoading &&
        wildfire.wildfireReports.length === 0 && (
          <div className="absolute top-24 right-4 z-[1000] max-w-xs bg-white border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-md shadow-lg">
            {t("panels.loadingFireReports")}
          </div>
        )}

      {boats.isBoatLayerEnabled &&
        boats.isBoatLayerVisible &&
        boats.boatLoading &&
        boats.boatTracks.length === 0 && (
          <div className="absolute top-48 right-4 z-[1000] max-w-xs bg-white border border-sky-200 text-sky-700 text-xs px-3 py-2 rounded-md shadow-lg">
            {t("boats.loadingTracks")}
          </div>
        )}

      {boats.isBoatLayerEnabled &&
        boats.isBoatLayerVisible &&
        boats.boatError && (
          <div className="absolute top-60 right-4 z-[1000] max-w-xs bg-white border border-red-200 text-red-700 text-xs px-3 py-2 rounded-md shadow-lg">
            {boats.boatError}
          </div>
        )}

      <div
        className={`absolute ${
          sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden"
            ? "bottom-8 right-4 hidden lg:block"
            : "bottom-6 right-0 hidden lg:block"
        } bg-white px-3 py-2 rounded-md shadow-lg z-[1000] transition-all duration-300`}
      >
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
        {wildfire.isWildfireLayerEnabled && wildfire.wildfireReports.length > 0 && (
          <div className="mt-1 text-xs text-gray-600">
            • {wildfire.wildfireReports.length} incendie
            {wildfire.wildfireReports.length > 1 ? "s" : ""} en cours
          </div>
        )}
        {boats.isBoatLayerEnabled &&
          boats.isBoatLayerVisible &&
          boats.boatTracks.length > 0 && (
            <div className="mt-1 text-xs text-gray-600">
              • {t("boats.trackedCount", { count: boats.boatTracks.length })}
            </div>
          )}
      </div>
    </>
  );
};

export default MapOverlays;
