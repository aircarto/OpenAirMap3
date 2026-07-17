import { useEffect, useState } from "react";
import { WildfireReport } from "../../../types";
import { FeuxDeForetService } from "../../../services/FeuxDeForetService";
import { featureFlags } from "../../../config/featureFlags";

export const useWildfireLayer = (isEnabledByControl = true) => {
  const [wildfireReports, setWildfireReports] = useState<WildfireReport[]>([]);
  const [wildfireLoading, setWildfireLoading] = useState(false);
  const [wildfireError, setWildfireError] = useState<string | null>(null);
  const isWildfireLayerEnabled =
    featureFlags.wildfireLayer && isEnabledByControl;

  useEffect(() => {
    if (!isWildfireLayerEnabled) {
      setWildfireReports([]);
      setWildfireError(null);
      setWildfireLoading(false);
      return;
    }

    let isCancelled = false;
    const service = new FeuxDeForetService();

    const loadWildfires = async () => {
      if (!isCancelled) {
        setWildfireLoading(true);
        setWildfireError(null);
      }

      try {
        const data = await service.fetchTodaySignalements();

        if (!isCancelled) {
          setWildfireReports(data);
          console.debug(
            "[AirQualityMap] Signalements d'incendies chargés:",
            data.length,
            data.map((item) => ({
              id: item.id,
              commune: item.commune,
              date: item.date,
              postModified: item.postModified,
            }))
          );
        }
      } catch (error) {
        console.error("Erreur lors du chargement des signalements feux:", error);

        if (!isCancelled) {
          setWildfireError(
            "Impossible de charger les signalements d'incendies pour le moment."
          );
        }
      } finally {
        if (!isCancelled) {
          setWildfireLoading(false);
        }
      }
    };

    loadWildfires();

    const intervalId = window.setInterval(loadWildfires, 5 * 60 * 1000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isWildfireLayerEnabled]);

  useEffect(() => {
    if (!isWildfireLayerEnabled) {
      return;
    }

    if (wildfireReports.length > 0) {
      console.debug(
        "[AirQualityMap] Signalements d'incendies prêts à l'affichage:",
        wildfireReports.map((item) => ({
          id: item.id,
          position: [item.latitude, item.longitude],
          commune: item.commune,
        }))
      );
    } else {
      console.debug("[AirQualityMap] Aucun signalement d'incendie à afficher");
    }
  }, [wildfireReports, isWildfireLayerEnabled]);

  return {
    wildfireReports,
    wildfireLoading,
    wildfireError,
    isWildfireLayerEnabled,
  };
};

