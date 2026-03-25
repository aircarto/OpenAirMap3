import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MeasurementDevice, SignalAirReport } from "../types";
import { DataServiceFactory } from "../services/DataServiceFactory";
import { pasDeTemps } from "../constants/timeSteps";

interface UseAirQualityDataProps {
  selectedPollutant: string;
  selectedSources: string[];
  selectedTimeStep: string;
  atmoMicroAllowedSiteIds?: number[];
  signalAirPeriod?: { startDate: string; endDate: string };
  mobileAirPeriod?: { startDate: string; endDate: string };
  selectedMobileAirSensor?: string | null;
  signalAirOptions?: {
    selectedTypes: string[];
    loadTrigger: number;
    isSourceSelected?: boolean;
  };
  autoRefreshEnabled?: boolean;
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
  atmoMicroAllowedSiteIds,
  signalAirPeriod,
  mobileAirPeriod,
  selectedMobileAirSensor,
  signalAirOptions,
  autoRefreshEnabled = true,
}: UseAirQualityDataProps) => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [reports, setReports] = useState<SignalAirReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Référence pour stocker l'intervalle
  const intervalRef = useRef<number | null>(null);
  const signalAirLastTriggerRef = useRef(0);
  // Référence pour éviter les appels multiples au montage initial
  const hasMountedRef = useRef(false);
  const lastFetchParamsRef = useRef<string>("");
  // Référence pour stocker fetchData et éviter les dépendances circulaires
  const fetchDataRef = useRef<() => Promise<void>>(undefined);

  const atmoMicroAllowedSiteIdsSet = useMemo(() => {
    if (!atmoMicroAllowedSiteIds || atmoMicroAllowedSiteIds.length === 0) {
      return null;
    }
    return new Set(atmoMicroAllowedSiteIds.map((id) => id.toString()));
  }, [atmoMicroAllowedSiteIds]);

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
        signalAirOptions.loadTrigger > signalAirLastTriggerRef.current;

      if (filteredSources.length === 0 && !shouldFetchSignalAir && !selectedMobileAirSensor) {
        // Ne pas réinitialiser si on charge SignalAir ou MobileAir séparément
        if (!isSignalAirSourceSelected && !selectedMobileAirSensor) {
          setDevices([]);
          setReports([]);
        }
        setLoading(false);
        setLoadingSources([]);
        if (filteredSources.length === 0 && !isSignalAirSourceSelected && !selectedMobileAirSensor) {
          return;
        }
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

      // NETTOYER LES ROUTES ET DEVICES MOBILEAIR EN PREMIER, AVANT TOUTE AUTRE OPÉRATION
      // Cela garantit que le nettoyage se fait au bon moment, même lors d'un rechargement
      // MobileAir est maintenant géré séparément, donc on vérifie directement selectedMobileAirSensor
      if (selectedMobileAirSensor) {
        // Nettoyer les routes dans le service MobileAir en PREMIER
        try {
          const mobileAirService = DataServiceFactory.getService("mobileair") as any;
          if (mobileAirService && typeof mobileAirService.clearRoutes === "function") {
            mobileAirService.clearRoutes();
          }
        } catch (error) {
          console.error("Erreur lors du nettoyage des routes MobileAir:", error);
        }
        
        // Nettoyer les devices MobileAir en PREMIER (utiliser callback pour garantir l'état actuel)
        setDevices((prevDevices) => {
          const hasMobileAirDevices = prevDevices.some((d) => d.source === "mobileair");
          
          if (hasMobileAirDevices) {
            const filteredDevices = prevDevices.filter((device) => {
              return device.source !== "mobileair";
            });
            
            return filteredDevices;
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
      if (selectedMobileAirSensor) {
        allSourcesToLoad.push("mobileair");
      }

      if (allSourcesToLoad.length === 0) {
        setLoading(false);
        setLoadingSources([]);
        return;
      }

      setLoading(true);
      setError(null);
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
          return mappedSources.includes(device.source);
        });

        // console.log("🧹 [HOOK] Nettoyage des devices:", {
        //   totalDevices: prevDevices.length,
        //   filteredDevices: filteredDevices.length,
        //   selectedSources: selectedSources,
        //   mappedSources: mappedSources,
        //   removedDevices: prevDevices
        //     .filter((d) => !mappedSources.includes(d.source))
        //     .map((d) => ({ id: d.id, source: d.source })),
        // });

        return filteredDevices;
      });

      // Supprimer explicitement les devices MobileAir si MobileAir n'est pas activé
      if (!selectedMobileAirSensor) {
        setDevices((prevDevices) => {
          const filteredDevices = prevDevices.filter((device) => {
            return device.source !== "mobileair";
          });

          return filteredDevices;
        });
      }


      // Traiter chaque service individuellement pour un affichage progressif
      for (const index of fetchableIndexes) {
        const service = services[index];
        const sourceCode = selectedSources[index]; // Code original pour l'affichage
        const mappedSourceCode = mappedSources[index]; // Code réel du service

        try {
          const data = await service.fetchData({
            pollutant: selectedPollutant,
            timeStep: selectedTimeStep,
            sources: mappedSources, // Utiliser les sources mappées, pas les sources originales
            signalAirPeriod,
            signalAirSelectedTypes: signalAirOptions?.selectedTypes,
            mobileAirPeriod,
            selectedSensors: selectedMobileAirSensor
              ? [selectedMobileAirSensor]
              : [],
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

            // Filtre domaine: ne garder que certains sites AtmoMicro
            const filteredMeasurementDevices =
              mappedSourceCode === "atmoMicro" && atmoMicroAllowedSiteIdsSet
                ? measurementDevices.filter((d) => atmoMicroAllowedSiteIdsSet.has(d.id))
                : measurementDevices;

            // Mettre à jour les appareils de mesure
            // Toujours filtrer les anciennes données de cette source, même si le service retourne un tableau vide
            // (par exemple, si NebuleAir ne supporte pas le polluant sélectionné)
            setDevices((prevDevices) => {
              // Filtrer les anciennes données de cette source
              const filteredDevices = prevDevices.filter(
                (device) => device.source !== mappedSourceCode
              );
              // Ajouter les nouvelles données (peut être un tableau vide)
              return [...filteredDevices, ...filteredMeasurementDevices];
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
        } catch (err) {
          console.error(
            `❌ Erreur lors de la récupération des données pour ${sourceCode}:`,
            err
          );

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
        signalAirLastTriggerRef.current = signalAirOptions.loadTrigger;
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

      // Charger MobileAir si nécessaire
      if (selectedMobileAirSensor) {
        try {
          const mobileAirService = DataServiceFactory.getService("mobileair");
          if (mobileAirService) {
            setLoadingSources((prev) => [...prev, "mobileair"]);
            const data = await mobileAirService.fetchData({
              pollutant: selectedPollutant,
              timeStep: selectedTimeStep,
              sources: ["mobileair"],
              mobileAirPeriod,
              selectedSensors: [selectedMobileAirSensor],
            });

            if (Array.isArray(data)) {
              const measurementDevices: MeasurementDevice[] = data.filter(isMeasurementDevice);

              setDevices((prevDevices) => {
                const filteredDevices = prevDevices.filter(
                  (device) => device.source !== "mobileair"
                );
                return [...filteredDevices, ...measurementDevices];
              });
            }
          }
        } catch (err) {
          console.error("❌ Erreur lors de la récupération des données MobileAir:", err);
        } finally {
          setLoadingSources((prev) => prev.filter((source) => source !== "mobileair"));
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la récupération des données"
      );
    } finally {
      setLoading(false);
    }
  }, [
    selectedPollutant,
    selectedSources,
    selectedTimeStep,
    atmoMicroAllowedSiteIdsSet,
    signalAirPeriod,
    mobileAirPeriod,
    selectedMobileAirSensor,
    signalAirOptions,
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

    // Ne pas démarrer l'auto-refresh si désactivé ou aucune source sélectionnée
    if (!autoRefreshEnabled || selectedSources.length === 0) {
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
  }, [selectedTimeStep, selectedSources, autoRefreshEnabled, fetchData]);

  // Effet pour le chargement initial
  // Utiliser un ref pour éviter les appels multiples causés par la recréation de fetchData
  useEffect(() => {
    // Créer une signature des paramètres qui déclenchent vraiment un rechargement
    const fetchParams = JSON.stringify({
      selectedPollutant,
      selectedSources,
      selectedTimeStep,
      atmoMicroAllowedSiteIds,
      signalAirPeriod,
      mobileAirPeriod,
      selectedMobileAirSensor,
      signalAirLoadTrigger: signalAirOptions?.loadTrigger,
      signalAirIsSelected: signalAirOptions?.isSourceSelected,
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
    selectedMobileAirSensor,
    signalAirOptions?.loadTrigger,
    signalAirOptions?.isSourceSelected,
    atmoMicroAllowedSiteIds,
    // Note: on utilise les dépendances réelles au lieu de fetchData
    // pour éviter les appels multiples quand fetchData est recréé avec les mêmes paramètres
  ]);

  return {
    devices,
    reports,
    loading,
    error,
    loadingSources,
    lastRefresh,
  };
};
