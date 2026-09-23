import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  StationInfo,
  ChartControls,
  HistoricalDataPoint,
  ComparisonState,
} from "../../types";
import { pollutants } from "../../constants/pollutants";
import { MAX_COMPARISON_STATIONS } from "../../constants/comparison";
import { AtmoRefService } from "../../services/AtmoRefService";
import PanelChartBlock from "../charts/PanelChartBlock";
import ChartTimeControls from "../controls/ChartTimeControls";
import { getMaxHistoryDays, type TimeRange } from "../../utils/historicalTimeRange";
import { sources } from "../../constants/sources";
import SidePanelShell, {
  CHART_PANEL_BODY_CLASS,
  type PanelSize,
} from "./SidePanelShell";
import CollapsiblePanelSection from "./CollapsiblePanelSection";
import PanelReopenBadge from "./PanelReopenBadge";

interface ComparisonSidePanelProps {
  isOpen: boolean;
  comparisonState: ComparisonState;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange: (size: PanelSize) => void;
  onRemoveStation: (stationId: string) => void;
  onComparisonModeToggle: (pollutantToPreserve?: string) => void;
  onLoadComparisonData: (
    stations: StationInfo[],
    pollutant: string,
    timeRange: TimeRange,
    timeStep: string
  ) => Promise<void>;
  panelSize: PanelSize;
}

const COMPARISON_TIME_STEP_PRIORITY = ["heure", "quartHeure", "instantane", "jour"] as const;
const COMPARISON_TIME_STEP_OPTIONS = [
  { key: "instantane", labelKey: "timeStepScan" },
  { key: "quartHeure", labelKey: "timeStep15min" },
  { key: "heure", labelKey: "timeStep1h" },
  { key: "jour", labelKey: "timeStep1j" },
] as const;

const ComparisonSidePanel: React.FC<ComparisonSidePanelProps> = ({
  isOpen,
  comparisonState,
  onClose,
  onHidden,
  onSizeChange,
  onRemoveStation,
  onComparisonModeToggle,
  onLoadComparisonData,
  panelSize,
}) => {
  const { t } = useTranslation();
  const [showPollutantsList, setShowPollutantsList] = useState(false);
  const [hasCorrectedData, setHasCorrectedData] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const hasInitializedPollutant = useRef(false);

  // Fonction utilitaire pour vérifier si un polluant est disponible dans toutes les stations
  const isPollutantAvailableInAllStations = (
    pollutantCode: string
  ): boolean => {
    return comparisonState.comparedStations.every((station) => {
      return Object.entries(station.variables || {}).some(
        ([code, variable]) => {
          // Mapping des codes selon la source
          let mappedCode = code;
          if (station.source === "atmoRef") {
            // Pour AtmoRef, les clés sont des codes numériques ("01", "03", etc.)
            const atmoRefMapping: Record<string, string> = {
              "01": "so2",
              "03": "no2",
              "08": "o3",
              "24": "pm10",
              "39": "pm25",
              "68": "pm1",
            };
            mappedCode = atmoRefMapping[code] || code;
          }
          // Pour AtmoMicro, les clés sont déjà normalisées ("pm25", "pm10", etc.)
          // Pas besoin de mapping supplémentaire

          return mappedCode === pollutantCode && variable.en_service;
        }
      );
    });
  };

  // Fonction utilitaire pour obtenir les polluants disponibles dans toutes les stations
  const getAvailablePollutants = (): string[] => {
    if (comparisonState.comparedStations.length === 0) return [];

    return Object.entries(pollutants)
      .filter(([pollutantCode]) => {
        return isPollutantAvailableInAllStations(pollutantCode);
      })
      .map(([pollutantCode]) => pollutantCode);
  };

  // Vérifier si au moins une station est un microcapteur (atmoMicro)
  const hasAtmoMicroStation = (): boolean => {
    return comparisonState.comparedStations.some(
      (station) => station.source === "atmoMicro"
    );
  };

  // Vérifier si on peut afficher le bouton données brutes
  // Seulement si : au moins une station atmoMicro ET pas de temps = "heure"
  const canShowRawDataButton = (): boolean => {
    return hasAtmoMicroStation() && comparisonState.timeStep === "heure";
  };

  const getSupportedTimeStepsBySource = (sourceCode: string): string[] => {
    if (sourceCode === "atmoRef" || sourceCode === "atmoMicro") {
      return sources[sourceCode].supportedTimeSteps || [];
    }
    if (sourceCode === "nebuleair") {
      return (
        sources.communautaire.subSources?.nebuleair?.supportedTimeSteps || []
      );
    }
    // Comportement inchangé pour les sources inattendues en comparaison.
    return COMPARISON_TIME_STEP_OPTIONS.map(({ key }) => key);
  };

  const availableComparisonTimeSteps = useMemo(
    () =>
      comparisonState.comparedStations.reduce<string[]>(
        (commonSteps, station, index) => {
          const stationSupportedSteps = getSupportedTimeStepsBySource(station.source);
          if (index === 0) return stationSupportedSteps;
          return commonSteps.filter((timeStep) =>
            stationSupportedSteps.includes(timeStep)
          );
        },
        []
      ),
    [comparisonState.comparedStations]
  );

  const isTimeStepSupportedByComparedStations = useCallback(
    (timeStep: string): boolean => availableComparisonTimeSteps.includes(timeStep),
    [availableComparisonTimeSteps]
  );
  const getComparisonFallbackTimeStep = useCallback(
    (): string =>
      COMPARISON_TIME_STEP_PRIORITY.find((timeStep) =>
        isTimeStepSupportedByComparedStations(timeStep)
      ) || "heure",
    [isTimeStepSupportedByComparedStations]
  );

  // Premier chargement (aucune donnée à afficher) : écran de chargement plein.
  // Rechargements suivants : voile par-dessus le graphique, qui reste monté.
  // Le couple (données, pas de temps) est déjà cohérent ici : comparisonState
  // n'est mis à jour qu'au moment où les données sont appliquées
  // (createLoadComparisonDataHandler).
  const isInitialChartLoading =
    comparisonState.loading &&
    Object.keys(comparisonState.comparisonData).length === 0;
  // Les contrôles restent visibles sous le voile : les désactiver évite de
  // lancer un second chargement pendant qu'un autre est en cours.
  const chartControlsDisabled = comparisonState.loading;

  // Handler pour mettre à jour l'état des données corrigées
  const handleHasCorrectedDataChange = (hasCorrected: boolean) => {
    setHasCorrectedData(hasCorrected);
  };

  // Mettre à jour l'état quand les props changent
  useEffect(() => {
    if (isOpen && comparisonState.comparedStations.length > 0) {
      // Déterminer quels polluants sont disponibles dans toutes les stations
      const availablePollutants = getAvailablePollutants();

      // Vérifier si le polluant actuel est disponible
      const isCurrentPollutantAvailable = availablePollutants.includes(
        comparisonState.selectedPollutant
      );

      // Sélectionner le polluant : préserver le polluant actuel s'il est disponible,
      // sinon utiliser le premier disponible seulement lors de la première initialisation
      let selectedPollutant = comparisonState.selectedPollutant;
      
      if (!isCurrentPollutantAvailable) {
        // Le polluant actuel n'est pas disponible
        // On le change seulement si c'est la première initialisation (panel vient de s'ouvrir)
        // ou si on n'a pas encore initialisé le polluant
        if (!hasInitializedPollutant.current && availablePollutants.length > 0) {
          selectedPollutant = availablePollutants[0];
          hasInitializedPollutant.current = true;
        } else if (hasInitializedPollutant.current) {
          // Déjà initialisé mais le polluant n'est plus disponible (station ajoutée qui ne le supporte pas)
          // Dans ce cas, on doit changer pour un polluant disponible
          if (availablePollutants.length > 0) {
            selectedPollutant = availablePollutants[0];
          }
        }
      } else {
        // Le polluant actuel est disponible, on le garde
        hasInitializedPollutant.current = true;
      }

      // Vérifier si toutes les stations actuelles ont des données pour le polluant sélectionné
      const pollutantData = comparisonState.comparisonData[selectedPollutant] || {};
      const stationsWithData = Object.keys(pollutantData);
      const allStationsHaveData = comparisonState.comparedStations.every(
        (station) => stationsWithData.includes(station.id)
      );

      // Charger les données si on n'a pas de données pour toutes les stations
      if (selectedPollutant && !allStationsHaveData) {
        onLoadComparisonData(
          comparisonState.comparedStations,
          selectedPollutant,
          comparisonState.timeRange,
          comparisonState.timeStep
        );
      }

      // Réinitialiser la taille du panel
      // Réinitialiser l'état des données brutes
      setHasCorrectedData(false);
      setShowRawData(false);
    } else {
      // Réinitialiser le flag quand le panel se ferme
      if (!isOpen) {
        hasInitializedPollutant.current = false;
      }
    }
    // Dépendances limitées : éviter de relancer onLoadComparisonData à chaque mise à jour des données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    comparisonState.comparedStations,
    comparisonState.selectedPollutant,
  ]);

  const handlePollutantChange = (pollutant: string) => {
    // Charger les données pour le nouveau polluant
    onLoadComparisonData(
      comparisonState.comparedStations,
      pollutant,
      comparisonState.timeRange,
      comparisonState.timeStep
    );
  };

  // Vérifier si un pas de temps est valide selon la période actuelle
  const isTimeStepValidForCurrentRange = (timeStep: string): boolean => {
    const maxDays = getMaxHistoryDays(timeStep);
    if (!maxDays) return true; // Pas de limite, toujours valide

    const timeRange = comparisonState.timeRange;
    let currentDays: number;

    if (timeRange.type === "preset" && timeRange.preset) {
      const presetDays = {
        "3h": 0.125,
        "24h": 1,
        "7d": 7,
        "30d": 30,
      }[timeRange.preset];
      currentDays = presetDays;
    } else if (timeRange.type === "custom" && timeRange.custom) {
      const startDate = new Date(timeRange.custom.startDate);
      const endDate = new Date(timeRange.custom.endDate);
      currentDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      return true; // Pas de période définie, considérer comme valide
    }

    return currentDays <= maxDays;
  };

  // Ajuster automatiquement la période si elle dépasse la limite du pas de temps
  const adjustTimeRangeIfNeeded = (
    timeRange: TimeRange,
    timeStep: string
  ): { adjustedRange: TimeRange; wasAdjusted: boolean } => {
    const maxDays = getMaxHistoryDays(timeStep);
    if (!maxDays) return { adjustedRange: timeRange, wasAdjusted: false };

    const now = new Date();
    let adjustedRange = { ...timeRange };

    if (timeRange.type === "preset" && timeRange.preset) {
      const presetDays = {
        "3h": 0.125,
        "24h": 1,
        "7d": 7,
        "30d": 30,
      }[timeRange.preset];

      if (presetDays && presetDays > maxDays) {
        // Ajuster vers une période custom limitée
        const maxStartDate = new Date(now);
        maxStartDate.setDate(maxStartDate.getDate() - maxDays);
        adjustedRange = {
          type: "custom",
          custom: {
            startDate: maxStartDate.toISOString().split("T")[0],
            endDate: now.toISOString().split("T")[0],
          },
        };
        return { adjustedRange, wasAdjusted: true };
      }
    } else if (timeRange.type === "custom" && timeRange.custom) {
      const startDate = new Date(timeRange.custom.startDate);
      const endDate = new Date(timeRange.custom.endDate);
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > maxDays) {
        // Ajuster la date de début pour respecter la limite
        const maxStartDate = new Date(endDate);
        maxStartDate.setDate(maxStartDate.getDate() - maxDays);
        adjustedRange = {
          type: "custom",
          custom: {
            startDate: maxStartDate.toISOString().split("T")[0],
            endDate: timeRange.custom.endDate,
          },
        };
        return { adjustedRange, wasAdjusted: true };
      }
    }

    return { adjustedRange, wasAdjusted: false };
  };

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    // Vérifier et ajuster la période si nécessaire selon le pas de temps actuel
    const { adjustedRange: validatedTimeRange } = adjustTimeRangeIfNeeded(
      timeRange,
      comparisonState.timeStep
    );

    // Charger les données avec la période validée
    onLoadComparisonData(
      comparisonState.comparedStations,
      comparisonState.selectedPollutant,
      validatedTimeRange,
      comparisonState.timeStep
    );
  };

  const handleTimeStepChange = (timeStep: string) => {
    if (!isTimeStepSupportedByComparedStations(timeStep)) {
      return;
    }

    // Ajuster la période si nécessaire
    const { adjustedRange: adjustedTimeRange } = adjustTimeRangeIfNeeded(
      comparisonState.timeRange,
      timeStep
    );

    // Réinitialiser l'affichage des données brutes si on change de pas de temps
    // (les données corrigées ne sont disponibles qu'au pas de temps horaire)
    if (timeStep !== "heure") {
      setShowRawData(false);
    }

    // Charger les données avec la période ajustée
    onLoadComparisonData(
      comparisonState.comparedStations,
      comparisonState.selectedPollutant,
      adjustedTimeRange,
      timeStep
    );
  };

  useEffect(() => {
    if (comparisonState.comparedStations.length === 0) return;

    const currentTimeStep = comparisonState.timeStep;
    if (!isTimeStepSupportedByComparedStations(currentTimeStep)) {
      const fallbackTimeStep = getComparisonFallbackTimeStep();
      if (fallbackTimeStep !== currentTimeStep) {
        const { adjustedRange: adjustedTimeRange } = adjustTimeRangeIfNeeded(
          comparisonState.timeRange,
          fallbackTimeStep
        );
        onLoadComparisonData(
          comparisonState.comparedStations,
          comparisonState.selectedPollutant,
          adjustedTimeRange,
          fallbackTimeStep
        );
      }
    }
  }, [
    comparisonState.comparedStations,
    comparisonState.selectedPollutant,
    comparisonState.timeRange,
    comparisonState.timeStep,
    getComparisonFallbackTimeStep,
    isTimeStepSupportedByComparedStations,
    onLoadComparisonData,
  ]);

  // Fonction pour rendre le contenu du panel
  const renderPanelContent = () => {
    if (comparisonState.comparedStations.length === 0) return null;
    
    return (
      <SidePanelShell
        isOpen={isOpen}
        panelSize={panelSize}
        onSizeChange={onSizeChange}
        onHidden={onHidden}
        bodyClassName={CHART_PANEL_BODY_CLASS}
        title={t("panels.comparisonSidePanel.title")}
        subtitle={t("panels.comparisonSidePanel.stationsSelected", {
          count: comparisonState.comparedStations.length,
          max: MAX_COMPARISON_STATIONS,
        })}
        badge={
          <PanelReopenBadge
            label={t("panels.stationSidePanel.reopenButtonTooltip")}
          />
        }
        headerExtra={
          <button
            type="button"
            onClick={() => onComparisonModeToggle()}
            className="flex min-h-11 shrink-0 items-center rounded-[var(--r-sm)] border border-red-200 px-2.5 text-xs text-red-700 transition-all duration-200 hover:bg-red-50 motion-reduce:transition-none"
          >
            <svg
              className="mr-1 h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {t("panels.comparisonSidePanel.disableComparison")}
          </button>
        }
      >
        {/* Stations sélectionnées */}
        <CollapsiblePanelSection
          title={t("panels.comparisonSidePanel.stationsSelectedTitle")}
          defaultOpen={false}
          storageKey="comparison-stations"
        >
          <div className="space-y-2">
            {comparisonState.comparedStations.map((station) => (
              <div
                key={station.id}
                className="flex items-center justify-between rounded-[var(--r-sm)] bg-[rgb(16_32_56_/_0.03)] p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[color:var(--fg)]">
                    {station.name}
                  </p>
                  <p className="truncate text-xs text-[color:var(--fg-muted)]">
                    {station.source === "atmoRef"
                      ? t("panels.comparisonSidePanel.sourceAtmoRef")
                      : station.source === "atmoMicro"
                      ? t("panels.comparisonSidePanel.sourceAtmoMicro")
                      : station.source === "nebuleair"
                      ? t("panels.comparisonSidePanel.sourceNebuleAir")
                      : t("panels.comparisonSidePanel.sourceOther")}{" "}
                    - {station.address}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveStation(station.id)}
                  className="ml-2 p-1 text-[color:var(--fg-muted)] transition-colors hover:text-red-600"
                  title={t("panels.removeFromComparison")}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </CollapsiblePanelSection>

        {/* Graphique avec contrôles intégrés */}
        <div className="flex shrink-0 flex-col gap-2">
          {isInitialChartLoading ? (
            <div className="flex h-[clamp(16rem,40vh,26rem)] shrink-0 items-center justify-center sm:h-[clamp(18rem,42vh,28rem)] rounded-[var(--r-md)] bg-[rgb(16_32_56_/_0.03)] sm:min-h-[18rem]">
              <div className="flex flex-col items-center space-y-2">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600 sm:h-8 sm:w-8"></div>
                <span className="text-xs text-[color:var(--fg-muted)] sm:text-sm">
                  {t("panels.loadingData")}
                </span>
              </div>
            </div>
          ) : comparisonState.error ? (
            <div className="flex h-[clamp(16rem,40vh,26rem)] shrink-0 items-center justify-center sm:h-[clamp(18rem,42vh,28rem)] rounded-[var(--r-md)] bg-red-50 sm:min-h-[18rem]">
              <div className="text-center">
                <svg
                  className="mx-auto mb-2 h-6 w-6 text-red-400 sm:h-8 sm:w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-red-600 sm:text-sm">
                  {comparisonState.error}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Polluant comparé et données brutes — ligne compacte */}
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 flex-col rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] sm:max-w-[280px]">
                  <button
                    type="button"
                    onClick={() => setShowPollutantsList(!showPollutantsList)}
                    aria-expanded={showPollutantsList}
                    className="flex h-11 w-full shrink-0 items-center justify-between rounded-[var(--r-md)] px-2.5 text-left transition-colors hover:bg-black/5 sm:px-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center space-x-2">
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-[color:var(--fg-muted)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <span className="truncate text-sm font-medium text-[color:var(--fg-muted)]">
                        {t("panels.comparisonSidePanel.pollutantCompared")}
                      </span>
                      <span className="flex-shrink-0 rounded-full bg-[rgb(16_32_56_/_0.06)] px-2 py-0.5 text-xs text-[color:var(--fg-muted)]">
                        {t(`pollutants.${comparisonState.selectedPollutant}`, {
                          defaultValue: comparisonState.selectedPollutant,
                        })}
                      </span>
                    </div>
                    <svg
                      className={`h-4 w-4 flex-shrink-0 text-[color:var(--fg-muted)] transition-transform motion-reduce:transition-none ${
                        showPollutantsList ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {showPollutantsList && (
                    <div className="space-y-1 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
                      {getAvailablePollutants().map((pollutantCode) => {
                        const isSelected =
                          comparisonState.selectedPollutant === pollutantCode;

                        return (
                          <button
                            key={pollutantCode}
                            type="button"
                            onClick={() =>
                              !chartControlsDisabled &&
                              handlePollutantChange(pollutantCode)
                            }
                            disabled={chartControlsDisabled}
                            className={`flex w-full items-center rounded-[var(--r-sm)] px-2.5 py-1.5 text-sm transition-all duration-200 sm:px-3 sm:py-2 ${
                              isSelected
                                ? "border border-blue-200 bg-blue-50 text-blue-700"
                                : "text-[color:var(--fg-muted)] hover:bg-black/5"
                            }`}
                          >
                            <div
                              className={`mr-2 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600"
                                  : "border-[rgb(16_32_56_/_0.14)]"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="h-2 w-2 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1 truncate text-left">
                              {t(`pollutants.${pollutantCode}`, {
                                defaultValue: pollutantCode,
                              })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Contrôle d'affichage des données brutes - seulement si conditions remplies */}
                {canShowRawDataButton() && hasCorrectedData && (
                  <div className="flex h-11 flex-none items-center justify-between gap-2 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] px-2.5">
                    <div className="flex min-w-0 items-center space-x-2">
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-[color:var(--fg-muted)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <span className="truncate text-xs font-medium text-[color:var(--fg-muted)] sm:text-sm">
                        {t("panels.comparisonSidePanel.rawData")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRawData(!showRawData)}
                      role="switch"
                      aria-checked={showRawData}
                      aria-label={t("panels.comparisonSidePanel.rawData")}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                        showRawData
                          ? "bg-blue-600"
                          : "bg-[rgb(16_32_56_/_0.10)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          showRawData ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Message au niveau du graphique (mode Scan) */}
              {comparisonState.timeStep === "instantane" && (
                <div className="shrink-0 rounded-[var(--r-md)] border border-blue-200 bg-blue-50 p-2.5 sm:p-3">
                  <p className="text-xs font-medium text-blue-800 sm:text-sm">
                    {t("panels.comparisonSidePanel.scanModeTitle")}
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    {t("panels.comparisonSidePanel.scanModeDescription")}
                  </p>
                </div>
              )}

              <PanelChartBlock
                loading={comparisonState.loading}
                data={
                  comparisonState.comparisonData[
                    comparisonState.selectedPollutant
                  ] || {}
                }
                selectedPollutants={[comparisonState.selectedPollutant]}
                source="comparison"
                stations={comparisonState.comparedStations}
                timeStep={comparisonState.timeStep}
                onHasCorrectedDataChange={handleHasCorrectedDataChange}
                showRawData={showRawData}
              />

              <ChartTimeControls
                timeRange={comparisonState.timeRange}
                onTimeRangeChange={handleTimeRangeChange}
                timeStep={comparisonState.timeStep}
                onTimeStepChange={handleTimeStepChange}
                disabled={chartControlsDisabled}
                timeStepOptions={COMPARISON_TIME_STEP_OPTIONS.map(
                  ({ key, labelKey }) => {
                    const isDisabledByRange =
                      !isTimeStepValidForCurrentRange(key);
                    const isDisabledBySupport =
                      !isTimeStepSupportedByComparedStations(key);
                    const maxDays = getMaxHistoryDays(key);
                    const label = t(`panels.comparisonSidePanel.${labelKey}`);

                    let title = label;
                    if (isDisabledByRange && maxDays) {
                      title = t(
                        "panels.stationSidePanel.timeStepRangeLimit",
                        { maxDays }
                      );
                    } else if (isDisabledBySupport) {
                      title = t(
                        "panels.stationSidePanel.timeStepNotSupported"
                      );
                    }

                    return {
                      key,
                      label,
                      disabled: isDisabledByRange || isDisabledBySupport,
                      title,
                    };
                  }
                )}
                timeStepHint={(() => {
                  const disabledByRange = COMPARISON_TIME_STEP_OPTIONS.filter(
                    ({ key }) => !isTimeStepValidForCurrentRange(key)
                  );

                  if (disabledByRange.length === 0) return null;

                  const timeStepLabels = disabledByRange
                    .map(({ key, labelKey }) => {
                      const maxDays = getMaxHistoryDays(key);
                      if (!maxDays) return null;
                      const daysText =
                        maxDays === 60
                          ? t("panels.comparisonSidePanel.twoMonths")
                          : maxDays === 180
                          ? t("panels.comparisonSidePanel.sixMonths")
                          : t("panels.comparisonSidePanel.daysUnit", {
                              count: maxDays,
                            });
                      return `${t(
                        `panels.comparisonSidePanel.${labelKey}`
                      )} (max ${daysText})`;
                    })
                    .filter(Boolean);

                  return (
                    <div className="rounded-[var(--r-sm)] border border-amber-200 bg-amber-50 p-2">
                      <p className="text-[11px] text-amber-700 sm:text-xs">
                        <span className="font-medium">
                          {t("panels.comparisonSidePanel.limitationLabel")}
                        </span>{" "}
                        {t(
                          "panels.stationSidePanel.timeStepsDisabledByRange",
                          {
                            labels: timeStepLabels.join(
                              t(
                                "panels.comparisonSidePanel.timeStepLabelsSeparator"
                              )
                            ),
                          }
                        )}
                      </p>
                    </div>
                  );
                })()}
              />
            </>
          )}
        </div>
      </SidePanelShell>
    );
  };

  if (comparisonState.comparedStations.length === 0) {
    return null;
  }
  
  // Le montage, l'animation de sortie et son portail appartiennent
  // désormais à SidePanelShell : il ne reste que la garde sur les données.
  return renderPanelContent();
};

export default ComparisonSidePanel;
