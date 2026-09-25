import { useState, useEffect, useCallback, useRef } from "react";
import {
  AtmoMicroLikeService,
  MeasurementDevice,
  SignalAirReport,
} from "../types";
import { DataServiceFactory } from "../services/DataServiceFactory";
import { AtmoMicroMeasuresUnavailableError } from "../services/AtmoMicroService";
import { pasDeTemps } from "../constants/timeSteps";
import type {
  MobileAirPeriod,
  MobileAirSensorStatus,
} from "../constants/mobileAir";
import { MOBILEAIR_LIVE_SOURCE } from "../constants/mobileAir";
import { MobileAirService } from "../services/MobileAirService";

interface UseAirQualityDataProps {
  selectedPollutant: string;
  selectedSources: string[];
  selectedTimeStep: string;
  signalAirPeriod?: { startDate: string; endDate: string };
  /** Période par défaut (chargement initial multi-capteurs). */
  mobileAirPeriod?: MobileAirPeriod;
  /** Périodes override par capteur (panneau de gestion). */
  mobileAirSensorPeriods?: Record<string, MobileAirPeriod>;
  selectedMobileAirSensors?: string[];
  /**
   * Capteurs à refetch de façon partielle (période ajustée dans le panneau).
   * Consommé une fois le fetch lancé (via mobileAirPartialRefetchToken).
   */
  mobileAirPartialRefetchSensors?: string[];
  mobileAirPartialRefetchToken?: number;
  signalAirOptions?: {
    selectedTypes: string[];
    /** Incrémenté pour forcer un fetch (activation, période TimeBar, type ajouté). */
    fetchToken: number;
    isSourceSelected?: boolean;
  };
  autoRefreshEnabled?: boolean;
  /**
   * Live MobileAir (Scan uniquement). Désactivé en mode mobilité.
   * Défaut OFF — l’utilisateur active le toggle dans le disclosure.
   */
  mobileAirLiveEnabled?: boolean;
}

// Correction : utiliser le code réel du pas de temps
const getRefreshInterval = (timeStep: string): number => {
  const code = pasDeTemps[timeStep]?.code || timeStep;
  switch (code) {
    case "instantane": // Scan
    case "2min": // ≤ 2 minutes
      return 60 * 1000; // 60 secondes
    case "qh": // 15 minutes
      return 15 * 60 * 1000; // 15 minutes
    case "h": // Heure
      return 60 * 60 * 1000; // 60 minutes
    case "d": // Jour
      return 24 * 60 * 60 * 1000; // 24 heures
    default:
      return 60 * 1000; // Par défaut, 60 secondes
  }
};

const isMeasurementDevice = (
  item: MeasurementDevice | SignalAirReport
): item is MeasurementDevice => {
  return "pollutant" in item && "value" in item && "unit" in item;
};

const isSignalAirReport = (
  item: MeasurementDevice | SignalAirReport
): item is SignalAirReport => {
  return "signalType" in item;
};

export const useAirQualityData = ({
  selectedPollutant,
  selectedSources,
  selectedTimeStep,
  signalAirPeriod,
  mobileAirPeriod,
  mobileAirSensorPeriods = {},
  selectedMobileAirSensors = [],
  mobileAirPartialRefetchSensors = [],
  mobileAirPartialRefetchToken = 0,
  signalAirOptions,
  autoRefreshEnabled = true,
  mobileAirLiveEnabled = false,
}: UseAirQualityDataProps) => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [reports, setReports] = useState<SignalAirReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atmoMicroOutage, setAtmoMicroOutage] = useState(false);
  const [loadingSources, setLoadingSources] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [mobileAirSensorStatus, setMobileAirSensorStatus] = useState<
    Record<string, MobileAirSensorStatus>
  >({});

  // Référence pour stocker l'intervalle
  const intervalRef = useRef<number | null>(null);
  const signalAirLastTriggerRef = useRef(0);
  const mobileAirPartialTokenRef = useRef(0);
  // Référence pour éviter les appels multiples au montage initial
  const hasMountedRef = useRef(false);
  const lastFetchParamsRef = useRef<string>("");
  // Référence pour stocker fetchData et éviter les dépendances circulaires
  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const hasMobileAirSensors = selectedMobileAirSensors.length > 0;
  const shouldFetchLive =
    mobileAirLiveEnabled &&
    selectedTimeStep === "instantane" &&
    !hasMobileAirSensors;

  const fetchData = useCallback(async () => {
    const now = new Date();
    setLastRefresh(now);

    try {
      // Filtrer signalair et mobileair des sources à charger automatiquement
      // Ces sources sont gérées séparément via les boutons flottants
      const filteredSources = selectedSources.filter(
        (source) => source !== "signalair" && source !== "communautaire.mobileair"
      );

      // Mapper les sources communautaires vers leurs codes de service réels
      const mappedSources = filteredSources.map((source) => {
        if (source.startsWith("communautaire.")) {
          return source.split(".")[1]; // Extraire 'nebuleair' de 'communautaire.nebuleair'
        }
        return source;
      });

      // Déclarer avant toute utilisation (évite "can't access lexical declaration before initialization")
      const isSignalAirSourceSelected =
        signalAirOptions?.isSourceSelected ?? mappedSources.includes("signalair");
      const shouldFetchSignalAir =
        isSignalAirSourceSelected &&
        !!signalAirOptions &&
        signalAirOptions.fetchToken > signalAirLastTriggerRef.current;

      // Live-only (ou aucune source classique) : ne pas sortir avant le fetch live
      if (
        filteredSources.length === 0 &&
        !shouldFetchSignalAir &&
        !hasMobileAirSensors &&
        !shouldFetchLive
      ) {
        if (!isSignalAirSourceSelected && !hasMobileAirSensors) {
          setDevices([]);
          setReports([]);
        }
        setLoading(false);
        setLoadingSources([]);
        return;
      }

      if (!isSignalAirSourceSelected) {
        // Si SignalAir n'est plus sélectionné, effacer tous les reports
        setReports([]);
      } else if (!shouldFetchSignalAir) {
        // Si SignalAir est sélectionné mais qu'on ne le charge pas maintenant,
        // NE PAS filtrer les reports existants pour les garder
        // (par exemple, si on charge MobileAir alors que SignalAir est déjà chargé)
        // Les reports SignalAir seront conservés
      } else {
        // L'utilisateur vient de demander un chargement explicite de SignalAir
        // Filtrer les anciens reports SignalAir pour les remplacer par les nouveaux
        setReports((prevReports) =>
          prevReports.length > 0
            ? prevReports.filter((report) => report.source !== "signalair")
            : prevReports
        );
      }

      // Indices des sources à réellement charger (on saute SignalAir tant que l'utilisateur n'a pas demandé)
      const fetchableIndexes = mappedSources.reduce<number[]>(
        (indexes, mappedSource, index) => {
          if (mappedSource === "signalair" && !shouldFetchSignalAir) {
            return indexes;
          }
          indexes.push(index);
          return indexes;
        },
        []
      );

      const fetchableSources = fetchableIndexes.map(
        (index) => filteredSources[index]
      );

      // Détecter un refetch partiel MobileAir avant le nettoyage global
      const pendingPartialToken = mobileAirPartialRefetchToken;
      const isPartialMobileAirRefetch =
        pendingPartialToken > mobileAirPartialTokenRef.current &&
        mobileAirPartialRefetchSensors.length > 0;

      // NETTOYER LES ROUTES ET DEVICES MOBILEAIR EN PREMIER (plein remplacement uniquement)
      if (hasMobileAirSensors && !isPartialMobileAirRefetch) {
        try {
          const mobileAirService = DataServiceFactory.getService("mobileair") as any;
          if (mobileAirService && typeof mobileAirService.clearRoutes === "function") {
            mobileAirService.clearRoutes();
          }
        } catch (error) {
          console.error("Erreur lors du nettoyage des routes MobileAir:", error);
        }
        
        setDevices((prevDevices) => {
          const hasMobileAirDevices = prevDevices.some((d) => d.source === "mobileair");
          
          if (hasMobileAirDevices) {
            return prevDevices.filter((device) => device.source !== "mobileair");
          }
          
          return prevDevices;
        });
      }

      // NE PAS réinitialiser tous les devices ici car cela effacerait les données des autres sources
      // Le nettoyage sera fait plus tard (lignes 179-196) en filtrant par source
      // Cela permet de garder les données SignalAir quand on charge MobileAir et vice versa

      // Ajouter SignalAir et MobileAir aux sources à charger si nécessaire
      const allSourcesToLoad = [...fetchableSources];
      if (shouldFetchSignalAir) {
        allSourcesToLoad.push("signalair");
      }
      if (hasMobileAirSensors) {
        allSourcesToLoad.push("mobileair");
      }
      if (shouldFetchLive) {
        allSourcesToLoad.push(MOBILEAIR_LIVE_SOURCE);
      }

      if (allSourcesToLoad.length === 0) {
        setLoading(false);
        setLoadingSources([]);
        return;
      }

      setLoading(true);
      setError(null);
      setAtmoMicroOutage(false);
      setLoadingSources(allSourcesToLoad);

      // console.log("🔍 [HOOK] Mapping des sources:", {
      //   selectedSources,
      //   mappedSources,
      // });

      // Récupérer les services pour chaque source sélectionnée
      const services = DataServiceFactory.getServices(mappedSources);
      // console.log(
      //   "🔍 [HOOK] Services récupérés:",
      //   services.map((s) => s.constructor.name)
      // );

      // Nettoyer les devices des sources non sélectionnées
      setDevices((prevDevices) => {
        const filteredDevices = prevDevices.filter((device) => {
          // Garder les devices des sources actuellement sélectionnées
          if (mappedSources.includes(device.source)) return true;
          // Préserver les marqueurs live MobileAir pendant le refresh
          if (
            shouldFetchLive &&
            device.source === MOBILEAIR_LIVE_SOURCE
          ) {
            return true;
          }
          return false;
        });

        return filteredDevices;
      });

      // Supprimer explicitement les devices MobileAir si MobileAir n'est pas activé
      if (!hasMobileAirSensors) {
        setDevices((prevDevices) => {
          const filteredDevices = prevDevices.filter((device) => {
            return device.source !== "mobileair";
          });

          return filteredDevices;
        });
        setMobileAirSensorStatus({});
      }


      // Traiter chaque service individuellement pour un affichage progressif - TODO: Vérifier si fetchableIndexes est toujours utile
      for (const index of fetchableIndexes) {
        const service = services[index];
        const sourceCode = filteredSources[index]; // Code original pour l'affichage
        const mappedSourceCode = mappedSources[index]; // Code réel du service

        try {
          const data = await service.fetchData({
            pollutant: selectedPollutant,
            timeStep: selectedTimeStep,
            sources: mappedSources, // Utiliser les sources mappées, pas les sources originales
            signalAirPeriod,
            signalAirSelectedTypes: signalAirOptions?.selectedTypes,
            mobileAirPeriod,
            selectedSensors: selectedMobileAirSensors,
          });

          // Séparer les appareils de mesure des signalements
          if (Array.isArray(data)) {
            const measurementDevices: MeasurementDevice[] = [];
            const signalReports: SignalAirReport[] = [];

            data.forEach((item) => {
              if (isMeasurementDevice(item)) {
                measurementDevices.push(item);
              } else if (isSignalAirReport(item)) {
                signalReports.push(item);
              }
            });

            // Mettre à jour les appareils de mesure
            // Toujours filtrer les anciennes données de cette source, même si le service retourne un tableau vide
            // (par exemple, si NebuleAir ne supporte pas le polluant sélectionné)
            setDevices((prevDevices) => {
              // Filtrer les anciennes données de cette source
              const filteredDevices = prevDevices.filter(
                (device) => device.source !== mappedSourceCode
              );
              // Ajouter les nouvelles données (peut être un tableau vide)
              return [...filteredDevices, ...measurementDevices];
            });

            // Mettre à jour les signalements (uniquement pour SignalAir)
            if (mappedSourceCode === "signalair") {
              setReports((prevReports) => {
                const filteredReports = prevReports.filter(
                  (report) => report.source !== mappedSourceCode
                );
                if (signalReports.length === 0) {
                  return filteredReports;
                }
                return [...filteredReports, ...signalReports];
              });
            } else if (signalReports.length > 0) {
              setReports((prevReports) => {
                const filteredReports = prevReports.filter(
                  (report) => report.source !== mappedSourceCode
                );
                return [...filteredReports, ...signalReports];
              });
            }
          }

          if (mappedSourceCode === "atmoMicro") {
            // Les deux implémentations AtmoMicro (ancienne API et microspot)
            // exposent ce contrat, d'où le transtypage vers l'interface plutôt
            // qu'un test d'existence de méthode.
            const atmoMicroService = service as unknown as AtmoMicroLikeService;
            setAtmoMicroOutage(
              atmoMicroService.isMeasuresUnavailableIncident() === true
            );
          }
        } catch (err) {
          console.error(
            `❌ Erreur lors de la récupération des données pour ${sourceCode}:`,
            err
          );

          if (
            mappedSourceCode === "atmoMicro" &&
            err instanceof AtmoMicroMeasuresUnavailableError
          ) {
            setAtmoMicroOutage(true);
          }

          // En cas d'erreur, on garde les données existantes mais on retire la source du loading
        } finally {
          // Retirer cette source de la liste des sources en cours
          setLoadingSources((prev) =>
            prev.filter((source) => source !== sourceCode)
          );
        }
      }

      // Charger SignalAir si nécessaire
      if (shouldFetchSignalAir && signalAirOptions) {
        signalAirLastTriggerRef.current = signalAirOptions.fetchToken;
        try {
          const signalAirService = DataServiceFactory.getService("signalair");
          if (signalAirService) {
            setLoadingSources((prev) => [...prev, "signalair"]);
            const data = await signalAirService.fetchData({
              pollutant: selectedPollutant,
              timeStep: selectedTimeStep,
              sources: ["signalair"],
              signalAirPeriod,
              signalAirSelectedTypes: signalAirOptions.selectedTypes,
            });

            if (Array.isArray(data)) {
              const signalReports: SignalAirReport[] = data.filter(isSignalAirReport);

              setReports((prevReports) => {
                const filteredReports = prevReports.filter(
                  (report) => report.source !== "signalair"
                );
                return [...filteredReports, ...signalReports];
              });
            }
          }
        } catch (err) {
          console.error("❌ Erreur lors de la récupération des données SignalAir:", err);
        } finally {
          setLoadingSources((prev) => prev.filter((source) => source !== "signalair"));
        }
      }

      // Charger MobileAir si nécessaire (plein remplacement ou refetch partiel)
      const isPartialRefetch = isPartialMobileAirRefetch;
      const sensorsToFetch = isPartialRefetch
        ? mobileAirPartialRefetchSensors
        : selectedMobileAirSensors;

      if (sensorsToFetch.length > 0) {
        if (isPartialRefetch) {
          mobileAirPartialTokenRef.current = pendingPartialToken;
        }

        try {
          const mobileAirService = DataServiceFactory.getService("mobileair");
          if (mobileAirService) {
            setLoadingSources((prev) =>
              prev.includes("mobileair") ? prev : [...prev, "mobileair"]
            );
            setMobileAirSensorStatus((prev) => {
              const next = { ...prev };
              for (const id of sensorsToFetch) {
                next[id] = "loading";
              }
              return next;
            });

            const data = await mobileAirService.fetchData({
              pollutant: selectedPollutant,
              timeStep: selectedTimeStep,
              sources: ["mobileair"],
              mobileAirPeriod,
              mobileAirPeriods: mobileAirSensorPeriods,
              mobileAirPartialReplace: isPartialRefetch,
              selectedSensors: sensorsToFetch,
            });

            if (Array.isArray(data)) {
              const measurementDevices: MeasurementDevice[] =
                data.filter(isMeasurementDevice);

              setDevices((prevDevices) => {
                if (isPartialRefetch) {
                  const removeIds = new Set(sensorsToFetch);
                  const kept = prevDevices.filter((device) => {
                    if (device.source !== "mobileair") return true;
                    const route = (device as MeasurementDevice & {
                      mobileAirRoute?: { sensorId: string };
                    }).mobileAirRoute;
                    return !route || !removeIds.has(route.sensorId);
                  });
                  return [...kept, ...measurementDevices];
                }
                const filteredDevices = prevDevices.filter(
                  (device) => device.source !== "mobileair"
                );
                return [...filteredDevices, ...measurementDevices];
              });

              setMobileAirSensorStatus((prev) => {
                const next = { ...prev };
                for (const id of sensorsToFetch) {
                  const hasRoutes = measurementDevices.some((device) => {
                    const route = (device as MeasurementDevice & {
                      mobileAirRoute?: { sensorId: string };
                    }).mobileAirRoute;
                    return route?.sensorId === id;
                  });
                  next[id] = hasRoutes ? "ready" : "error";
                }
                // Capteurs hors du fetch partiel : conserver le statut
                if (!isPartialRefetch) {
                  for (const id of Object.keys(next)) {
                    if (!sensorsToFetch.includes(id)) {
                      delete next[id];
                    }
                  }
                }
                return next;
              });
            }
          }
        } catch (err) {
          console.error(
            "❌ Erreur lors de la récupération des données MobileAir:",
            err
          );
          setMobileAirSensorStatus((prev) => {
            const next = { ...prev };
            for (const id of sensorsToFetch) {
              next[id] = "error";
            }
            return next;
          });
        } finally {
          setLoadingSources((prev) =>
            prev.filter((source) => source !== "mobileair")
          );
        }
      }

      // Live MobileAir (Scan) — indépendant du mode mobilité / capteurs chargés
      if (shouldFetchLive) {
        try {
          const mobileAirService = DataServiceFactory.getService(
            "mobileair"
          ) as MobileAirService;
          if (mobileAirService) {
            const liveSensors = await mobileAirService.fetchLiveSensors("5m");
            const liveDevices = mobileAirService.createLiveDevices(
              liveSensors,
              selectedPollutant
            );
            setDevices((prev) => {
              const withoutLive = prev.filter(
                (d) => d.source !== MOBILEAIR_LIVE_SOURCE
              );
              return [...withoutLive, ...liveDevices];
            });
          }
        } catch (err) {
          console.error(
            "Erreur lors de la récupération du live MobileAir:",
            err
          );
        }
      } else {
        setDevices((prev) =>
          prev.filter((d) => d.source !== MOBILEAIR_LIVE_SOURCE)
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la récupération des données"
      );
    } finally {
      setLoading(false);
      setLoadingSources((prev) =>
        prev.filter((source) => source !== MOBILEAIR_LIVE_SOURCE)
      );
    }
  }, [
    selectedPollutant,
    selectedSources,
    selectedTimeStep,
    signalAirPeriod,
    mobileAirPeriod,
    mobileAirSensorPeriods,
    selectedMobileAirSensors,
    hasMobileAirSensors,
    shouldFetchLive,
    mobileAirPartialRefetchSensors,
    mobileAirPartialRefetchToken,
    signalAirOptions,
    mobileAirLiveEnabled,
  ]);

  // Mettre à jour la référence quand fetchData change
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Effet pour gérer l'auto-refresh
  useEffect(() => {
    // Nettoyer l'intervalle précédent s'il existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const liveOnlyRefresh =
      mobileAirLiveEnabled &&
      selectedTimeStep === "instantane" &&
      !hasMobileAirSensors;

    // Ne pas démarrer l'auto-refresh si désactivé et aucune source / live
    if (
      !autoRefreshEnabled ||
      (selectedSources.length === 0 && !liveOnlyRefresh)
    ) {
      return;
    }

    // Récupérer l'intervalle de rafraîchissement selon le pas de temps
    const refreshInterval = getRefreshInterval(selectedTimeStep);

    // Mise à jour immédiate des sources au moment où l'utilisateur active l'auto-refresh
    fetchData();

    // Démarrer l'intervalle d'auto-refresh
    intervalRef.current = setInterval(() => {
      fetchData();
    }, refreshInterval) as any;

    // Nettoyer l'intervalle lors du démontage du composant
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    selectedTimeStep,
    selectedSources,
    autoRefreshEnabled,
    fetchData,
    mobileAirLiveEnabled,
    hasMobileAirSensors,
  ]);

  // Effet pour le chargement initial
  // Utiliser un ref pour éviter les appels multiples causés par la recréation de fetchData
  useEffect(() => {
    // Créer une signature des paramètres qui déclenchent vraiment un rechargement
    const fetchParams = JSON.stringify({
      selectedPollutant,
      selectedSources,
      selectedTimeStep,
      signalAirPeriod,
      mobileAirPeriod,
      selectedMobileAirSensors,
      mobileAirPartialRefetchToken,
      signalAirFetchToken: signalAirOptions?.fetchToken,
      signalAirIsSelected: signalAirOptions?.isSourceSelected,
      mobileAirLiveEnabled,
    });

    // Si c'est le premier montage ou si les paramètres ont vraiment changé
    if (!hasMountedRef.current || lastFetchParamsRef.current !== fetchParams) {
      hasMountedRef.current = true;
      lastFetchParamsRef.current = fetchParams;
      // Utiliser fetchDataRef.current pour éviter la dépendance à fetchData
      fetchDataRef.current?.();
    }

    // Cleanup: réinitialiser le flag au démontage pour le mode StrictMode
    return () => {
      // Ne pas réinitialiser hasMountedRef ici car on veut éviter les appels multiples
      // même lors du remontage en StrictMode si les paramètres n'ont pas changé
    };
  }, [
    selectedPollutant,
    selectedSources,
    selectedTimeStep,
    signalAirPeriod,
    mobileAirPeriod,
    selectedMobileAirSensors,
    mobileAirPartialRefetchToken,
    signalAirOptions?.fetchToken,
    signalAirOptions?.isSourceSelected,
    mobileAirLiveEnabled,
    // Note: on utilise les dépendances réelles au lieu de fetchData
    // pour éviter les appels multiples quand fetchData est recréé avec les mêmes paramètres
  ]);

  const isMobileAirLoading = selectedMobileAirSensors.some(
    (id) => mobileAirSensorStatus[id] === "loading"
  ) || loadingSources.includes("mobileair");

  const mobileAirLiveCount = devices.filter(
    (d) => d.source === MOBILEAIR_LIVE_SOURCE
  ).length;

  return {
    devices,
    reports,
    loading,
    error,
    atmoMicroOutage,
    loadingSources,
    lastRefresh,
    mobileAirSensorStatus,
    isMobileAirLoading,
    mobileAirLiveCount,
  };
};
