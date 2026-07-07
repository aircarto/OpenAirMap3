import { useState, useCallback, useRef, useEffect } from "react";
import {
  TemporalVisualizationState,
  TemporalControls,
  TemporalDataPoint,
  SignalAirReport,
} from "../types";
import { QualifiedMicroSensorService } from "../services/QualifiedMicroSensorService";
import { AtmoRefService } from "../services/AtmoRefService";
import { NebuleAirService } from "../services/NebuleAirService";
import { SignalAirService } from "../services/SignalAirService";
import { DataServiceFactory } from "../services/DataServiceFactory";
import { filterReportsByDisplayWindow } from "../utils/signalAirDateUtils";

interface UseTemporalVisualizationProps {
  selectedPollutant: string;
  selectedSources: string[];
  timeStep: string;
  /** Activer le chargement des signalements SignalAir pour la période historique */
  signalAirEnabled?: boolean;
  /** Types de signalements à charger (odeur, bruit, brulage, visuel) */
  signalAirSelectedTypes?: string[];
}

export const useTemporalVisualization = ({
  selectedPollutant,
  selectedSources,
  timeStep,
  signalAirEnabled = false,
  signalAirSelectedTypes = [],
}: UseTemporalVisualizationProps) => {
  // État de la visualisation temporelle
  const [state, setState] = useState<TemporalVisualizationState>({
    isActive: false,
    startDate: "",
    endDate: "",
    currentDate: "",
    isPlaying: false,
    playbackSpeed: 1,
    timeStep: timeStep,
    data: [],
    loading: false,
    error: null,
    historicalSignalAirReports: [],
  });

  // Références pour la gestion des intervalles
  const playbackIntervalRef = useRef<number | null>(null);
  const atmoMicroService = useRef(DataServiceFactory.getService('atmoMicro') as QualifiedMicroSensorService);
  const atmoRefService = useRef(DataServiceFactory.getService('atmoRef') as AtmoRefService);
  const nebuleAirService = useRef(DataServiceFactory.getService('nebuleair') as NebuleAirService);
  const signalAirService = useRef(DataServiceFactory.getService('signalair') as SignalAirService);

  // Synchroniser le timeStep du state avec le timeStep des props
  // et réinitialiser les données si elles sont déjà chargées (car elles ne correspondent plus au nouveau pas de temps)
  useEffect(() => {
    setState((prev) => {
      // Si des données sont déjà chargées et que le timeStep change, les réinitialiser
      if (prev.data.length > 0 && prev.timeStep !== timeStep) {
        return {
          ...prev,
          timeStep: timeStep,
          data: [],
          currentDate: "",
          isPlaying: false,
          error: null,
          historicalSignalAirReports: [],
        };
      }
      return {
        ...prev,
        timeStep: timeStep,
      };
    });
  }, [timeStep]);

  // Fonction pour activer/désactiver le mode historique
  const toggleHistoricalMode = useCallback(() => {
    const wasActive = state.isActive;
    setState((prev) => ({
      ...prev,
      isActive: !prev.isActive,
      // Réinitialiser les données quand on désactive
      data: !prev.isActive ? prev.data : [],
      currentDate: !prev.isActive ? prev.currentDate : "",
      historicalSignalAirReports: !prev.isActive ? prev.historicalSignalAirReports : [],
      isPlaying: false,
      error: null,
    }));

    // Arrêter la lecture si on désactive le mode
    if (wasActive) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isPlaying: false,
      }));
    }
  }, [state.isActive]);

  // Fonction pour charger les données historiques
  const loadHistoricalData = useCallback(async () => {
    if (!state.startDate || !state.endDate || state.loading) {
      return;
    }

    // Vérifier qu'au moins une source supportée est sélectionnée
    const supportedSources = [
      "atmoMicro",
      "atmoRef",
      "communautaire.nebuleair",
    ];
    const hasSupportedSource = selectedSources.some((source) =>
      supportedSources.includes(source)
    );

    if (!hasSupportedSource) {
      setState((prev) => ({
        ...prev,
        error:
          "Le mode historique n'est disponible que pour AtmoMicro, AtmoRef et NebuleAir",
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Charger les données de toutes les sources sélectionnées en parallèle
      const promises: Promise<TemporalDataPoint[]>[] = [];

      if (selectedSources.includes("atmoMicro")) {
        promises.push(
          atmoMicroService.current.fetchTemporalData({
            pollutant: selectedPollutant,
            timeStep: state.timeStep,
            startDate: state.startDate,
            endDate: state.endDate,
          })
        );
      }

      if (selectedSources.includes("atmoRef")) {
        promises.push(
          atmoRefService.current.fetchTemporalData({
            pollutant: selectedPollutant,
            timeStep: state.timeStep,
            startDate: state.startDate,
            endDate: state.endDate,
          })
        );
      }

      if (selectedSources.includes("communautaire.nebuleair")) {
        promises.push(
          nebuleAirService.current.fetchTemporalData({
            pollutant: selectedPollutant,
            timeStep: state.timeStep,
            startDate: state.startDate,
            endDate: state.endDate,
          })
        );
      }

      let signalAirReports: SignalAirReport[] = [];
      // Charger SignalAir uniquement si la source est activée.
      if (signalAirEnabled) {
        const signalAirTypes =
          signalAirSelectedTypes.length > 0
            ? signalAirSelectedTypes
            : ["odeur", "bruit", "brulage", "visuel"];
        try {
          const rawResult = await signalAirService.current.fetchData({
            pollutant: selectedPollutant,
            timeStep: state.timeStep,
            sources: ["signalair"],
            signalAirPeriod: {
              startDate: state.startDate,
              endDate: state.endDate,
            },
            signalAirSelectedTypes: signalAirTypes,
          });
          signalAirReports = Array.isArray(rawResult) ? rawResult : [];
        } catch (err) {
          console.warn("SignalAir: erreur lors du chargement historique:", err);
        }
      }

      const results = await Promise.all(promises);

      // Fonction helper pour vérifier si un device a une valeur valide
      const isValidDevice = (device: any): boolean => {
        return (
          device &&
          device.value !== null &&
          device.value !== undefined &&
          !isNaN(device.value) &&
          typeof device.value === "number"
        );
      };

      // Fusionner toutes les données temporelles en groupant par timestamp
      const temporalDataMap = new Map<string, TemporalDataPoint>();
      const TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

      results.forEach((temporalData) => {
        temporalData.forEach((point) => {
          // Filtrer les devices invalides avant la fusion
          const validDevices = point.devices.filter(isValidDevice);
          
          // Si aucun device valide, ignorer ce point
          if (validDevices.length === 0) {
            return;
          }

          // Chercher un timestamp existant proche
          const targetTime = new Date(point.timestamp).getTime();
          let existingTimestamp: string | null = null;

          for (const [timestamp] of temporalDataMap) {
            const timeDiff = Math.abs(
              new Date(timestamp).getTime() - targetTime
            );
            if (timeDiff <= TOLERANCE_MS) {
              existingTimestamp = timestamp;
              break;
            }
          }

          if (existingTimestamp) {
            const existingPoint = temporalDataMap.get(existingTimestamp)!;

            // Fusionner uniquement les devices valides
            existingPoint.devices.push(...validDevices);
            existingPoint.deviceCount = existingPoint.devices.length;

            // Recalculer les niveaux de qualité basés sur les devices valides
            const qualityLevels: Record<string, number> = {};
            existingPoint.devices.forEach((device) => {
              const level = (device as any).qualityLevel || "default";
              qualityLevels[level] = (qualityLevels[level] || 0) + 1;
            });
            existingPoint.qualityLevels = qualityLevels;

            // Recalculer la valeur moyenne uniquement avec les devices valides
            const validDevicesForAverage = existingPoint.devices.filter(isValidDevice);
            const totalValue = validDevicesForAverage.reduce(
              (sum, device) => sum + device.value,
              0
            );
            existingPoint.averageValue =
              validDevicesForAverage.length > 0
                ? totalValue / validDevicesForAverage.length
                : 0;
          } else {
            // Créer un nouveau point temporel avec seulement les devices valides
            const qualityLevels: Record<string, number> = {};
            validDevices.forEach((device) => {
              const level = (device as any).qualityLevel || "default";
              qualityLevels[level] = (qualityLevels[level] || 0) + 1;
            });

            const totalValue = validDevices.reduce(
              (sum, device) => sum + device.value,
              0
            );
            const averageValue =
              validDevices.length > 0 ? totalValue / validDevices.length : 0;

            temporalDataMap.set(point.timestamp, {
              timestamp: point.timestamp,
              devices: validDevices,
              deviceCount: validDevices.length,
              averageValue,
              qualityLevels,
            });
          }
        });
      });

      // Filtrer une dernière fois pour s'assurer qu'aucun device invalide ne passe
      const allTemporalData = Array.from(temporalDataMap.values())
        .map((point) => ({
          ...point,
          devices: point.devices.filter(isValidDevice),
        }))
        .filter((point) => point.devices.length > 0) // Retirer les points sans devices valides
        .map((point) => {
          // Recalculer les métadonnées après le filtrage final
          const qualityLevels: Record<string, number> = {};
          point.devices.forEach((device) => {
            const level = (device as any).qualityLevel || "default";
            qualityLevels[level] = (qualityLevels[level] || 0) + 1;
          });

          const totalValue = point.devices.reduce(
            (sum, device) => sum + device.value,
            0
          );
          const averageValue =
            point.devices.length > 0 ? totalValue / point.devices.length : 0;

          return {
            ...point,
            deviceCount: point.devices.length,
            averageValue,
            qualityLevels,
          };
        })
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      setState((prev) => ({
        ...prev,
        data: allTemporalData,
        currentDate:
          allTemporalData.length > 0
            ? allTemporalData[0].timestamp
            : prev.startDate,
        historicalSignalAirReports: signalAirReports,
        loading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du chargement des données",
      }));
    }
  }, [
    state.startDate,
    state.endDate,
    state.loading,
    selectedPollutant,
    signalAirEnabled,
    state.timeStep,
    selectedSources,
    signalAirSelectedTypes,
  ]);

  // Fonction pour démarrer/arrêter la lecture
  const togglePlayback = useCallback(() => {
    if (state.data.length === 0) return;

    setState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, [state.data.length]);

  // Fonction pour arrêter la lecture
  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isPlaying: false,
    }));
  }, []);

  // Désactiver le mode historique (ex. quand le pas de temps ne le permet plus)
  const exitHistoricalMode = useCallback(() => {
    stopPlayback();
    setState((prev) => ({
      ...prev,
      isActive: false,
      data: [],
      currentDate: "",
      historicalSignalAirReports: [],
      isPlaying: false,
      error: null,
    }));
  }, [stopPlayback]);

  // Fonction pour changer la vitesse de lecture
  const changePlaybackSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, playbackSpeed: speed }));
  }, []);

  // Fonction pour changer la date actuelle
  const changeCurrentDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, currentDate: date }));
  }, []);

  // Fonction pour réinitialiser
  const reset = useCallback(() => {
    stopPlayback();
    setState((prev) => ({
      ...prev,
      startDate: "",
      endDate: "",
      currentDate: "",
      data: [],
      historicalSignalAirReports: [],
      error: null,
    }));
  }, [stopPlayback]);

  // Effet pour gérer la lecture automatique
  useEffect(() => {
    if (state.isPlaying && state.data.length > 0) {
      const interval = setInterval(() => {
        setState((prev) => {
          const currentIndex = prev.data.findIndex(
            (point) => point.timestamp === prev.currentDate
          );

          if (currentIndex === -1 || currentIndex >= prev.data.length - 1) {
            // Fin des données, arrêter la lecture
            stopPlayback();
            return prev;
          }

          const nextIndex = currentIndex + 1;
          return {
            ...prev,
            currentDate: prev.data[nextIndex].timestamp,
          };
        });
      }, 1000 / state.playbackSpeed); // Ajuster selon la vitesse

      playbackIntervalRef.current = interval as any;

      return () => {
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
          playbackIntervalRef.current = null;
        }
      };
    }
  }, [state.isPlaying, state.data, state.playbackSpeed, stopPlayback]);

  // Fonction pour naviguer vers une date spécifique
  const seekToDate = useCallback(
    (targetDate: string) => {
      if (state.data.length === 0) return;

      // Trouver le point temporel le plus proche de la date cible
      const targetTime = new Date(targetDate).getTime();
      let closestPoint = state.data[0];
      let minDiff = Math.abs(
        new Date(closestPoint.timestamp).getTime() - targetTime
      );

      for (const point of state.data) {
        const pointTime = new Date(point.timestamp).getTime();
        const diff = Math.abs(pointTime - targetTime);

        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = point;
        }
      }

      setState((prev) => ({
        ...prev,
        currentDate: closestPoint.timestamp,
      }));
    },
    [state.data]
  );

  // Fonction pour naviguer vers l'étape précédente
  const goToPrevious = useCallback(() => {
    if (state.data.length === 0) return;

    const currentIndex = state.data.findIndex(
      (point) => point.timestamp === state.currentDate
    );

    if (currentIndex > 0) {
      setState((prev) => ({
        ...prev,
        currentDate: prev.data[currentIndex - 1].timestamp,
      }));
    }
  }, [state.data, state.currentDate]);

  // Fonction pour naviguer vers l'étape suivante
  const goToNext = useCallback(() => {
    if (state.data.length === 0) return;

    const currentIndex = state.data.findIndex(
      (point) => point.timestamp === state.currentDate
    );

    if (currentIndex < state.data.length - 1) {
      setState((prev) => ({
        ...prev,
        currentDate: prev.data[currentIndex + 1].timestamp,
      }));
    }
  }, [state.data, state.currentDate]);

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  // Obtenir les données du point temporel actuel
  const getCurrentDataPoint = useCallback((): TemporalDataPoint | null => {
    if (!state.currentDate || state.data.length === 0) {
      return null;
    }

    return (
      state.data.find((point) => point.timestamp === state.currentDate) || null
    );
  }, [state.currentDate, state.data]);

  // Obtenir les devices du point temporel actuel
  const getCurrentDevices = useCallback(() => {
    const currentPoint = getCurrentDataPoint();
    return currentPoint ? currentPoint.devices : [];
  }, [getCurrentDataPoint]);

  /**
   * Obtenir les signalements SignalAir visibles pour la fenêtre d'affichage courante.
   * Filtre par chevauchement de périodes (local) : signalement visible si sa période
   * chevauche la fenêtre currentDate/timeStep.
   */
  const getCurrentSignalAirReports = useCallback((): SignalAirReport[] => {
    if (
      !state.currentDate ||
      state.historicalSignalAirReports.length === 0
    ) {
      return [];
    }
    return filterReportsByDisplayWindow(
      state.historicalSignalAirReports,
      state.currentDate,
      state.timeStep
    );
  }, [
    state.currentDate,
    state.historicalSignalAirReports,
    state.timeStep,
  ]);

  // Contrôles exposés
  const controls: TemporalControls = {
    startDate: state.startDate,
    endDate: state.endDate,
    currentDate: state.currentDate,
    isPlaying: state.isPlaying,
    playbackSpeed: state.playbackSpeed,
    timeStep: state.timeStep,
    onStartDateChange: (date: string) => {
      setState((prev) => ({ ...prev, startDate: date }));
    },
    onEndDateChange: (date: string) => {
      setState((prev) => ({ ...prev, endDate: date }));
    },
    onCurrentDateChange: changeCurrentDate,
    onPlayPause: togglePlayback,
    onSpeedChange: changePlaybackSpeed,
    onTimeStepChange: (newTimeStep: string) => {
      setState((prev) => ({ ...prev, timeStep: newTimeStep }));
    },
    onReset: reset,
  };

  return {
    // État
    state,
    controls,

    // Actions
    toggleHistoricalMode,
    exitHistoricalMode,
    loadHistoricalData,
    getCurrentDataPoint,
    getCurrentDevices,
    getCurrentSignalAirReports,

    // Navigation temporelle
    seekToDate,
    goToPrevious,
    goToNext,

    // Utilitaires
    isHistoricalModeActive: state.isActive,
    hasHistoricalData: state.data.length > 0,
    canPlay: state.data.length > 0 && !state.loading,
  };
};
