import React, { useMemo } from "react";
import Legend from "./Legend";
import SensorPromoCard from "./SensorPromoCard";
import NotificationStack from "./notifications/NotificationStack";
import { compactNotices, type Notice } from "./notifications/notice";
import DeviceStatistics from "./DeviceStatistics";
import OverlayLegendsCard, {
  OverlayLegendItem,
  OverlayLegendsMobile,
} from "./OverlayLegendsPanel";
import {
  EffisBurnedAreasLegend,
  EffisHotspotsLegend,
} from "./FireLegends";
import {
  BurnedAreaPeriod,
  HotspotPeriod,
} from "../../services/EffisLayerService";

interface MapOverlaysProps {
  signalAir: any;
  /** Notices de niveau application, à fusionner avec celles des couches */
  appNotices: Notice[];
  /** Encart promotionnel, ou null si la publicité est désactivée */
  promo: { shopUrl: string; hidden: boolean } | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  sidePanels: any;
  isEffisHotspotsEnabled: boolean;
  effisHotspotsPeriod: HotspotPeriod;
  isEffisBurnedAreasEnabled: boolean;
  effisBurnedAreasPeriod: BurnedAreaPeriod;
  /** Date rejouée antérieure à la rétention EFFIS de 365 jours */
  isHotspotsBeyondRetention: boolean;
  isWildfireVisible: boolean;
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
  appNotices,
  promo,
  t,
  sidePanels,
  isEffisHotspotsEnabled,
  effisHotspotsPeriod,
  isEffisBurnedAreasEnabled,
  effisBurnedAreasPeriod,
  isHotspotsBeyondRetention,
  isWildfireVisible,
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

  // Légendes feux : rendues localement, le style ne vient plus du serveur
  if (isEffisHotspotsEnabled) {
    overlayLegendItems.push({
      id: "effis-hotspots",
      chipLabel: t("baseLayer.overlayLegendsEffisHotspotsChip"),
      title: t("baseLayer.effisHotspotsLegendTitle"),
      content: <EffisHotspotsLegend />,
      accentClass: "bg-orange-50 text-orange-900 border-orange-200",
    });
  }

  if (isEffisBurnedAreasEnabled) {
    overlayLegendItems.push({
      id: "effis-burned",
      chipLabel: t("baseLayer.overlayLegendsEffisBurnedChip"),
      title: t("baseLayer.effisBurnedAreasLegendTitle"),
      content: <EffisBurnedAreasLegend />,
      accentClass: "bg-amber-50 text-amber-900 border-amber-200",
    });
  }

  const hotspotsStats = mapLayers.effisHotspotsStats;
  const burnedAreasStats = mapLayers.effisBurnedAreasStats;

  /**
   * Une couche activée qui ne renvoie rien doit le dire. `today` en zones brûlées
   * est très souvent vide (MODIS met plusieurs jours à cartographier un périmètre),
   * et la vue 24 h des points de chaleur peut l'être un jour calme : sans message,
   * l'utilisateur conclut à une panne.
   */
  const showHotspotsEmpty =
    isEffisHotspotsEnabled &&
    !isHotspotsBeyondRetention &&
    !mapLayers.isEffisHotspotsLoading &&
    !mapLayers.effisHotspotsError &&
    hotspotsStats?.displayed === 0;

  const showBurnedAreasEmpty =
    isEffisBurnedAreasEnabled &&
    !mapLayers.isEffisBurnedAreasLoading &&
    !mapLayers.effisBurnedAreasError &&
    burnedAreasStats?.displayed === 0;

  // Notices de couches, concaténées à celles de niveau application. Auparavant
  // dix blocs absolus posés à la main sur top-24/32/36/40, dont trois
  // partageaient top-32 et trois top-40 : ils se recouvraient dès que deux
  // couches feux chargeaient ensemble.
  const notices = useMemo<Notice[]>(
    () =>
      compactNotices([
        ...appNotices,
        signalAir.signalAirFeedback && {
          id: "signalair-feedback",
          tone: "info" as const,
          message: signalAir.signalAirFeedback,
          onDismiss: signalAir.handleDismissSignalAirFeedback,
          dismissLabel: t("panels.closeSignalAirMessage"),
        },
        isWildfireVisible &&
          wildfire.wildfireLoading &&
          wildfire.wildfireReports.length === 0 && {
            id: "wildfire-loading",
            tone: "warn" as const,
            busy: true,
            message: t("panels.loadingFireReports"),
          },
        isWildfireVisible &&
          wildfire.wildfireError && {
            id: "wildfire-error",
            tone: "error" as const,
            message: wildfire.wildfireError,
          },
        isEffisHotspotsEnabled &&
          mapLayers.isEffisHotspotsLoading && {
            id: "effis-hotspots-loading",
            tone: "warn" as const,
            busy: true,
            message: t("panels.loadingEffisHotspots"),
          },
        isEffisHotspotsEnabled &&
          isHotspotsBeyondRetention && {
            id: "effis-hotspots-retention",
            tone: "warn" as const,
            message: t("panels.effisHotspotsBeyondRetention"),
          },
        isEffisHotspotsEnabled &&
          mapLayers.effisHotspotsError && {
            id: "effis-hotspots-error",
            tone: "error" as const,
            message: t("panels.effisHotspotsError"),
          },
        showHotspotsEmpty && {
          id: "effis-hotspots-empty",
          tone: "neutral" as const,
          message: t("panels.effisHotspotsEmpty", {
            period: t(
              effisHotspotsPeriod === "24h"
                ? "baseLayer.firePeriod24h"
                : "baseLayer.firePeriod7d"
            ),
          }),
        },
        isEffisBurnedAreasEnabled &&
          mapLayers.isEffisBurnedAreasLoading && {
            id: "effis-burned-loading",
            tone: "warn" as const,
            busy: true,
            message: t("panels.loadingEffisBurnedAreas"),
          },
        isEffisBurnedAreasEnabled &&
          mapLayers.effisBurnedAreasError && {
            id: "effis-burned-error",
            tone: "error" as const,
            message: t("panels.effisBurnedAreasError"),
          },
        showBurnedAreasEmpty && {
          id: "effis-burned-empty",
          tone: "neutral" as const,
          message: t("panels.effisBurnedAreasEmpty"),
        },
      ]),
    [
      appNotices,
      signalAir.signalAirFeedback,
      signalAir.handleDismissSignalAirFeedback,
      isWildfireVisible,
      wildfire.wildfireLoading,
      wildfire.wildfireReports.length,
      wildfire.wildfireError,
      isEffisHotspotsEnabled,
      mapLayers.isEffisHotspotsLoading,
      mapLayers.effisHotspotsError,
      isHotspotsBeyondRetention,
      showHotspotsEmpty,
      effisHotspotsPeriod,
      isEffisBurnedAreasEnabled,
      mapLayers.isEffisBurnedAreasLoading,
      mapLayers.effisBurnedAreasError,
      showBurnedAreasEmpty,
      t,
    ]
  );

  return (
    <>
      {/* Zone haut-droite : la pile de notices, sous le contrôle de recherche.
          Le conteneur ne capte pas le pointeur, seules les notices le font. */}
      <div className="pointer-events-none absolute right-3 top-[4.5rem] z-notify flex w-[min(22rem,calc(100%-6rem))] flex-col items-end gap-2">
        <NotificationStack notices={notices} />
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

      {/* Colonne bas-droite : promo, légendes de couches, puis période et
          compteurs. Une seule colonne flex à la place de trois ancrages absolus
          qui se chevauchaient. */}
      <div
        className="pointer-events-none absolute bottom-7 right-3 z-map-info hidden max-h-[calc(100%-9rem)] flex-col items-end gap-2 overflow-y-auto lg:flex"
      >
        {promo && !promo.hidden && (
          <SensorPromoCard shopUrl={promo.shopUrl} hidden={false} />
        )}
        {overlayLegendItems.length > 0 && (
          <div className="pointer-events-auto min-h-0 shrink overflow-y-auto">
            <OverlayLegendsCard items={overlayLegendItems} />
          </div>
        )}
        <div className="glass-3 pointer-events-auto shrink-0 rounded-[var(--r-md)] px-3 py-2">
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

          {isEffisHotspotsEnabled && hotspotsStats && hotspotsStats.displayed > 0 && (
            <div className="mt-1 text-xs text-gray-600">
              •{" "}
              {t("statistics.effisHotspots", {
                count: hotspotsStats.displayed,
              })}{" "}
              <span className="text-gray-400">
                ({t(
                  effisHotspotsPeriod === "24h"
                    ? "baseLayer.firePeriod24h"
                    : "baseLayer.firePeriod7d"
                )}
                {hotspotsStats.maxFrp > 0 &&
                  ` · ${t("statistics.effisMaxPower", {
                    frp: hotspotsStats.maxFrp.toFixed(0),
                  })}`}
                )
              </span>
            </div>
          )}

          {isEffisBurnedAreasEnabled &&
            burnedAreasStats &&
            burnedAreasStats.displayed > 0 && (
              <div className="mt-1 text-xs text-gray-600">
                •{" "}
                {t("statistics.effisBurnedAreas", {
                  count: burnedAreasStats.displayed,
                })}{" "}
                <span className="text-gray-400">
                  ({t("statistics.effisBurnedTotal", {
                    hectares: Math.round(
                      burnedAreasStats.totalAreaHa
                    ).toLocaleString("fr-FR"),
                  })}
                  )
                </span>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default MapOverlays;
