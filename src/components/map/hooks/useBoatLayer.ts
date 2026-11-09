import { useCallback, useEffect, useMemo, useState } from "react";
import { BoatTrack } from "../../../types";
import { BoatTrackingService } from "../../../services/BoatTrackingService";
import { featureFlags } from "../../../config/featureFlags";
import {
  BOAT_REFRESH_INTERVAL_MS,
  getBoatTimeStepConfig,
} from "../../../constants/boats";

/**
 * Couche de suivi des bateaux (AIS) : récupération périodique des
 * trajectoires et état de visibilité contrôlable par l'utilisateur.
 *
 * La couche n'est active que si le feature flag est levé ET que la route
 * API est configurée (VITE_BOAT_API_URL) — voir BoatTrackingService.
 *
 * @param selectedTimeStep pas de temps sélectionné en haut de la carte
 *   (Scan / ≤2min / 15min / Heure / Jour). Il pilote la profondeur du trajet
 *   et la finesse des points (voir BOAT_TIMESTEP_CONFIG).
 */
export const useBoatLayer = (selectedTimeStep: string) => {
  const [boatTracks, setBoatTracks] = useState<BoatTrack[]>([]);
  const [boatLoading, setBoatLoading] = useState(false);
  const [boatError, setBoatError] = useState<string | null>(null);
  // Visible par défaut dès que la couche est disponible ; l'utilisateur
  // peut la masquer via le contrôle de couches (BaseLayerControl).
  const [isBoatLayerVisible, setIsBoatLayerVisible] = useState(true);

  // Sélection d'un bateau (clic) : traîne complète + side panel de détails.
  // On garde un instantané en plus de l'id pour que le panel reste rempli
  // si le navire sort de la fenêtre de données au rafraîchissement suivant.
  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null);
  const [selectedBoatSnapshot, setSelectedBoatSnapshot] =
    useState<BoatTrack | null>(null);
  const [boatPanelSize, setBoatPanelSize] = useState<
    "normal" | "fullscreen" | "hidden"
  >("normal");

  const isBoatLayerEnabled =
    featureFlags.boatLayer && BoatTrackingService.isConfigured();

  // Les bateaux ne sont affichés QUE en mode Scan (sillage court ; trajet
  // complet au clic). Hors Scan, la couche est inactive.
  const isScanMode = selectedTimeStep === "instantane";
  const scanConfig = getBoatTimeStepConfig("instantane");
  const isActive = isBoatLayerEnabled && isBoatLayerVisible && isScanMode;

  useEffect(() => {
    if (!isActive) {
      setBoatTracks([]);
      setBoatError(null);
      setBoatLoading(false);
      return;
    }

    let isCancelled = false;
    const service = new BoatTrackingService();

    const loadBoatTracks = async () => {
      if (!isCancelled) {
        setBoatLoading(true);
        setBoatError(null);
      }

      try {
        const data = await service.fetchTracks(scanConfig.hours, scanConfig.every);

        if (!isCancelled) {
          setBoatTracks(data);
          console.debug(
            "[AirQualityMap] Trajectoires bateaux chargées:",
            data.length
          );
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des trajectoires bateaux:",
          error
        );

        if (!isCancelled) {
          setBoatError(
            "Impossible de charger les positions des bateaux pour le moment."
          );
        }
      } finally {
        if (!isCancelled) {
          setBoatLoading(false);
        }
      }
    };

    loadBoatTracks();

    const intervalId = window.setInterval(
      loadBoatTracks,
      BOAT_REFRESH_INTERVAL_MS
    );

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isActive, scanConfig.hours, scanConfig.every]);

  // Version la plus fraîche du bateau sélectionné (les données se
  // rafraîchissent toutes les 30 s), sinon l'instantané du clic.
  const selectedBoat = useMemo(() => {
    if (!selectedBoatId) return null;
    return (
      boatTracks.find((track) => track.id === selectedBoatId) ??
      selectedBoatSnapshot
    );
  }, [selectedBoatId, boatTracks, selectedBoatSnapshot]);

  const handleSelectBoat = useCallback((track: BoatTrack) => {
    setSelectedBoatId(track.id);
    setSelectedBoatSnapshot(track);
    setBoatPanelSize("normal");
  }, []);

  const handleCloseBoatPanel = useCallback(() => {
    setSelectedBoatId(null);
    setSelectedBoatSnapshot(null);
    setBoatPanelSize("normal");
  }, []);

  // Couche inactive (masquée ou hors Scan) -> refermer le panel
  useEffect(() => {
    if (!isActive) {
      setSelectedBoatId(null);
      setSelectedBoatSnapshot(null);
    }
  }, [isActive]);

  return {
    boatTracks,
    boatLoading,
    boatError,
    isBoatLayerEnabled,
    isBoatLayerVisible,
    setIsBoatLayerVisible,
    // Petit sillage en Scan (trajet complet au clic)
    previewMaxAgeMs: scanConfig.previewMaxAgeMs,
    selectedBoatId,
    selectedBoat,
    boatPanelSize,
    setBoatPanelSize,
    handleSelectBoat,
    handleCloseBoatPanel,
  };
};
