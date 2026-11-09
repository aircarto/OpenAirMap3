import { useCallback, useEffect, useMemo, useState } from "react";
import { PlaneTrack } from "../../../types";
import { PlaneTrackingService } from "../../../services/PlaneTrackingService";
import { featureFlags } from "../../../config/featureFlags";
import {
  PLANE_REFRESH_INTERVAL_MS,
  PLANE_STALE_AFTER_MS,
  getPlaneTimeStepConfig,
} from "../../../constants/planes";

/**
 * Avion à afficher : position récente (pas un avion "mort"/grisé sorti de
 * portée) ET en mouvement (en vol, ou au sol mais en roulage/décollage).
 */
const isPlaneShown = (t: PlaneTrack, now: number): boolean => {
  const fresh = now - t.lastPoint.time <= PLANE_STALE_AFTER_MS;
  const moving = !t.onGround || (t.speedKnots ?? 0) >= 5;
  return fresh && moving;
};

/**
 * Couche de suivi des avions (ADS-B). Même principe que useBoatLayer :
 * polling, visibilité, sélection (side panel), pas de temps -> fenêtre/finesse.
 * Active seulement si le flag est levé ET VITE_PLANE_API_URL est configurée.
 */
export const usePlaneLayer = (selectedTimeStep: string) => {
  const [planeTracks, setPlaneTracks] = useState<PlaneTrack[]>([]);
  const [planeLoading, setPlaneLoading] = useState(false);
  const [planeError, setPlaneError] = useState<string | null>(null);
  const [isPlaneLayerVisible, setIsPlaneLayerVisible] = useState(true);

  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [selectedPlaneSnapshot, setSelectedPlaneSnapshot] =
    useState<PlaneTrack | null>(null);
  const [planePanelSize, setPlanePanelSize] = useState<
    "normal" | "fullscreen" | "hidden"
  >("normal");

  const isPlaneLayerEnabled =
    featureFlags.planeLayer && PlaneTrackingService.isConfigured();

  // Les avions ne sont affichés QUE en mode Scan (petit sillage ; trajet
  // complet au clic). Hors Scan, la couche est inactive.
  const isScanMode = selectedTimeStep === "instantane";
  const scanConfig = getPlaneTimeStepConfig("instantane");
  const isActive = isPlaneLayerEnabled && isPlaneLayerVisible && isScanMode;

  useEffect(() => {
    if (!isActive) {
      setPlaneTracks([]);
      setPlaneError(null);
      setPlaneLoading(false);
      return;
    }

    let isCancelled = false;
    const service = new PlaneTrackingService();

    const load = async () => {
      if (!isCancelled) {
        setPlaneLoading(true);
        setPlaneError(null);
      }
      try {
        const data = await service.fetchTracks(scanConfig.hours, scanConfig.every);
        if (!isCancelled) {
          // On ne garde que les avions en mouvement et à jour (pas les grisés/morts)
          const now = Date.now();
          setPlaneTracks(data.filter((t) => isPlaneShown(t, now)));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des avions:", error);
        if (!isCancelled) {
          setPlaneError("Impossible de charger les positions des avions.");
        }
      } finally {
        if (!isCancelled) setPlaneLoading(false);
      }
    };

    load();
    const intervalId = window.setInterval(load, PLANE_REFRESH_INTERVAL_MS);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isActive, scanConfig.hours, scanConfig.every]);

  const selectedPlane = useMemo(() => {
    if (!selectedPlaneId) return null;
    return (
      planeTracks.find((t) => t.id === selectedPlaneId) ?? selectedPlaneSnapshot
    );
  }, [selectedPlaneId, planeTracks, selectedPlaneSnapshot]);

  const handleSelectPlane = useCallback((track: PlaneTrack) => {
    setSelectedPlaneId(track.id);
    setSelectedPlaneSnapshot(track);
    setPlanePanelSize("normal");
  }, []);

  const handleClosePlanePanel = useCallback(() => {
    setSelectedPlaneId(null);
    setSelectedPlaneSnapshot(null);
    setPlanePanelSize("normal");
  }, []);

  useEffect(() => {
    if (!isActive) {
      setSelectedPlaneId(null);
      setSelectedPlaneSnapshot(null);
    }
  }, [isActive]);

  return {
    planeTracks,
    planeLoading,
    planeError,
    isPlaneLayerEnabled,
    isPlaneLayerVisible,
    setIsPlaneLayerVisible,
    previewMaxAgeMs: scanConfig.previewMaxAgeMs,
    selectedPlaneId,
    selectedPlane,
    planePanelSize,
    setPlanePanelSize,
    handleSelectPlane,
    handleClosePlanePanel,
  };
};
