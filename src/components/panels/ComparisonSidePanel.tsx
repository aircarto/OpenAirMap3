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
import HistoricalChart from "../charts/HistoricalChart";
import ChartLoadingOverlay from "../charts/ChartLoadingOverlay";
import HistoricalTimeRangeSelector from "../controls/HistoricalTimeRangeSelector";
import { getMaxHistoryDays, type TimeRange } from "../../utils/historicalTimeRange";
import { sources } from "../../constants/sources";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";
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
      >
      {/* Stations sélectionnées */}
      <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[color:var(--fg-muted)]">
            {t("panels.comparisonSidePanel.stationsSelectedTitle")}
          </h3>
              
          {/* Bouton désactiver comparaison - repositionné au-dessus de l'encart station */}
          <button
            onClick={() => onComparisonModeToggle()}
            className="px-3 py-1.5 rounded-[var(--r-sm)] text-xs transition-all duration-200 flex items-center text-red-700 hover:bg-red-50 border border-red-200"
          >
            <svg
              className="w-3 h-3 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
        </div>
        <div className="space-y-2">
          {comparisonState.comparedStations.map((station, index) => (
            <div
              key={station.id}
              className="flex items-center justify-between p-2 bg-[rgb(16_32_56_/_0.03)] rounded-[var(--r-sm)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[color:var(--fg)] truncate">
                  {station.name}
                </p>
                <p className="text-xs text-[color:var(--fg-muted)] truncate">
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
                onClick={() => onRemoveStation(station.id)}
                className="ml-2 p-1 text-[color:var(--fg-muted)] hover:text-red-600 transition-colors"
                title={t("panels.removeFromComparison")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
      </div>

      {/* Graphique avec contrôles intégrés */}
      <div className="flex-1 min-h-80 sm:min-h-96">
        <div className="mb-2 sm:mb-3">
          <h3 className="text-sm font-medium text-[color:var(--fg-muted)]">
            {t("panels.comparisonSidePanel.dataComparisonTitle")}
          </h3>
        </div>
        {isInitialChartLoading ? (
          <div className="flex items-center justify-center h-80 sm:h-96 md:h-[28rem] bg-[rgb(16_32_56_/_0.03)] rounded-[var(--r-md)]">
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
              <span className="text-xs sm:text-sm text-[color:var(--fg-muted)]">
                {t("panels.loadingData")}
              </span>
            </div>
          </div>
        ) : comparisonState.error ? (
          <div className="flex items-center justify-center h-80 sm:h-96 md:h-[28rem] bg-red-50 rounded-[var(--r-md)]">
            <div className="text-center">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 mx-auto mb-2"
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
              <p className="text-xs sm:text-sm text-red-600">
                {comparisonState.error}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
            {/* Sélection du polluant et contrôle d'affichage des données brutes */}
            <div className="flex flex-row items-start gap-2 sm:gap-4 mb-3 sm:mb-4">
              {/* Sélection du polluant */}
              <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)]">
                <button
                  onClick={() => setShowPollutantsList(!showPollutantsList)}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 text-left hover:bg-black/5 transition-colors rounded-[var(--r-md)]"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <svg
                      className="w-4 h-4 text-[color:var(--fg-muted)] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-[color:var(--fg-muted)] truncate">
                      {t("panels.comparisonSidePanel.pollutantCompared")}
                    </span>
                    <span className="text-xs text-[color:var(--fg-muted)] bg-[rgb(16_32_56_/_0.06)] px-2 py-1 rounded-full flex-shrink-0">
                      {t(`pollutants.${comparisonState.selectedPollutant}`, {
                        defaultValue: comparisonState.selectedPollutant,
                      })}
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-[color:var(--fg-muted)] transition-transform flex-shrink-0 ${
                      showPollutantsList ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
                <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 space-y-1">
                  {getAvailablePollutants().map((pollutantCode) => {
                    const pollutant = pollutants[pollutantCode];
                    const isSelected =
                      comparisonState.selectedPollutant === pollutantCode;

                    return (
                      <button
                        key={pollutantCode}
                        onClick={() =>
                          !chartControlsDisabled &&
                          handlePollutantChange(pollutantCode)
                        }
                        disabled={chartControlsDisabled}
                        className={`w-full flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[var(--r-sm)] text-sm transition-all duration-200 ${
                          isSelected
                            ? "text-blue-700 bg-blue-50 border border-blue-200"
                            : "text-[color:var(--fg-muted)] hover:bg-black/5"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded border mr-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-[rgb(16_32_56_/_0.14)]"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-2 h-2 text-white"
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
                        <span className="flex-1 text-left truncate">
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
                <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)]">
                  <div className="p-2.5 sm:p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <svg
                          className="w-4 h-4 text-[color:var(--fg-muted)] flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-[color:var(--fg-muted)] truncate">
                          {t("panels.comparisonSidePanel.rawData")}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowRawData(!showRawData)}
                        className={`relative inline-flex h-4 w-8 sm:h-5 sm:w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                          showRawData ? "bg-blue-600" : "bg-[rgb(16_32_56_/_0.10)]"
                        }`}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 transform rounded-full bg-white transition-transform ${
                            showRawData ? "translate-x-4 sm:translate-x-5" : "translate-x-0.5 sm:translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Graphique */}
            <div className="mb-3 sm:mb-4">
              {/* Message au niveau du graphique (mode Scan) */}
              {comparisonState.timeStep === "instantane" && (
                <div className="mb-2 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-[var(--r-md)]">
                  <p className="text-xs sm:text-sm text-blue-800 font-medium">
                    {t("panels.comparisonSidePanel.scanModeTitle")}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {t("panels.comparisonSidePanel.scanModeDescription")}
                  </p>
                </div>
              )}
              <div className="relative h-80 sm:h-96 md:h-[28rem]">
              <HistoricalChart
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
              {comparisonState.loading && <ChartLoadingOverlay />}
              </div>
            </div>

            {/* Contrôles du graphique */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Contrôles de la période */}
              <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-2.5 sm:p-3">
                <HistoricalTimeRangeSelector
                  timeRange={comparisonState.timeRange}
                  onTimeRangeChange={handleTimeRangeChange}
                  timeStep={comparisonState.timeStep}
                  disabled={chartControlsDisabled}
                />
              </div>

              {/* Contrôles du pas de temps */}
              <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-2.5 sm:p-3 rtl-on-ar">
                <div className="flex items-center space-x-2 mb-2.5 sm:mb-3">
                  <svg
                    className="w-4 h-4 text-[color:var(--fg-muted)] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-[color:var(--fg-muted)]">
                    {t("controls.timeStep")}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {COMPARISON_TIME_STEP_OPTIONS.map(({ key, labelKey }) => {
                    const isDisabledByRange = !isTimeStepValidForCurrentRange(key);
                    const isDisabledBySupport =
                      !isTimeStepSupportedByComparedStations(key);
                    const isDisabled = isDisabledByRange || isDisabledBySupport;
                    // Bloquer aussi le clic pendant un chargement, sans
                    // changer l'apparence (le pas de temps sélectionné doit
                    // rester visible).
                    const isBlocked = isDisabled || chartControlsDisabled;
                    const isSelected = comparisonState.timeStep === key;
                    const maxDays = getMaxHistoryDays(key);
                    const label = t(`panels.comparisonSidePanel.${labelKey}`);

                    let tooltip = label;
                    if (isDisabledByRange && maxDays) {
                      tooltip = t("panels.stationSidePanel.timeStepRangeLimit", {
                        maxDays,
                      });
                    } else if (isDisabledBySupport) {
                      tooltip = t("panels.stationSidePanel.timeStepNotSupported");
                    }

                    return (
                      <button
                        key={key}
                        onClick={() => !isBlocked && handleTimeStepChange(key)}
                        disabled={isBlocked}
                        title={tooltip}
                        className={`px-1.5 py-1 text-xs rounded-[var(--r-sm)] transition-all duration-200 ${
                          isDisabled
                            ? "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] cursor-not-allowed opacity-60"
                            : isSelected
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] hover:bg-black/10"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                    
                {/* Message explicatif si des boutons sont désactivés à cause de la période */}
                {(() => {
                  const disabledByRange = COMPARISON_TIME_STEP_OPTIONS.filter(
                    ({ key }) => !isTimeStepValidForCurrentRange(key)
                  );

                  if (disabledByRange.length > 0) {
                    const timeStepLabels = disabledByRange
                      .map(({ key, labelKey }) => {
                        const maxDays = getMaxHistoryDays(key);
                        if (!maxDays) return null;
                        const daysText =
                          maxDays === 60
                            ? t("panels.comparisonSidePanel.twoMonths")
                            : maxDays === 180
                            ? t("panels.comparisonSidePanel.sixMonths")
                            : t("panels.comparisonSidePanel.daysUnit", { count: maxDays });
                        return `${t(`panels.comparisonSidePanel.${labelKey}`)} (max ${daysText})`;
                      })
                      .filter(Boolean);

                    return (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-[var(--r-sm)]">
                        <p className="text-[11px] sm:text-xs text-amber-700">
                          <span className="font-medium">{t("panels.comparisonSidePanel.limitationLabel")}</span>{" "}
                          {t("panels.stationSidePanel.timeStepsDisabledByRange", {
                            labels: timeStepLabels.join(t("panels.comparisonSidePanel.timeStepLabelsSeparator")),
                          })}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
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
