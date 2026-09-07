import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  StationInfo,
  ChartControls,
  HistoricalDataPoint,
  SidePanelState,
  ATMOMICRO_POLLUTANT_MAPPING,
} from "../../types";
import { pollutants } from "../../constants/pollutants";
import type { AtmoMicroLikeService } from "../../types";
import { ModelingService } from "../../services/ModelingService";
import { DataServiceFactory } from "../../services/DataServiceFactory";
import { getSensorModelImage } from "../../constants/sensorModels";
import HistoricalChart from "../charts/HistoricalChart";
import ChartLoadingOverlay from "../charts/ChartLoadingOverlay";
import HistoricalTimeRangeSelector from "../controls/HistoricalTimeRangeSelector";
import { getMaxHistoryDays, getCustomRangeISO, type TimeRange } from "../../utils/historicalTimeRange";
import { ToggleGroup, ToggleGroupItem } from "../ui/button-group";
import ExpertMenu from "../controls/ExpertMenu";
import { cn } from "../../lib/utils";
import { sources } from "../../constants/sources";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";
import PanelReopenBadge from "./PanelReopenBadge";

interface MicroSidePanelProps {
  isOpen: boolean;
  selectedStation: StationInfo | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange: (size: PanelSize) => void;
  initialPollutant: string;
  panelSize: PanelSize;
  onComparisonModeToggle?: (pollutantToPreserve?: string) => void;
  isComparisonMode?: boolean;
  historicalMode?: {
    startDate: string;
    endDate: string;
    timeStep: string;
    currentDate?: string;
  } | null;
}

const MICRO_TIME_STEP_PRIORITY = ["heure", "quartHeure", "instantane"] as const;
const MICRO_TIME_STEP_OPTIONS = [
  { key: "instantane", labelKey: "timeStepScan", shortLabelKey: "timeStepScan" },
  { key: "quartHeure", labelKey: "timeStep15min", shortLabelKey: "timeStep15min" },
  { key: "heure", labelKey: "timeStep1h", shortLabelKey: "timeStep1h" },
  { key: "jour", labelKey: "timeStep1j", shortLabelKey: "timeStep1j" },
] as const;
const ATMOMICRO_DISCOVER_URL =
  "https://www.atmosud.org/article/utiliser-mon-microcapteur-citoyen";

const MicroSidePanel: React.FC<MicroSidePanelProps> = ({
  isOpen,
  selectedStation,
  onClose,
  onHidden,
  onSizeChange,
  initialPollutant,
  panelSize,
  onComparisonModeToggle,
  isComparisonMode = false,
  historicalMode = null,
}) => {
  const { t } = useTranslation();
  const isHistoricalLocked = Boolean(historicalMode);
  const [state, setState] = useState<SidePanelState>({
    isOpen: false,
    selectedStation: null,
    chartControls: {
      selectedPollutants: [initialPollutant],
      timeRange: {
        type: "preset",
        preset: "24h",
      },
      timeStep: "heure",
    },
    historicalData: {},
    loading: false,
    error: null,
    infoMessage: null,
  });

  // Pas de temps auquel correspondent les données actuellement affichées.
  // Distinct de `state.chartControls.timeStep` (pas de temps sélectionné) : le
  // graphique doit toujours recevoir un couple cohérent (données, pas de temps)
  // et basculer d'un seul coup quand les nouvelles données arrivent.
  const [dataTimeStep, setDataTimeStep] = useState<string>(
    historicalMode ? historicalMode.timeStep : "heure"
  );

  const [showPollutantsList, setShowPollutantsList] = useState(false);
  const [hasCorrectedData, setHasCorrectedData] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [sensorTimeStep, setSensorTimeStep] = useState<number | null>(null);
  const stationIdRef = useRef<string | null>(null);

  // États pour la modélisation
  const [showModeling, setShowModeling] = useState(false);
  const [modelingData, setModelingData] = useState<
    Record<string, HistoricalDataPoint[]>
  >({});
  const [stationCoordinates, setStationCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loadingModeling, setLoadingModeling] = useState(false);
  const [hideThresholdBackgroundForColorblind, setHideThresholdBackgroundForColorblind] =
    useState(false);

  // Premier chargement (aucune donnée à afficher) : écran de chargement plein.
  // Rechargements suivants : voile par-dessus le graphique, qui reste monté.
  const isInitialChartLoading =
    state.loading && Object.keys(state.historicalData).length === 0;
  // Les contrôles restent visibles sous le voile : les désactiver évite de
  // lancer un second chargement pendant qu'un autre est en cours.
  const chartControlsDisabled = state.loading;
  const microSupportedTimeSteps = sources.atmoMicro.supportedTimeSteps || [];
  const isTimeStepSupportedByAtmoMicro = (timeStep: string): boolean =>
    microSupportedTimeSteps.includes(timeStep);
  const getMicroFallbackTimeStep = (): string =>
    MICRO_TIME_STEP_PRIORITY.find((timeStep) =>
      isTimeStepSupportedByAtmoMicro(timeStep)
    ) || "heure";

  // Utiliser DataServiceFactory pour obtenir une instance singleton partagée
  const atmoMicroService = useRef(DataServiceFactory.getService('atmoMicro') as AtmoMicroLikeService).current;
  const modelingService = useRef(new ModelingService()).current;

  // Fonction utilitaire pour vérifier si un polluant est disponible dans la station
  const isPollutantAvailable = (pollutantCode: string): boolean => {
    return Object.entries(selectedStation?.variables || {}).some(
      ([code, variable]) => {
        return code === pollutantCode && variable.en_service;
      }
    );
  };

  // Fonction utilitaire pour obtenir les polluants disponibles dans la station
  const getAvailablePollutants = (): string[] => {
    if (!selectedStation) return [];

    return Object.entries(pollutants)
      .filter(([pollutantCode]) => {
        return isPollutantAvailable(pollutantCode);
      })
      .map(([pollutantCode]) => pollutantCode);
  };

  const getDateRange = (
    timeRange: TimeRange
  ): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = now.toISOString();

    // Si c'est une plage personnalisée, utiliser les dates fournies
    if (timeRange.type === "custom" && timeRange.custom) {
      return getCustomRangeISO(timeRange.custom);
    }

    // Sinon, utiliser les périodes prédéfinies
    let startDate: Date;

    switch (timeRange.preset) {
      case "3h":
        startDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        break;
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate,
    };
  };

  const getEffectiveDateRange = useCallback(
    (timeRange: TimeRange): { startDate: string; endDate: string } => {
      if (historicalMode) {
        return {
          startDate: historicalMode.startDate,
          endDate: historicalMode.endDate,
        };
      }

      return getDateRange(timeRange);
    },
    [historicalMode]
  );

  const loadHistoricalData = useCallback(
    async (
      station: StationInfo,
      selectedPollutants: string[],
      timeRange: TimeRange,
      timeStep: string,
      shouldLoadModeling: boolean = false,
      coords: { latitude: number; longitude: number } | null = null
    ) => {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        infoMessage: null,
      }));

      try {
        const { startDate, endDate } = getEffectiveDateRange(timeRange);
        const newHistoricalData: Record<string, HistoricalDataPoint[]> = {};

        // Charger les données pour chaque polluant sélectionné
        for (const pollutant of selectedPollutants) {
          const data = await atmoMicroService.fetchHistoricalData({
            siteId: station.id,
            pollutant,
            timeStep,
            startDate,
            endDate,
          });
          newHistoricalData[pollutant] = data;
        }

        const hasData = Object.values(newHistoricalData).some(
          (dataPoints) => dataPoints && dataPoints.length > 0
        );

        // Charger les données de modélisation si demandé et si on a les coordonnées
        const newModelingData: Record<string, HistoricalDataPoint[]> = {};
        if (shouldLoadModeling && coords && timeStep === "heure") {
          setLoadingModeling(true);
          try {
            // Utiliser la date de fin comme datetime_echeance pour récupérer les données autour de cette date
            const datetimeEcheance = new Date(endDate).toISOString();

            // Charger les données de modélisation pour chaque polluant sélectionné
            const modelingPromises = selectedPollutants.map(
              async (pollutant) => {
                if (!modelingService.isPollutantSupported(pollutant)) {
                  return null;
                }

                try {
                  const data = await modelingService.fetchModelingData({
                    longitude: coords.longitude,
                    latitude: coords.latitude,
                    pollutant,
                    datetimeEcheance,
                    withList: true, // Récupérer toutes les échéances
                  });

                  // Filtrer les données pour inclure la plage de temps sélectionnée + les prévisions (+24h)
                  const filteredData = data.filter((point) => {
                    const pointDate = new Date(point.timestamp);
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    // Ajouter 24 heures pour inclure les prévisions
                    const endWithForecast = new Date(end.getTime() + 24 * 60 * 60 * 1000);
                    return (
                      pointDate >= start &&
                      pointDate <= endWithForecast
                    );
                  });

                  return { pollutant, data: filteredData };
                } catch (error) {
                  console.error(
                    `Erreur lors du chargement de la modélisation pour ${pollutant}:`,
                    error
                  );
                  return null;
                }
              }
            );

            const modelingResults = await Promise.all(modelingPromises);
            modelingResults.forEach((result) => {
              if (result && result.data.length > 0) {
                newModelingData[`${result.pollutant}_modeling`] = result.data;
              }
            });

            setModelingData(newModelingData);
          } catch (error) {
            console.error(
              "Erreur lors du chargement des données de modélisation:",
              error
            );
            setModelingData({});
          } finally {
            setLoadingModeling(false);
          }
        } else if (!shouldLoadModeling) {
          // Si la modélisation est désactivée, vider les données
          setModelingData({});
        }

        // Les données affichées correspondent désormais à ce pas de temps.
        // Même lot de mises à jour que celui des données : le graphique ne voit
        // jamais un couple (données, pas de temps) incohérent.
        setDataTimeStep(timeStep);

        setState((prev) => ({
          ...prev,
          historicalData: { ...prev.historicalData, ...newHistoricalData },
          loading: false,
          error: null,
          infoMessage: hasData
            ? null
            : "Aucune mesure disponible sur la période sélectionnée. Essayez d'élargir la période ou vérifiez si le capteur a changé de localisation.",
        }));
      } catch (error) {
        console.error(
          "Erreur lors du chargement des données historiques:",
          error
        );
        setState((prev) => ({
          ...prev,
          loading: false,
          error: t("panels.stationSidePanel.historicalDataLoadError"),
          infoMessage: null,
        }));
      }
    },
    [t, atmoMicroService, modelingService, getEffectiveDateRange]
  );

  // Mettre à jour l'état uniquement lors de l'ouverture du panel ou du changement de station
  useEffect(() => {
    if (!isOpen) {
      // Réinitialiser la référence de station quand le panel est fermé
      stationIdRef.current = null;
      setState((prev) => ({
        ...prev,
        isOpen: false,
        selectedStation: null,
      }));
      // Réinitialiser les états de modélisation quand le panel est fermé
      setShowModeling(false);
      setModelingData({});
      setLoadingModeling(false);
      setStationCoordinates(null);
      return;
    }

    if (!selectedStation) return;

    const currentStationId = selectedStation.id;
    const isNewStation = currentStationId !== stationIdRef.current;

    // Initialiser uniquement lors de l'ouverture du panel ou du changement de station
    if (isNewStation) {
      stationIdRef.current = currentStationId;

      // Déterminer quels polluants sont disponibles dans cette station
      const availablePollutants = getAvailablePollutants();

      // Sélectionner le polluant initial s'il est disponible, sinon le premier disponible
      const selectedPollutants = availablePollutants.includes(initialPollutant)
        ? [initialPollutant]
        : availablePollutants.length > 0
        ? [availablePollutants[0]]
        : [];
      const defaultTimeRange: TimeRange = historicalMode
        ? {
            type: "custom",
            custom: {
              startDate: historicalMode.startDate.split("T")[0],
              endDate: historicalMode.endDate.split("T")[0],
            },
          }
        : {
            type: "preset",
            preset: "24h",
          };
      const defaultTimeStep = historicalMode ? historicalMode.timeStep : "heure";
      setDataTimeStep(defaultTimeStep);

      setState((prev) => ({
        ...prev,
        isOpen,
        selectedStation,
        chartControls: {
          ...prev.chartControls,
          selectedPollutants,
          timeRange: defaultTimeRange,
          timeStep: defaultTimeStep,
        },
        historicalData: {},
        loading: false,
        error: null,
        infoMessage: null,
      }));

      // Réinitialiser la taille du panel
      setHasCorrectedData(false);
      setShowRawData(false); // Réinitialiser l'affichage des données brutes (désactivé par défaut)

      // Réinitialiser les états de modélisation AVANT le chargement des données
      setShowModeling(false);
      setModelingData({});
      setStationCoordinates(null);
      setLoadingModeling(false);

      // Charger le pas de temps par défaut du capteur
      if (selectedPollutants.length > 0) {
        atmoMicroService
          .fetchSensorTimeStep(selectedStation.id, selectedPollutants[0])
          .then((timeStep) => {
            setSensorTimeStep(timeStep);
          })
          .catch((error) => {
            console.error(
              "Erreur lors de la récupération du pas de temps:",
              error
            );
            setSensorTimeStep(null);
          });

        // Charger les données historiques initiales
        loadHistoricalData(
          selectedStation,
          selectedPollutants,
          defaultTimeRange,
          defaultTimeStep,
          false, // Ne pas charger la modélisation au chargement initial
          null
        );
      }
    } else {
      // Si c'est la même station, juste mettre à jour isOpen et selectedStation sans réinitialiser les polluants
      setState((prev) => ({
        ...prev,
        isOpen,
        selectedStation,
      }));
    }
    // Ouverture / changement de station uniquement (timeRange/timeStep via setState précédent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    selectedStation,
    initialPollutant,
    historicalMode?.startDate,
    historicalMode?.endDate,
    historicalMode?.timeStep,
  ]);

  // Récupérer les coordonnées du site
  useEffect(() => {
    const fetchCoordinates = async () => {
      if (!selectedStation) return;

      try {
        const coords = await atmoMicroService.fetchSiteCoordinates(
          selectedStation.id
        );
        if (coords) {
          setStationCoordinates(coords);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des coordonnées:", error);
      }
    };

    if (selectedStation && selectedStation.source === "atmoMicro") {
      fetchCoordinates();
    }
  }, [selectedStation, atmoMicroService]);

  // Recharger les données de modélisation quand les coordonnées sont disponibles et que la modélisation est activée
  const prevModelingStateRef = useRef<{
    showModeling: boolean;
    hasCoords: boolean;
    stationId: string | null;
  }>({
    showModeling: false,
    hasCoords: false,
    stationId: null,
  });

  useEffect(() => {
    // Ne charger la modélisation que si :
    // 1. La modélisation est activée
    // 2. On a les coordonnées
    // 3. On a une station sélectionnée
    // 4. Le pas de temps est horaire
    // 5. L'état a vraiment changé

    const coordsKey = stationCoordinates
      ? `${stationCoordinates.latitude},${stationCoordinates.longitude}`
      : null;
    const currentState = {
      showModeling,
      hasCoords: !!stationCoordinates,
      stationId: selectedStation?.id || null,
    };

    const prevState = prevModelingStateRef.current;
    const stateChanged =
      currentState.showModeling !== prevState.showModeling ||
      currentState.hasCoords !== prevState.hasCoords ||
      currentState.stationId !== prevState.stationId;

    // Si la station a changé, vider immédiatement les données de modélisation
    if (
      currentState.stationId !== prevState.stationId &&
      prevState.stationId !== null
    ) {
      setModelingData({});
      setLoadingModeling(false);
    }

    if (!stateChanged) {
      return;
    }

    prevModelingStateRef.current = currentState;

    if (
      showModeling &&
      stationCoordinates &&
      selectedStation &&
      state.chartControls.timeStep === "heure"
    ) {
      // Capturer les valeurs actuelles pour éviter les problèmes de closure
      const currentPollutants = state.chartControls.selectedPollutants;
      const currentTimeRange = state.chartControls.timeRange;
      const currentTimeStep = state.chartControls.timeStep;

      loadHistoricalData(
        selectedStation,
        currentPollutants,
        currentTimeRange,
        currentTimeStep,
        true,
        stationCoordinates
      );
    } else if (!showModeling) {
      // Si la modélisation est désactivée, vider les données immédiatement
      setModelingData({});
      setLoadingModeling(false);
    }
  }, [
    showModeling,
    stationCoordinates,
    selectedStation,
    state.chartControls.timeStep,
    state.chartControls.selectedPollutants,
    state.chartControls.timeRange,
    loadHistoricalData,
  ]);

  const handlePollutantToggle = (pollutant: string) => {
    setState((prev) => {
      // Empêcher la désélection du dernier polluant
      if (
        prev.chartControls.selectedPollutants.includes(pollutant) &&
        prev.chartControls.selectedPollutants.length === 1
      ) {
        // Ne rien faire si c'est le dernier polluant sélectionné
        return prev;
      }

      const newSelectedPollutants =
        prev.chartControls.selectedPollutants.includes(pollutant)
          ? prev.chartControls.selectedPollutants.filter((p) => p !== pollutant)
          : [...prev.chartControls.selectedPollutants, pollutant];

      const isAddingPollutant =
        !prev.chartControls.selectedPollutants.includes(pollutant);

      // Recharger les données si le polluant n'était pas encore chargé et qu'on l'ajoute
      if (
        isAddingPollutant &&
        selectedStation &&
        !prev.historicalData[pollutant]
      ) {
        // Charger les données de manière asynchrone pour ne pas bloquer la mise à jour de l'état
        setTimeout(() => {
          // Si la modélisation est activée, charger la modélisation pour TOUS les polluants sélectionnés
          // Sinon, charger seulement les données historiques pour le nouveau polluant
          if (
            showModeling &&
            stationCoordinates &&
            prev.chartControls.timeStep === "heure"
          ) {
            // Charger les données historiques ET la modélisation pour tous les polluants sélectionnés
            loadHistoricalData(
              selectedStation,
              newSelectedPollutants, // Tous les polluants sélectionnés (y compris le nouveau)
              prev.chartControls.timeRange,
              prev.chartControls.timeStep,
              true, // Charger la modélisation
              stationCoordinates
            );
          } else {
            // Charger seulement les données historiques pour le nouveau polluant
            const { startDate, endDate } = getEffectiveDateRange(
              prev.chartControls.timeRange
            );
            atmoMicroService
              .fetchHistoricalData({
                siteId: selectedStation.id,
                pollutant,
                timeStep: prev.chartControls.timeStep,
                startDate,
                endDate,
              })
              .then((data) => {
                setState((current) => ({
                  ...current,
                  historicalData: {
                    ...current.historicalData,
                    [pollutant]: data,
                  },
                }));
              })
              .catch((error) => {
                console.error(
                  `Erreur lors du chargement des données pour ${pollutant}:`,
                  error
                );
              });
          }
        }, 0);
      }

      return {
        ...prev,
        chartControls: {
          ...prev.chartControls,
          selectedPollutants: newSelectedPollutants,
        },
      };
    });
  };

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    if (isHistoricalLocked) {
      return;
    }

    const currentTimeStep = state.chartControls.timeStep;

    // Vérifier et ajuster la période si nécessaire selon le pas de temps actuel
    const { adjustedRange: validatedTimeRange, wasAdjusted } =
      adjustTimeRangeIfNeeded(timeRange, currentTimeStep);

    // Si la période a été ajustée, afficher un message d'information
    let infoMessage: string | null = null;
    if (wasAdjusted) {
      const maxDays = getMaxHistoryDays(currentTimeStep);
      if (maxDays) {
        infoMessage = t("panels.stationSidePanel.periodAutoAdjusted", {
          maxDays,
        });
        // Faire disparaître le message après 5 secondes
        setTimeout(() => {
          setState((current) => ({
            ...current,
            infoMessage: null,
          }));
        }, 5000);
      }
    }

    setState((prev) => ({
      ...prev,
      chartControls: {
        ...prev.chartControls,
        timeRange: validatedTimeRange,
      },
      infoMessage,
    }));

    // Charger les données avec la période validée.
    // Ne pas charger la modélisation si le pas de temps n'est pas horaire.
    // IMPORTANT: hors de l'updater de setState. Appelé à l'intérieur, le
    // `setState({ loading: true })` déclenché par loadHistoricalData serait
    // perdu (mise à jour émise pendant la phase de rendu) : aucun indicateur de
    // chargement n'apparaîtrait.
    const shouldLoadModeling = currentTimeStep === "heure" && showModeling;
    if (selectedStation) {
      loadHistoricalData(
        selectedStation,
        state.chartControls.selectedPollutants,
        validatedTimeRange,
        currentTimeStep,
        shouldLoadModeling,
        stationCoordinates
      );
    }
  };

  // Vérifier si un pas de temps est valide selon la période actuelle
  const isTimeStepValidForCurrentRange = (timeStep: string): boolean => {
    const maxDays = getMaxHistoryDays(timeStep);
    if (!maxDays) return true; // Pas de limite, toujours valide

    const timeRange = state.chartControls.timeRange;
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
    let wasAdjusted = false;

    if (timeRange.type === "preset" && timeRange.preset) {
      const presetDays = {
        "3h": 0.125,
        "24h": 1,
        "7d": 7,
        "30d": 30,
      }[timeRange.preset];

      if (presetDays > maxDays) {
        // Convertir en période personnalisée limitée
        const maxStartDate = new Date(
          now.getTime() - maxDays * 24 * 60 * 60 * 1000
        );
        adjustedRange = {
          type: "custom",
          custom: {
            startDate: maxStartDate.toISOString().split("T")[0],
            endDate: now.toISOString().split("T")[0],
          },
        };
        wasAdjusted = true;
      }
    } else if (timeRange.type === "custom" && timeRange.custom) {
      const startDate = new Date(timeRange.custom.startDate);
      const endDate = new Date(timeRange.custom.endDate);
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > maxDays) {
        const maxStartDate = new Date(
          endDate.getTime() - maxDays * 24 * 60 * 60 * 1000
        );
        adjustedRange = {
          type: "custom",
          custom: {
            startDate: maxStartDate.toISOString().split("T")[0],
            endDate: timeRange.custom.endDate,
          },
        };
        wasAdjusted = true;
      }
    }

    return { adjustedRange, wasAdjusted };
  };

  const handleTimeStepChange = (timeStep: string) => {
    if (isHistoricalLocked) {
      return;
    }

    if (!isTimeStepSupportedByAtmoMicro(timeStep)) {
      const fallbackTimeStep = getMicroFallbackTimeStep();
      setState((prev) => ({
        ...prev,
        infoMessage: t("panels.stationSidePanel.timeStepNotSupported"),
      }));
      if (fallbackTimeStep !== timeStep) {
        handleTimeStepChange(fallbackTimeStep);
      }
      return;
    }

    // Ajuster la période si nécessaire
    const { adjustedRange: adjustedTimeRange, wasAdjusted } =
      adjustTimeRangeIfNeeded(state.chartControls.timeRange, timeStep);

    // Si la période a été ajustée, afficher un message d'information
    let infoMessage: string | null = null;
    if (wasAdjusted) {
      const maxDays = getMaxHistoryDays(timeStep);
      if (maxDays) {
        infoMessage = t("panels.stationSidePanel.periodAutoAdjusted", {
          maxDays,
        });
        // Faire disparaître le message après 5 secondes
        setTimeout(() => {
          setState((current) => ({
            ...current,
            infoMessage: null,
          }));
        }, 5000);
      }
    }

    // Désactiver la modélisation si on change de pas de temps et que ce n'est pas horaire
    if (timeStep !== "heure" && showModeling) {
      setShowModeling(false);
      setModelingData({});
      setLoadingModeling(false);
    }

    setState((prev) => ({
      ...prev,
      chartControls: {
        ...prev.chartControls,
        timeStep,
        timeRange: adjustedTimeRange,
      },
      infoMessage: infoMessage || prev.infoMessage, // Conserver le message existant si pas de nouveau message
    }));

    // Charger les données avec la période ajustée.
    // Ne pas charger la modélisation si le pas de temps n'est pas horaire.
    // IMPORTANT: hors de l'updater de setState. Appelé à l'intérieur, le
    // `setState({ loading: true })` déclenché par loadHistoricalData serait
    // perdu (mise à jour émise pendant la phase de rendu) : aucun indicateur de
    // chargement n'apparaîtrait.
    const shouldLoadModeling = timeStep === "heure" && showModeling;
    if (selectedStation) {
      loadHistoricalData(
        selectedStation,
        state.chartControls.selectedPollutants,
        adjustedTimeRange,
        timeStep,
        shouldLoadModeling,
        stationCoordinates
      );
    }
  };

  useEffect(() => {
    const currentTimeStep = state.chartControls.timeStep;
    if (!isTimeStepSupportedByAtmoMicro(currentTimeStep)) {
      handleTimeStepChange(getMicroFallbackTimeStep());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chartControls.timeStep]);

  const handleHasCorrectedDataChange = (hasCorrected: boolean) => {
    setHasCorrectedData(hasCorrected);
  };

  // Fonction pour formater le pas de temps en secondes vers un format lisible
  const formatTimeStep = (seconds: number | null): string => {
    if (seconds === null) return t("timeSteps.instantane");

    if (seconds < 60) {
      return `scan:${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `scan ${minutes}min`;
    } else if (seconds < 86400) {
      const hours = Math.round(seconds / 3600);
      return `scan:${hours}h`;
    } else {
      const days = Math.round(seconds / 86400);
      return `scan:${days}j`;
    }
  };

  // Fonction pour rendre le contenu du panel
  const renderPanelContent = () => {
    if (!selectedStation) return null;

    return (
      <SidePanelShell
        isOpen={isOpen}
        panelSize={panelSize}
        onSizeChange={onSizeChange}
        onHidden={onHidden}
        testId="micro-side-panel"
        title={t("panels.stationSidePanel.comparisonTitle")}
        badge={
          <PanelReopenBadge
            label={t("panels.stationSidePanel.reopenButtonTooltip")}
          />
        }
      >
        {/* Informations station sélectionnée */}
        <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4">
          <div className="flex items-start justify-between space-x-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[color:var(--fg)] truncate">
                {selectedStation.name}
              </p>
              <p className="text-xs text-[color:var(--fg-muted)] truncate">
                {t("panels.microSidePanel.sourceLabel")}
              </p>
            </div>

            {/* Bouton mode comparaison */}
            {onComparisonModeToggle && (
              <button
                onClick={() => {
                  if (isHistoricalLocked) {
                    return;
                  }
                  // Passer le polluant actuellement sélectionné dans le panel
                  const currentPollutant =
                    state.chartControls.selectedPollutants[0] ||
                    initialPollutant;
                  onComparisonModeToggle(currentPollutant);
                }}
                disabled={isHistoricalLocked}
                className={`px-3 py-1.5 rounded-[var(--r-sm)] text-xs transition-all duration-200 flex items-center ${
                  isHistoricalLocked
                    ? "text-[color:var(--fg-muted)] bg-[rgb(16_32_56_/_0.03)] border border-[rgb(16_32_56_/_0.09)] opacity-50 cursor-not-allowed"
                    : isComparisonMode
                    ? "text-green-700 bg-green-50 border border-green-200"
                    : "text-[color:var(--fg-muted)] hover:bg-black/5 border border-[rgb(16_32_56_/_0.09)]"
                }`}
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                {isComparisonMode
                  ? t("panels.stationSidePanel.disableComparison")
                  : t("panels.stationSidePanel.enableComparison")}
              </button>
            )}
          </div>
        </div>

        {/* Graphique avec contrôles intégrés */}
        <div className="flex-1 min-h-64 sm:min-h-72 md:min-h-80 lg:min-h-96">
          <div className="mb-2 sm:mb-3">
            <h3 className="text-sm font-medium text-[color:var(--fg-muted)]">
              {t("panels.microSidePanel.temporalEvolutionAtmoMicro")}
            </h3>
          </div>
          {isInitialChartLoading ? (
            <div className="flex items-center justify-center h-64 sm:h-72 md:h-80 lg:h-96 bg-[rgb(16_32_56_/_0.03)] rounded-[var(--r-md)]">
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#4271B3]"></div>
                <span className="text-xs sm:text-sm text-[color:var(--fg-muted)]">
                  {t("panels.loadingData")}
                </span>
              </div>
            </div>
          ) : state.error ? (
            <div className="flex items-center justify-center h-64 sm:h-72 md:h-80 lg:h-96 bg-red-50 rounded-[var(--r-md)]">
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
                  {state.error}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
              {/* Polluants et Options avancées sur la même ligne (responsive: empilés sur mobile) */}
              <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
                {/* Sélection des polluants */}
                <div className="flex-1 min-w-0 sm:max-w-[260px] border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] flex flex-col">
                  <button
                    onClick={() => {
                      if (isHistoricalLocked) {
                        return;
                      }
                      setShowPollutantsList(!showPollutantsList);
                    }}
                    disabled={isHistoricalLocked}
                    className={`w-full h-11 flex items-center justify-between px-2 sm:px-3 text-left transition-colors rounded-[var(--r-md)] shrink-0 ${
                      isHistoricalLocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-black/5"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[color:var(--fg-muted)] flex-shrink-0"
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
                      <span className="text-xs sm:text-sm font-medium text-[color:var(--fg-muted)] truncate">
                        {t("panels.microSidePanel.pollutantsLabel")}
                      </span>
                      <span className="text-[10px] sm:text-xs text-[color:var(--fg-muted)] bg-[rgb(16_32_56_/_0.06)] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0">
                        {state.chartControls.selectedPollutants.length}
                      </span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[color:var(--fg-muted)] transition-transform flex-shrink-0 ${
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
                      {Object.entries(pollutants).map(
                        ([pollutantCode, pollutant]) => {
                          // Vérifier si ce polluant est disponible dans la station
                          const isEnabled =
                            isPollutantAvailable(pollutantCode);
                          const isSelected =
                            state.chartControls.selectedPollutants.includes(
                              pollutantCode
                            );
                          const isLastSelectedAndDisabled =
                            isSelected &&
                            state.chartControls.selectedPollutants
                              .length === 1;

                          return (
                            <button
                              key={pollutantCode}
                              onClick={() =>
                                isEnabled &&
                                handlePollutantToggle(pollutantCode)
                              }
                              disabled={
                                !isEnabled ||
                                isLastSelectedAndDisabled ||
                                chartControlsDisabled
                              }
                              title={
                                isLastSelectedAndDisabled
                                  ? t(
                                      "panels.stationSidePanel.atLeastOnePollutant"
                                    )
                                  : !isEnabled
                                  ? t(
                                      "panels.stationSidePanel.pollutantNotAvailable"
                                    )
                                  : undefined
                              }
                              className={`w-full flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[var(--r-sm)] text-sm transition-all duration-200 ${
                                !isEnabled
                                  ? "text-[color:var(--fg-muted)] cursor-not-allowed"
                                  : isLastSelectedAndDisabled
                                  ? "text-[#1f3c6d] bg-[#e7eef8] border border-[#c1d3eb] opacity-70 cursor-not-allowed"
                                  : isSelected
                                  ? "text-[#1f3c6d] bg-[#e7eef8] border border-[#c1d3eb]"
                                  : "text-[color:var(--fg-muted)] hover:bg-black/5"
                              }`}
                            >
                              <div
                                className={`w-3 h-3 rounded border mr-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                  !isEnabled
                                    ? "border-[rgb(16_32_56_/_0.14)] bg-[rgb(16_32_56_/_0.06)]"
                                    : isLastSelectedAndDisabled
                                    ? "bg-[#325a96] border-[#325a96] opacity-60"
                                    : isSelected
                                    ? "bg-[#325a96] border-[#325a96]"
                                    : "border-[rgb(16_32_56_/_0.14)]"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className={`w-2 h-2 ${
                                      isLastSelectedAndDisabled
                                        ? "text-white opacity-60"
                                        : "text-white"
                                    }`}
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
                                {t(`pollutants.${pollutantCode}`)}
                              </span>
                              {!isEnabled && (
                                <span className="text-xs text-[color:var(--fg-muted)] flex-shrink-0">
                                  {t(
                                    "panels.stationSidePanel.notAvailable"
                                  )}
                                </span>
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                {/* Menu Expert - Options avancées (largeur naturelle, même hauteur que le bouton polluants) */}
                <div className="flex-none flex flex-col [&_button]:h-11 [&_button]:shrink-0">
                  <ExpertMenu
                  showModeling={showModeling}
                  onModelingChange={(checked) => {
                    setShowModeling(checked);
                    if (
                      checked &&
                      selectedStation &&
                      stationCoordinates
                    ) {
                      // Charger les données de modélisation pour tous les polluants actuellement sélectionnés
                      const pollutantsToLoad =
                        state.chartControls.selectedPollutants;
                      loadHistoricalData(
                        selectedStation,
                        pollutantsToLoad,
                        state.chartControls.timeRange,
                        state.chartControls.timeStep,
                        true,
                        stationCoordinates
                      );
                    } else if (!checked) {
                      setModelingData({});
                    }
                  }}
                  loadingModeling={loadingModeling}
                  modelingDisabled={state.chartControls.timeStep !== "heure"}
                  modelingDisabledReason={
                    state.chartControls.timeStep !== "heure"
                      ? t(
                          "panels.stationSidePanel.modelingOnlyHourly"
                        )
                      : undefined
                  }
                  showRawData={showRawData}
                  onRawDataChange={(checked) => setShowRawData(checked)}
                  rawDataAvailable={hasCorrectedData}
                  hideThresholdBackgroundForColorblind={
                    hideThresholdBackgroundForColorblind
                  }
                  onHideThresholdBackgroundForColorblindChange={
                    setHideThresholdBackgroundForColorblind
                  }
                  historicalLocked={isHistoricalLocked}
                />
                </div>
              </div>

              {state.infoMessage && (
                <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-[var(--r-md)] text-xs sm:text-sm text-blue-800 flex items-start space-x-2">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 mt-0.5"
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
                  <span className="leading-normal">
                    {state.infoMessage}
                  </span>
                </div>
              )}

              {/* Graphique */}
              <div className="relative h-80 sm:h-72 md:h-80 lg:h-96 mb-2 sm:mb-3 md:mb-4">
                <HistoricalChart
                  data={state.historicalData}
                  selectedPollutants={
                    state.chartControls.selectedPollutants
                  }
                  source="atmoMicro"
                  onHasCorrectedDataChange={handleHasCorrectedDataChange}
                  showRawData={showRawData}
                  stationInfo={selectedStation}
                  timeStep={dataTimeStep}
                  sensorTimeStep={sensorTimeStep}
                  modelingData={
                    showModeling && Object.keys(modelingData).length > 0
                      ? modelingData
                      : undefined
                  }
                  hideThresholdBackgroundForColorblind={
                    hideThresholdBackgroundForColorblind
                  }
                  playbackMarkerDate={historicalMode?.currentDate}
                  xAxisMin={historicalMode?.startDate}
                  xAxisMax={historicalMode?.endDate}
                />
                {state.loading && <ChartLoadingOverlay />}
              </div>

              {/* Contrôles du graphique - en bas du graphique */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
                {/* Contrôles de la période - Utilisation du composant réutilisable */}
                <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-2 sm:p-2.5 md:p-3">
                  <HistoricalTimeRangeSelector
                    timeRange={state.chartControls.timeRange}
                    onTimeRangeChange={handleTimeRangeChange}
                    timeStep={state.chartControls.timeStep}
                    disabled={isHistoricalLocked || chartControlsDisabled}
                  />
                </div>

                {/* Contrôles du pas de temps */}
                <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-2 sm:p-2.5 md:p-3 rtl-on-ar">
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
                  <ToggleGroup
                    type="single"
                    value={state.chartControls.timeStep}
                    onValueChange={(value) => {
                      if (isHistoricalLocked || chartControlsDisabled) {
                        return;
                      }
                      if (value && !isTimeStepValidForCurrentRange(value)) {
                        return;
                      }
                      if (value) {
                        handleTimeStepChange(value);
                      }
                    }}
                    className="w-full"
                  >
                    {MICRO_TIME_STEP_OPTIONS.map(({ key, labelKey, shortLabelKey }) => {
                      const isDisabledByRange =
                        !isTimeStepValidForCurrentRange(key);
                      const isDisabledBySupport =
                        !isTimeStepSupportedByAtmoMicro(key);
                      const isDisabled =
                        isHistoricalLocked ||
                        chartControlsDisabled ||
                        isDisabledByRange ||
                        isDisabledBySupport;
                      const maxDays = getMaxHistoryDays(key);
                      const label = t(`panels.stationSidePanel.${labelKey}`);
                      const shortLabel = t(`panels.stationSidePanel.${shortLabelKey}`);
                      const displayLabel =
                        key === "instantane" && sensorTimeStep !== null
                          ? formatTimeStep(sensorTimeStep)
                          : label;
                      const displayShort =
                        key === "instantane" && sensorTimeStep !== null
                          ? formatTimeStep(sensorTimeStep)
                          : shortLabel;

                      let tooltip = displayLabel;
                      if (isDisabledByRange && maxDays) {
                        tooltip = t(
                          "panels.stationSidePanel.timeStepRangeLimit",
                          { maxDays }
                        );
                      } else if (isDisabledBySupport) {
                        tooltip = t("panels.stationSidePanel.timeStepNotSupported");
                      }

                      return (
                        <ToggleGroupItem
                          key={key}
                          value={key}
                          disabled={isDisabled}
                          className={cn(
                            "text-xs min-w-0",
                            isDisabled && "opacity-50"
                          )}
                          title={tooltip}
                        >
                          <span className="time-step-button-full truncate">
                            {displayLabel}
                          </span>
                          <span className="time-step-button-short truncate">
                            {displayShort}
                          </span>
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>

                  {/* Message explicatif si des boutons sont désactivés à cause de la période */}
                  {(() => {
                    const disabledByRange = MICRO_TIME_STEP_OPTIONS.filter(
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
                          return `${t(`panels.stationSidePanel.${labelKey}`)} (max: ${daysText})`;
                        })
                        .filter(Boolean);

                      return (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-[var(--r-sm)]">
                          <p className="text-[11px] sm:text-xs text-amber-700">
                            {t(
                              "panels.stationSidePanel.timeStepsDisabledByRange",
                              {
                                labels: timeStepLabels.join(", "),
                              }
                            )}
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

        {/* Section Informations et Photo du capteur */}
        {selectedStation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Photo du capteur */}
            <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] overflow-hidden">
              {getSensorModelImage(selectedStation.sensorModel) ? (
                <div className="relative w-full aspect-video">
                  <img
                    src={getSensorModelImage(selectedStation.sensorModel)!}
                    alt={t("panels.microSidePanel.sensorAlt", {
                      model:
                        selectedStation.sensorModel || "AtmoMicro",
                    })}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Masquer l'image si elle ne se charge pas
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {selectedStation.sensorModel && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs sm:text-sm font-medium">
                        {t("tooltip.model")} {selectedStation.sensorModel}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-12 h-12 text-blue-400 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      />
                    </svg>
                    <p className="text-blue-600 text-xs font-medium">
                      {selectedStation.sensorModel ||
                        t("panels.microSidePanel.sensorFallback")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Encart Informations */}
            <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-[color:var(--fg)] mb-3 flex items-center">
                <svg
                  className="w-4 h-4 text-blue-600 mr-2"
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
                {t("panels.microSidePanel.infoCardTitle")}
              </h3>
              <div className="space-y-2">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2"></div>
                  <div className="flex-1">
                    <p className="text-xs text-[color:var(--fg-muted)]">
                      {t("panels.microSidePanel.infoCardComingSoon")}
                    </p>
                  </div>
                </div>
              </div>
              <a
                href={ATMOMICRO_DISCOVER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full bg-[#4271B3] hover:bg-[#325a96] text-white font-medium py-2 px-3 rounded-[var(--r-sm)] transition-colors flex items-center justify-center text-xs sm:text-sm"
              >
                {t("panels.microSidePanel.buttonDiscover")}
              </a>
            </div>
          </div>
        )}
    </SidePanelShell>
    );
  };

  if (!selectedStation) {
    return null;
  }

  // Le montage, l'animation de sortie et son portail appartiennent
  // désormais à SidePanelShell : il ne reste que la garde sur les données.
  return renderPanelContent();
};

export default MicroSidePanel;
