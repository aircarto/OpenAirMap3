import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  StationInfo,
  ChartControls,
  HistoricalDataPoint,
  SidePanelState,
  ATMOREF_POLLUTANT_MAPPING,
} from "../../types";
import { pollutants } from "../../constants/pollutants";
import { pasDeTemps } from "../../constants/timeSteps";
import { AtmoRefService } from "../../services/AtmoRefService";
import { ModelingService } from "../../services/ModelingService";
import { DataServiceFactory } from "../../services/DataServiceFactory";
import HistoricalChart from "../charts/HistoricalChart";
import HistoricalTimeRangeSelector, {
  TimeRange,
  getMaxHistoryDays,
} from "../controls/HistoricalTimeRangeSelector";
import ExpertMenu from "../controls/ExpertMenu";
import { ToggleGroup, ToggleGroupItem } from "../ui/button-group";
import { cn } from "../../lib/utils";

interface StationSidePanelProps {
  isOpen: boolean;
  selectedStation: StationInfo | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange?: (size: "normal" | "fullscreen" | "hidden") => void;
  initialPollutant: string;
  panelSize?: "normal" | "fullscreen" | "hidden";
  onComparisonModeToggle?: (pollutantToPreserve?: string) => void;
  isComparisonMode?: boolean;
}

type PanelSize = "normal" | "fullscreen" | "hidden";

const StationSidePanel: React.FC<StationSidePanelProps> = ({
  isOpen,
  selectedStation,
  onClose,
  onHidden,
  onSizeChange,
  initialPollutant,
  panelSize: externalPanelSize,
  onComparisonModeToggle,
  isComparisonMode = false,
}) => {
  const { t } = useTranslation();
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
  });

  const [internalPanelSize, setInternalPanelSize] =
    useState<PanelSize>("normal");
  const [showPollutantsList, setShowPollutantsList] = useState(false);
  const [showModeling, setShowModeling] = useState(false);
  const [loadingModeling, setLoadingModeling] = useState(false);
  const stationIdRef = useRef<string | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [modelingData, setModelingData] = useState<
    Record<string, HistoricalDataPoint[]>
  >({});
  const [stationCoordinates, setStationCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Utiliser la taille externe si fournie, sinon la taille interne
  const currentPanelSize = externalPanelSize || internalPanelSize;

  // Créer les services une seule fois avec useRef pour éviter les recréations
  // Utiliser DataServiceFactory pour obtenir une instance singleton partagée
  const atmoRefServiceRef = useRef<AtmoRefService | null>(null);
  const modelingServiceRef = useRef<ModelingService | null>(null);

  if (!atmoRefServiceRef.current) {
    atmoRefServiceRef.current = DataServiceFactory.getService('atmoRef') as AtmoRefService;
  }
  if (!modelingServiceRef.current) {
    modelingServiceRef.current = new ModelingService();
  }

  const atmoRefService = atmoRefServiceRef.current;
  const modelingService = modelingServiceRef.current;

  // Fonction utilitaire pour vérifier si un polluant est disponible dans la station
  const isPollutantAvailable = (pollutantCode: string): boolean => {
    return Object.entries(selectedStation?.variables || {}).some(
      ([code, variable]) => {
        const mappedCode = ATMOREF_POLLUTANT_MAPPING[code];
        return mappedCode === pollutantCode && variable.en_service;
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
      setInternalPanelSize("hidden");
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

      // Utiliser les valeurs par défaut pour timeRange et timeStep
      const defaultTimeRange: TimeRange = {
        type: "preset",
        preset: "24h",
      };
      const defaultTimeStep = "heure";

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
      }));

      // Réinitialiser la taille du panel
      setInternalPanelSize("normal");

      // Réinitialiser le toggle de modélisation et les données de modélisation
      setShowModeling(false);
      setModelingData({});
      setLoadingModeling(false);
      setStationCoordinates(null);

      // Charger les données historiques initiales si des polluants sont disponibles
      if (selectedPollutants.length > 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedStation?.id, initialPollutant]);

  // Récupérer les coordonnées de la station
  useEffect(() => {
    const fetchCoordinates = async () => {
      if (!selectedStation) return;

      try {
        const coords = await atmoRefService.fetchStationCoordinates(
          selectedStation.id
        );
        if (coords) {
          setStationCoordinates(coords);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des coordonnées:", error);
      }
    };

    if (selectedStation && selectedStation.source === "atmoRef") {
      fetchCoordinates();
    }
  }, [selectedStation, atmoRefService]);

  // Recharger les données de modélisation quand les coordonnées sont disponibles et que la modélisation est activée
  // Utiliser une ref pour éviter les rechargements multiples
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
    // 4. L'état a vraiment changé (nouvelle station, modélisation activée, ou coordonnées disponibles)

    // Créer une clé stable pour les coordonnées
    const coordsKey = stationCoordinates
      ? `${stationCoordinates.latitude},${stationCoordinates.longitude}`
      : null;

    const hasStateChanged =
      prevModelingStateRef.current.showModeling !== showModeling ||
      prevModelingStateRef.current.hasCoords !== !!coordsKey ||
      prevModelingStateRef.current.stationId !== selectedStation?.id;

    // Si la station a changé, vider immédiatement les données de modélisation
    if (
      prevModelingStateRef.current.stationId !== selectedStation?.id &&
      prevModelingStateRef.current.stationId !== null
    ) {
      setModelingData({});
      setLoadingModeling(false);
    }

    if (
      showModeling &&
      stationCoordinates &&
      selectedStation &&
      hasStateChanged
    ) {
      prevModelingStateRef.current = {
        showModeling,
        hasCoords: !!coordsKey,
        stationId: selectedStation.id,
      };

      // Utiliser les valeurs actuelles de state de manière stable via setState avec fonction
      // pour éviter d'utiliser state directement qui peut changer
      setState((currentState) => {
        if (currentState.chartControls.selectedPollutants.length > 0) {
          // Appeler loadHistoricalData de manière asynchrone pour ne pas bloquer le setState
          setTimeout(() => {
            loadHistoricalData(
              selectedStation,
              currentState.chartControls.selectedPollutants,
              currentState.chartControls.timeRange,
              currentState.chartControls.timeStep,
              true,
              stationCoordinates
            );
          }, 0);
        }
        return currentState; // Ne pas modifier l'état, juste déclencher le chargement
      });
    } else if (!showModeling && hasStateChanged) {
      // Si la modélisation est désactivée, juste mettre à jour la ref
      prevModelingStateRef.current = {
        showModeling: false,
        hasCoords: !!coordsKey,
        stationId: selectedStation?.id || null,
      };
      setModelingData({});
      setLoadingModeling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stationCoordinates?.latitude,
    stationCoordinates?.longitude,
    showModeling,
    selectedStation?.id,
  ]);

  // Ref pour éviter les appels multiples simultanés
  const isLoadingRef = useRef(false);
  const lastLoadParamsRef = useRef<string>("");

  const loadHistoricalData = useCallback(
    async (
      station: StationInfo,
      pollutants: string[],
      timeRange: TimeRange,
      timeStep: string,
      shouldLoadModeling?: boolean,
      coords?: { latitude: number; longitude: number } | null
    ) => {
      // Créer une clé unique pour cette requête
      const loadKey = `${station.id}-${pollutants.join(",")}-${JSON.stringify(
        timeRange
      )}-${timeStep}-${shouldLoadModeling}-${
        coords ? `${coords.latitude},${coords.longitude}` : ""
      }`;

      // Éviter les appels multiples avec les mêmes paramètres
      if (isLoadingRef.current && lastLoadParamsRef.current === loadKey) {
        return;
      }

      isLoadingRef.current = true;
      lastLoadParamsRef.current = loadKey;
      // Pour l'instant, on ne supporte que AtmoRef
      // TODO: Ajouter le support pour d'autres sources
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { startDate, endDate } = getDateRange(timeRange);
        const newHistoricalData: Record<string, HistoricalDataPoint[]> = {};

        // Charger les données pour chaque polluant sélectionné
        for (const pollutant of pollutants) {
          const data = await atmoRefService.fetchHistoricalData({
            stationId: station.id,
            pollutant,
            timeStep,
            startDate,
            endDate,
          });
          newHistoricalData[pollutant] = data;
        }

        // Fusionner avec les données existantes au lieu de les remplacer
        // Cela permet de conserver les données des autres polluants déjà chargés
        setState((prev) => {
          // Fusionner les nouvelles données avec les données existantes
          const mergedHistoricalData = {
            ...prev.historicalData,
            ...newHistoricalData,
          };

          // Comparer les données de manière optimisée
          // Comparer d'abord les clés pour éviter les comparaisons JSON coûteuses
          const prevKeys = Object.keys(prev.historicalData).sort().join(",");
          const newKeys = Object.keys(mergedHistoricalData).sort().join(",");

          if (prevKeys === newKeys) {
            // Si les clés sont identiques, comparer le contenu pour les polluants chargés
            let dataChanged = false;
            for (const key of Object.keys(newHistoricalData)) {
              const prevData = prev.historicalData[key];
              const newData = newHistoricalData[key];
              if (!prevData || prevData.length !== newData.length) {
                dataChanged = true;
                break;
              }
              // Comparer les premiers et derniers points pour une vérification rapide
              if (prevData.length > 0 && newData.length > 0) {
                if (
                  JSON.stringify(prevData[0]) !== JSON.stringify(newData[0]) ||
                  JSON.stringify(prevData[prevData.length - 1]) !==
                    JSON.stringify(newData[newData.length - 1])
                ) {
                  dataChanged = true;
                  break;
                }
              }
            }

            if (!dataChanged && !prev.loading) {
              // Si les données n'ont pas changé et qu'on n'est pas en train de charger, ne pas mettre à jour
              return prev;
            }
          }

          return {
            ...prev,
            historicalData: mergedHistoricalData,
            loading: false,
          };
        });

        // Charger les données de modélisation si activé et si on a les coordonnées
        const loadModeling =
          shouldLoadModeling !== undefined ? shouldLoadModeling : showModeling;
        const coordinates = coords !== undefined ? coords : stationCoordinates;

        if (loadModeling && coordinates) {
          setLoadingModeling(true);
          const newModelingData: Record<string, HistoricalDataPoint[]> = {};

          try {
            for (const pollutant of pollutants) {
              // Vérifier si le polluant est supporté par l'API de modélisation
              if (modelingService.isPollutantSupported(pollutant)) {
                try {
                  // Utiliser la date de fin comme datetime_echeance pour obtenir les prévisions
                  // L'API retourne toutes les échéances si with_list=true
                  const modelingPoints =
                    await modelingService.fetchModelingData({
                      longitude: coordinates.longitude,
                      latitude: coordinates.latitude,
                      pollutant,
                      datetimeEcheance: endDate,
                      withList: true,
                    });

                  // Filtrer les données de modélisation pour inclure la plage de dates + les prévisions (+24h)
                  const filteredModelingPoints = modelingPoints.filter(
                    (point) => {
                      const pointDate = new Date(point.timestamp);
                      const start = new Date(startDate);
                      const end = new Date(endDate);
                      // Ajouter 24 heures pour inclure les prévisions
                      const endWithForecast = new Date(end.getTime() + 24 * 60 * 60 * 1000);
                      return pointDate >= start && pointDate <= endWithForecast;
                    }
                  );

                  // Utiliser la même convention de nommage que MicroSidePanel : ${pollutant}_modeling
                  newModelingData[`${pollutant}_modeling`] =
                    filteredModelingPoints;
                } catch (error) {
                  console.error(
                    `Erreur lors du chargement des données de modélisation pour ${pollutant}:`,
                    error
                  );
                  // Continuer même en cas d'erreur pour un polluant
                }
              }
            }

            setModelingData(newModelingData);
          } finally {
            setLoadingModeling(false);
          }
        } else if (!loadModeling) {
          // Réinitialiser les données de modélisation si désactivé
          setModelingData({});
          setLoadingModeling(false);
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des données historiques:",
          error
        );
        setState((prev) => ({
          ...prev,
          loading: false,
          error: t("panels.stationSidePanel.historicalDataLoadError"),
        }));
      } finally {
        isLoadingRef.current = false;
      }
    },
    [t]
  );

  const getDateRange = (
    timeRange: TimeRange
  ): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = now.toISOString();

    // Si c'est une plage personnalisée, utiliser les dates fournies
    if (timeRange.type === "custom" && timeRange.custom) {
      // Créer les dates en heure LOCALE (sans Z), puis convertir en UTC
      // Cela permet d'avoir 00:00-23:59 en heure locale, pas en UTC
      const startDate = new Date(timeRange.custom.startDate + "T00:00:00");
      const endDate = new Date(timeRange.custom.endDate + "T23:59:59.999");

      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
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

      // Recharger les données si le polluant n'était pas encore chargé et qu'on l'ajoute
      const isAddingPollutant =
        !prev.chartControls.selectedPollutants.includes(pollutant);
      if (
        isAddingPollutant &&
        selectedStation &&
        !prev.historicalData[pollutant]
      ) {
        // Charger les données de manière asynchrone pour ne pas bloquer la mise à jour de l'état
        setTimeout(() => {
          // Si la modélisation est activée, charger la modélisation pour TOUS les polluants sélectionnés
          // Sinon, charger seulement les données historiques pour le nouveau polluant
          if (showModeling && stationCoordinates) {
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
            loadHistoricalData(
              selectedStation,
              [pollutant], // Seulement le nouveau polluant
              prev.chartControls.timeRange,
              prev.chartControls.timeStep,
              false, // Ne pas charger la modélisation
              stationCoordinates
            );
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
    setState((prev) => {
      // Vérifier et ajuster la période si nécessaire selon le pas de temps actuel
      const { adjustedRange: validatedTimeRange, wasAdjusted } =
        adjustTimeRangeIfNeeded(timeRange, prev.chartControls.timeStep);

      // Si la période a été ajustée, afficher un message d'information
      let infoMessage: string | null = null;
      if (wasAdjusted) {
        const maxDays = getMaxHistoryDays(prev.chartControls.timeStep);
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

      // Charger les données avec la période validée
      if (selectedStation) {
        loadHistoricalData(
          selectedStation,
          prev.chartControls.selectedPollutants,
          validatedTimeRange,
          prev.chartControls.timeStep,
          showModeling,
          stationCoordinates
        );
      }

      return {
        ...prev,
        chartControls: {
          ...prev.chartControls,
          timeRange: validatedTimeRange,
        },
        infoMessage,
      };
    });
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
    setState((prev) => {
      // Désactiver la modélisation si on change de pas de temps et que ce n'est pas horaire
      if (timeStep !== "heure" && showModeling) {
        setShowModeling(false);
        setModelingData({});
        setLoadingModeling(false);
      }

      // Ajuster la période si nécessaire
      const { adjustedRange: adjustedTimeRange, wasAdjusted } =
        adjustTimeRangeIfNeeded(prev.chartControls.timeRange, timeStep);

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

      // Charger les données avec la période ajustée
      // Ne pas charger la modélisation si le pas de temps n'est pas horaire
      const shouldLoadModeling = timeStep === "heure" && showModeling;
      if (selectedStation) {
        loadHistoricalData(
          selectedStation,
          prev.chartControls.selectedPollutants,
          adjustedTimeRange,
          timeStep,
          shouldLoadModeling,
          stationCoordinates
        );
      }

      return {
        ...prev,
        chartControls: {
          ...prev.chartControls,
          timeStep,
          timeRange: adjustedTimeRange,
        },
        infoMessage,
      };
    });
  };

  const handlePanelSizeChange = (newSize: PanelSize) => {
    // Si on passe à "hidden", déclencher l'animation de sortie
    if (newSize === "hidden" && currentPanelSize !== "hidden") {
      // IMPORTANT: Mettre à jour immédiatement la taille pour retirer le panel du flux flex
      // Cela permet à la carte de se redimensionner immédiatement
      if (onSizeChange) {
        onSizeChange(newSize);
      } else {
        setInternalPanelSize(newSize);
      }

      // Ensuite, déclencher l'animation de sortie
      setIsAnimatingOut(true);

      // Nettoyer le timeout précédent s'il existe
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // Après l'animation, nettoyer l'état et appeler le callback
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimatingOut(false);
        if (onHidden) {
          onHidden();
        }
      }, 300); // Durée de l'animation
    } else {
      // Pour les autres changements, réinitialiser l'animation et mettre à jour immédiatement
      setIsAnimatingOut(false);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (onSizeChange) {
        onSizeChange(newSize);
      } else {
        setInternalPanelSize(newSize);
      }
    }
  };

  // Réinitialiser l'animation quand le panel s'ouvre
  useEffect(() => {
    if (isOpen && currentPanelSize !== "hidden") {
      setIsAnimatingOut(false);
    }
  }, [isOpen, currentPanelSize]);

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const getPanelClasses = () => {
    const baseClasses =
      "bg-white shadow-xl flex flex-col border-r border-gray-200 h-full md:h-[calc(100vh-64px)] relative z-[1500]";

    // Si on est en train d'animer la sortie, utiliser fixed pour rester visible pendant l'animation
    // mais le panelSize est déjà "hidden" donc le panel est retiré du flux flex
    if (isAnimatingOut) {
      // Calculer la largeur actuelle pour l'animation
      const widthClass =
        "w-full sm:w-[320px] md:w-[400px] lg:w-[600px] xl:w-[650px]";
      // Utiliser fixed pour positionner le panel pendant l'animation
      // will-change optimise les performances de l'animation
      return `${baseClasses} fixed left-0 top-0 ${widthClass} animate-slide-out-left will-change-transform`;
    }

    // Classes d'animation d'entrée
    const animationClasses =
      currentPanelSize !== "hidden" && !isAnimatingOut
        ? "animate-slide-in-left"
        : "";

    switch (currentPanelSize) {
      case "fullscreen":
        // En fullscreen, utiliser absolute pour ne pas affecter le layout de la carte
        return `${baseClasses} absolute inset-0 w-full transition-all duration-300 ${animationClasses}`;
      case "hidden":
        // Retirer complètement du flux pour éviter l'espace réservé
        // Mais si on anime, on ne doit pas être ici car isAnimatingOut gère ce cas
        return `${baseClasses} hidden`;
      case "normal":
      default:
        // Responsive: plein écran sur mobile, largeur réduite pour les petits écrans en paysage
        return `${baseClasses} w-full sm:w-[320px] md:w-[400px] lg:w-[600px] xl:w-[650px] transition-all duration-300 ${animationClasses}`;
    }
  };

  // Fonction pour rendre le contenu du panel
  const renderPanelContent = () => {
    if (!selectedStation) return null;

    return (
      <div className={getPanelClasses()}>
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-3 md:p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                {t("panels.stationSidePanel.comparisonTitle")}
              </h2>
              {/* Rappel visuel du bouton de réouverture */}
              <div
                className="p-1 rounded bg-blue-600 border border-blue-600"
                title={t("panels.stationSidePanel.reopenButtonTooltip")}
              >
                <svg
                  className="w-3 h-3 text-white"
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
              </div>
            </div>
          </div>

          {/* Contrôles unifiés du panel */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Bouton agrandir/rétrécir */}
            <button
              onClick={() =>
                handlePanelSizeChange(
                  currentPanelSize === "fullscreen" ? "normal" : "fullscreen"
                )
              }
              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={
                currentPanelSize === "fullscreen"
                  ? t("panels.shrinkPanel")
                  : t("panels.expandPanel")
              }
            >
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {currentPanelSize === "fullscreen" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                )}
              </svg>
            </button>

            {/* Bouton rabattre */}
            <button
              onClick={() => handlePanelSizeChange("hidden")}
              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={t("panels.collapsePanel")}
            >
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
        </div>

        {/* Contenu - masqué quand currentPanelSize === 'hidden' */}
        {currentPanelSize !== "hidden" && (
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4 md:space-y-6">
            {/* Informations station sélectionnée */}
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start justify-between space-x-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {selectedStation.name.replace("_", " ")}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {t("panels.stationSidePanel.stationSourceAtmoRef")}
                    {selectedStation.address
                      ? ` · ${selectedStation.address}`
                      : ""}
                  </p>
                </div>

                {/* Bouton mode comparaison */}
                {onComparisonModeToggle && (
                  <button
                    onClick={() => {
                      // Passer le polluant actuellement sélectionné dans le panel
                      const currentPollutant =
                        state.chartControls.selectedPollutants[0] ||
                        initialPollutant;
                      onComparisonModeToggle(currentPollutant);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs transition-all duration-200 flex items-center ${
                      isComparisonMode
                        ? "text-green-700 bg-green-50 border border-green-200"
                        : "text-gray-700 hover:bg-gray-50 border border-gray-200"
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
            <div className="flex-1 min-h-64 sm:min-h-80 md:min-h-96 lg:min-h-[28rem]">
              <div className="mb-2 sm:mb-3">
                <h3 className="text-sm font-medium text-gray-700">
                  {t("panels.stationSidePanel.temporalEvolution")}
                </h3>
              </div>
              {state.loading ? (
                <div className="flex items-center justify-center h-64 sm:h-80 md:h-96 lg:h-[28rem] bg-gray-50 rounded-lg">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#4271B3]"></div>
                    <span className="text-xs sm:text-sm text-gray-500">
                      {t("panels.loadingData")}
                    </span>
                  </div>
                </div>
              ) : state.error ? (
                <div className="flex items-center justify-center h-64 sm:h-80 md:h-96 lg:h-[28rem] bg-red-50 rounded-lg">
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
                <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
                  {/* Polluants et Options avancées sur la même ligne (responsive: empilés sur mobile) */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 items-start">
                    {/* Sélection des polluants */}
                    <div className="flex-1 min-w-0 sm:max-w-[260px] border border-gray-200 rounded-lg flex flex-col">
                      <button
                        onClick={() => setShowPollutantsList(!showPollutantsList)}
                        className="w-full h-11 flex items-center justify-between px-2.5 sm:px-3 text-left hover:bg-gray-50 transition-colors rounded-lg shrink-0"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <svg
                            className="w-4 h-4 text-gray-600 flex-shrink-0"
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
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {t("panels.stationSidePanel.pollutantsDisplayed")}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
                            {t(
                              "panels.stationSidePanel.selectedCount",
                              {
                                count: state.chartControls.selectedPollutants
                                  .length,
                              }
                            )}
                          </span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
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
                              // Trouver si ce polluant est disponible dans la station
                              const availableVariable = Object.entries(
                                selectedStation.variables
                              ).find(([code, variable]) => {
                                const mappedCode =
                                  ATMOREF_POLLUTANT_MAPPING[code];
                                return (
                                  mappedCode === pollutantCode &&
                                  variable.en_service
                                );
                              });

                              const isEnabled = !!availableVariable;
                              const isSelected =
                                state.chartControls.selectedPollutants.includes(
                                  pollutantCode
                                );
                              const isLastSelectedAndDisabled =
                                isSelected &&
                                state.chartControls.selectedPollutants.length ===
                                  1;

                              return (
                                <button
                                  key={pollutantCode}
                                  onClick={() =>
                                    isEnabled &&
                                    handlePollutantToggle(pollutantCode)
                                  }
                                  disabled={
                                    !isEnabled || isLastSelectedAndDisabled
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
                                  className={`w-full flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-sm transition-all duration-200 ${
                                    !isEnabled
                                      ? "text-gray-400 cursor-not-allowed"
                                      : isLastSelectedAndDisabled
                                      ? "text-[#1f3c6d] bg-[#e7eef8] border border-[#c1d3eb] opacity-70 cursor-not-allowed"
                                      : isSelected
                                      ? "text-[#1f3c6d] bg-[#e7eef8] border border-[#c1d3eb]"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <div
                                    className={`w-3 h-3 rounded border mr-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                      !isEnabled
                                        ? "border-gray-300 bg-gray-100"
                                        : isLastSelectedAndDisabled
                                        ? "bg-[#325a96] border-[#325a96] opacity-60"
                                        : isSelected
                                        ? "bg-[#325a96] border-[#325a96]"
                                        : "border-gray-300"
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
                                    <span className="text-xs text-gray-400 flex-shrink-0">
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
                        // Ne permettre l'activation que si le pas de temps est horaire
                        if (
                          state.chartControls.timeStep !== "heure" &&
                          checked
                        ) {
                          return;
                        }
                        setShowModeling(checked);
                        // Recharger les données si on active la modélisation et qu'on a les coordonnées
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
                          setLoadingModeling(false);
                        }
                        // Si on active mais qu'on n'a pas encore les coordonnées, elles seront chargées dans le useEffect
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
                    />
                    </div>
                  </div>

                  {/* Message d'information */}
                  {state.infoMessage && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-800 flex items-start space-x-2">
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      <span className="leading-normal">
                        {state.infoMessage}
                      </span>
                    </div>
                  )}

                  {/* Graphique */}
                  <div className="h-64 sm:h-80 md:h-96 lg:h-[28rem] mb-2 sm:mb-3 md:mb-4">
                    <HistoricalChart
                      data={state.historicalData}
                      selectedPollutants={
                        state.chartControls.selectedPollutants
                      }
                      source="atmoRef"
                      stationInfo={selectedStation}
                      timeStep={state.chartControls.timeStep}
                      modelingData={
                        showModeling && Object.keys(modelingData).length > 0
                          ? modelingData
                          : undefined
                      }
                    />
                  </div>

                  {/* Contrôles du graphique - en bas du graphique */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
                    {/* Contrôles de la période */}
                    <div className="flex-1 border border-gray-200 rounded-lg p-2 sm:p-2.5 md:p-3">
                      <HistoricalTimeRangeSelector
                        timeRange={state.chartControls.timeRange}
                        onTimeRangeChange={handleTimeRangeChange}
                        timeStep={state.chartControls.timeStep}
                      />
                    </div>

                    {/* Contrôles du pas de temps */}
                    <div className="flex-1 border border-gray-200 rounded-lg p-2 sm:p-2.5 md:p-3">
                      <div className="flex items-center space-x-2 mb-2.5 sm:mb-3">
                        <svg
                          className="w-4 h-4 text-gray-600 flex-shrink-0"
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
                        <span className="text-sm font-medium text-gray-700">
                          {t("controls.timeStep")}
                        </span>
                      </div>
                      <ToggleGroup
                        type="single"
                        value={state.chartControls.timeStep}
                        onValueChange={(value) => {
                          if (value) {
                            const isDisabledByRange =
                              !isTimeStepValidForCurrentRange(value);
                            const alwaysDisabled = value === "instantane"; // Toujours désactivé pour AtmoRef
                            if (!alwaysDisabled && !isDisabledByRange) {
                              handleTimeStepChange(value);
                            }
                          }
                        }}
                        className="w-full"
                      >
                        {[
                          {
                            key: "instantane",
                            label: "Scan",
                            shortLabel: "Scan",
                            alwaysDisabled: true, // Toujours désactivé pour AtmoRef
                          },
                          {
                            key: "quartHeure",
                            label: "15min",
                            shortLabel: "15m",
                            alwaysDisabled: false,
                          },
                          {
                            key: "heure",
                            label: "1h",
                            shortLabel: "1h",
                            alwaysDisabled: false,
                          },
                          {
                            key: "jour",
                            label: "1j",
                            shortLabel: "1j",
                            alwaysDisabled: false,
                          },
                        ].map(({ key, label, shortLabel, alwaysDisabled }) => {
                          const isDisabledByRange =
                            !isTimeStepValidForCurrentRange(key);
                          const isDisabled =
                            alwaysDisabled || isDisabledByRange;
                          const maxDays = getMaxHistoryDays(key);

                          let tooltip = label;
                          if (isDisabledByRange && maxDays) {
                            tooltip = t(
                              "panels.stationSidePanel.timeStepRangeLimit",
                              { maxDays }
                            );
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
                                {key === "instantane" ? "scan : 15min" : label}
                              </span>
                              <span className="time-step-button-short truncate">
                                {shortLabel}
                              </span>
                            </ToggleGroupItem>
                          );
                        })}
                      </ToggleGroup>

                      {/* Message explicatif si des boutons sont désactivés à cause de la période */}
                      {(() => {
                        const disabledByRange = [
                          { key: "instantane", label: "Scan" },
                          { key: "quartHeure", label: "15min" },
                          { key: "heure", label: "1h" },
                          { key: "jour", label: "1j" },
                        ].filter(({ key }) => {
                          const alwaysDisabled = key === "instantane";
                          const isDisabledByRange =
                            !isTimeStepValidForCurrentRange(key);
                          return !alwaysDisabled && isDisabledByRange;
                        });

                        if (disabledByRange.length > 0) {
                          const timeStepLabels = disabledByRange
                            .map(({ key, label }) => {
                              const maxDays = getMaxHistoryDays(key);
                              if (!maxDays) return null;
                              const daysText =
                                maxDays === 60
                                  ? "2 mois"
                                  : maxDays === 180
                                  ? "6 mois"
                                  : `${maxDays} jours`;
                              return `${label} (max ${daysText})`;
                            })
                            .filter(Boolean);

                          return (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
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
          </div>
        )}
      </div>
    );
  };

  if (!isOpen || !selectedStation) {
    return null;
  }

  // Si on anime la sortie ET que panelSize est "hidden", rendre via portal
  // Cela permet de sortir le panel du conteneur flex pour que la carte se redimensionne immédiatement
  if (isAnimatingOut && currentPanelSize === "hidden") {
    return createPortal(renderPanelContent(), document.body);
  }

  // Si le panel est "hidden" et qu'on n'anime pas, ne rien rendre
  if (currentPanelSize === "hidden") {
    return null;
  }

  // Sinon, rendre normalement dans le conteneur flex
  return renderPanelContent();
};

export default StationSidePanel;
