import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import {
  BaseLayerKey,
  ModelingLayerType,
  createBaseLayer,
  getBaseLayerMaxZoom,
} from "../../../constants/mapLayers";
import {
  AROME_DOMAIN_DEFAULT,
  aromeDomainLeafletBounds,
  isAromeDomainId,
  type AromeDomainId,
} from "../../../constants/aromeDomains";
import {
  getModelingLayerHour,
  formatHourLayerName,
  getPollutantLayerName,
  createModelingWMTSLayer,
  getModelingLegendUrl,
  getModelingLegendTitle,
  isModelingAvailable,
  loadWindFromAtmoSud,
  loadAromeWind,
  loadAromeField,
  AromeInstant,
} from "../../../services/ModelingLayerService";
import { createCommunalGeoJSONLayer } from "../../../services/CommunalLayerService";
import {
  createEffisHotspotsGeoJSONLayer,
  createEffisBurnedAreasGeoJSONLayer,
  BurnedAreaPeriod,
  EffisBurnedAreaStats,
  EffisHotspotStats,
  HotspotPeriod,
} from "../../../services/EffisLayerService";
import { DomainConfig } from "../../../config/domainConfig";

const EFFIS_REDRAW_INTERVAL_MS = 10 * 60 * 1000; // 10 min : fenêtre glissante

interface UseMapLayersProps {
  mapRef: React.RefObject<L.Map | null>;
  /** Incrémente quand la carte Leaflet est prête (évite course au montage) */
  mapReadyVersion: number;
  currentBaseLayer: BaseLayerKey;
  selectedTimeStep: string;
  selectedPollutant: string;
  currentModelingLayer: ModelingLayerType | null;
  modelingHourIndex?: number | null;
  /** Instant carte (live ou exploration) pour synchroniser AROME */
  aromeInstant?: AromeInstant | null;
  /** Domaine AROME (Marseille / Nice / Toulon / Fos) */
  aromeDomain?: string;
  isCommunalLayerEnabled: boolean;
  isEffisHotspotsEnabled: boolean;
  isEffisBurnedAreasEnabled: boolean;
  /** Fenêtre des points de chaleur : 24 h ou 7 jours */
  effisHotspotsPeriod: HotspotPeriod;
  /** Fenêtre des zones brûlées : jour, semaine ou saison */
  effisBurnedAreasPeriod: BurnedAreaPeriod;
  /**
   * Date rejouée en mode historique. Absente = temps réel.
   * Les couches feux affichent alors une fenêtre glissante de 24 h fermée à cette date.
   */
  effisReferenceDate?: Date;
  /** Emprise de l'instance courante (voir DomainConfig.mapBounds) — les couches EFFIS s'y limitent */
  mapBounds: DomainConfig["mapBounds"];
}

export const useMapLayers = ({
  mapRef,
  mapReadyVersion,
  currentBaseLayer,
  selectedTimeStep,
  selectedPollutant,
  currentModelingLayer,
  modelingHourIndex,
  aromeInstant,
  aromeDomain = AROME_DOMAIN_DEFAULT,
  isCommunalLayerEnabled,
  isEffisHotspotsEnabled,
  isEffisBurnedAreasEnabled,
  effisHotspotsPeriod,
  effisBurnedAreasPeriod,
  effisReferenceDate,
  mapBounds,
}: UseMapLayersProps) => {
  const [currentTileLayer, setCurrentTileLayer] = useState<L.Layer | null>(
    null
  );
  const baseLayerRef = useRef<L.Layer | null>(null);
  const [currentModelingWMTSLayer, setCurrentModelingWMTSLayer] =
    useState<L.TileLayer | null>(null);
  const [currentModelingLegendUrl, setCurrentModelingLegendUrl] = useState<
    string | null
  >(null);
  const [currentModelingLegendTitle, setCurrentModelingLegendTitle] = useState<
    string | null
  >(null);
  const [isEffisHotspotsLoading, setIsEffisHotspotsLoading] = useState(false);
  const [isEffisBurnedAreasLoading, setIsEffisBurnedAreasLoading] = useState(false);
  const [effisHotspotsStats, setEffisHotspotsStats] =
    useState<EffisHotspotStats | null>(null);
  const [effisBurnedAreasStats, setEffisBurnedAreasStats] =
    useState<EffisBurnedAreaStats | null>(null);
  const [effisHotspotsError, setEffisHotspotsError] = useState<string | null>(
    null
  );
  const [effisBurnedAreasError, setEffisBurnedAreasError] = useState<
    string | null
  >(null);
  const [aromeError, setAromeError] = useState<string | null>(null);
  const [aromeLegend, setAromeLegend] = useState<{
    title: string;
    min: number;
    max: number;
    units: string;
  } | null>(null);

  const modelingLayerRef = useRef<L.TileLayer | null>(null);
  const windLayerRef = useRef<L.Layer | null>(null);
  const windLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const aromeFieldLayerRef = useRef<L.ImageOverlay | null>(null);
  const aromeObjectUrlRef = useRef<string | null>(null);
  const aromeFittedDomainRef = useRef<string | null>(null);
  const communalLayerRef = useRef<L.LayerGroup | null>(null);
  const effisHotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const effisBurnedAreasLayerRef = useRef<L.GeoJSON | null>(null);
  /**
   * Renderer canvas partagé par tous les points de chaleur. L'emprise France remonte
   * ~1700 points affichés sur 7 jours : en SVG (défaut Leaflet) chaque cercle serait
   * un nœud du DOM, ce qui alourdit nettement le zoom et le déplacement.
   */
  const hotspotsRendererRef = useRef<L.Renderer | null>(null);
  if (!hotspotsRendererRef.current) {
    hotspotsRendererRef.current = L.canvas({ padding: 0.5 });
  }

  const clearWindLayers = useCallback(() => {
    const map = mapRef.current;
    if (windLayerGroupRef.current && map) {
      map.removeLayer(windLayerGroupRef.current);
      windLayerGroupRef.current = null;
    }
    if (windLayerRef.current && map) {
      map.removeLayer(windLayerRef.current);
      windLayerRef.current = null;
    }
  }, [mapRef]);

  const clearAromeFieldLayer = useCallback(() => {
    const map = mapRef.current;
    if (aromeFieldLayerRef.current && map) {
      map.removeLayer(aromeFieldLayerRef.current);
      aromeFieldLayerRef.current = null;
    }
    if (aromeObjectUrlRef.current) {
      URL.revokeObjectURL(aromeObjectUrlRef.current);
      aromeObjectUrlRef.current = null;
    }
  }, [mapRef]);

  const addVelocityLayer = useCallback(
    (data: unknown, overlayName: string) => {
      if (!mapRef.current) return;
      const windLayerGroup = L.layerGroup();
      const velocityLayer = (L as any).velocityLayer({
        displayValues: false,
        displayOptions: false,
        data,
        velocityScale: 0.004,
        lineWidth: 2,
        colorScale: ["#8cb38a"],
        minVelocity: 0,
        maxVelocity: 30,
        overlayName,
      });
      velocityLayer.addTo(windLayerGroup);
      windLayerRef.current = velocityLayer;
      windLayerGroup.addTo(mapRef.current);
      windLayerGroupRef.current = windLayerGroup;
    },
    [mapRef]
  );

  // Fonction pour charger la modélisation de vent AtmoSud
  const loadWindModeling = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      clearWindLayers();

      const now = new Date();
      const yyyy = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const HH = String(now.getHours()).padStart(2, "0");
      const dateStr = `${yyyy}${MM}${dd}`;

      const data = await loadWindFromAtmoSud(dateStr, HH);
      addVelocityLayer(data, "wind_layer");
    } catch (error) {
      console.error(
        "❌ [WIND] Erreur lors du chargement des données de vent:",
        error
      );
      alert(`Impossible de charger les données de vent à cette heure.`);
    }
  }, [mapRef, clearWindLayers, addVelocityLayer]);

  const loadAromeModeling = useCallback(
    async (instant: AromeInstant, domain: AromeDomainId) => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      setAromeError(null);

      try {
        clearWindLayers();
        clearAromeFieldLayer();
        setAromeLegend(null);

        const [windData, field] = await Promise.all([
          loadAromeWind(instant, domain),
          loadAromeField(instant, "t2m", domain),
        ]);

        if (!mapRef.current) {
          URL.revokeObjectURL(field.objectUrl);
          return;
        }

        aromeObjectUrlRef.current = field.objectUrl;
        const imageOverlay = L.imageOverlay(field.objectUrl, field.bounds, {
          opacity: 0.75,
          interactive: false,
          pane: "overlayPane",
        });
        imageOverlay.addTo(map);
        aromeFieldLayerRef.current = imageOverlay;

        addVelocityLayer(windData, "arome_wind_layer");

        // Même convention que la modélisation Azur : borne début–fin en heure locale.
        const startHour = ((instant.hour % 24) + 24) % 24;
        const endHour = (startHour + 1) % 24;
        const timeRangeLabel = `${startHour}h-${endHour}h`;

        setAromeLegend({
          title: `AROME PAAROME · ${domain} · ${field.varName} (${field.units}) · ${timeRangeLabel}`,
          min: field.min,
          max: field.max,
          units: field.units,
        });
        setCurrentModelingLegendTitle(
          `AROME ${domain}\n${instant.date} ${timeRangeLabel}`
        );
        setCurrentModelingLegendUrl(null);

        if (aromeFittedDomainRef.current !== domain) {
          map.fitBounds(aromeDomainLeafletBounds(domain), {
            padding: [40, 40],
            maxZoom: 12,
          });
          aromeFittedDomainRef.current = domain;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de charger AROME";
        console.error("❌ [AROME]", error);
        setAromeError(message);
        setAromeLegend(null);
        clearWindLayers();
        clearAromeFieldLayer();
      }
    },
    [mapRef, clearWindLayers, clearAromeFieldLayer, addVelocityLayer]
  );

  // Effet pour mettre à jour le fond de carte et le maxZoom (tous les fonds, y compris Positron)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapReadyVersion < 1) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }

    const newBaseLayer = createBaseLayer(currentBaseLayer);
    newBaseLayer.addTo(map);
    baseLayerRef.current = newBaseLayer;
    setCurrentTileLayer(newBaseLayer);

    map.setMaxZoom(getBaseLayerMaxZoom(currentBaseLayer));

    return () => {
      if (baseLayerRef.current && map) {
        map.removeLayer(baseLayerRef.current);
        baseLayerRef.current = null;
      }
    };
  }, [currentBaseLayer, mapReadyVersion, mapRef]);

  // Effet pour gérer les layers de modélisation WMTS
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Cleanup: retirer l'ancien layer de modélisation s'il existe
    if (modelingLayerRef.current && map) {
      map.removeLayer(modelingLayerRef.current);
      modelingLayerRef.current = null;
      setCurrentModelingWMTSLayer(null);
    }

    // Par défaut, aucune légende n'est affichée tant qu'un nouveau layer n'est pas chargé
    setCurrentModelingLegendUrl(null);
    setCurrentModelingLegendTitle(null);

    // Cleanup: retirer l'ancien layer de vent / AROME
    if (windLayerGroupRef.current && map) {
      map.removeLayer(windLayerGroupRef.current);
      windLayerGroupRef.current = null;
      windLayerRef.current = null;
    }
    clearAromeFieldLayer();
    setAromeError(null);
    setAromeLegend(null);

    if (currentModelingLayer !== "arome") {
      aromeFittedDomainRef.current = null;
    }

    // Pour le vent AtmoSud, pas besoin de vérifier isModelingAvailable
    if (currentModelingLayer === "vent") {
      loadWindModeling();
      return;
    }

    // POC AROME : vent + t2m depuis le partage stomod2
    if (currentModelingLayer === "arome") {
      if (!aromeInstant?.date) {
        setAromeError("Instant AROME indisponible");
        return;
      }
      if (!isAromeDomainId(aromeDomain)) {
        setAromeError(`Domaine AROME invalide: ${aromeDomain}`);
        return;
      }
      void loadAromeModeling(aromeInstant, aromeDomain);
      return;
    }

    // Vérifier si les modélisations sont disponibles pour ce pas de temps (pour pollutant)
    if (!isModelingAvailable(selectedTimeStep)) {
      return;
    }

    // Si un layer de modélisation WMTS est sélectionné (pollutant)
    if (currentModelingLayer === "pollutant") {
      try {
        // null = hors fenêtre Azur : masquer la couche.
        if (modelingHourIndex === null) {
          return;
        }
        const fallbackHour = getModelingLayerHour(selectedTimeStep);
        const hour =
          typeof modelingHourIndex === "number"
            ? modelingHourIndex
            : fallbackHour;

        // Si l'heure est invalide (scan), ne pas charger
        if (hour < 0) {
          return;
        }
        const clampedHour = Math.max(0, Math.min(47, hour));

        // Formater l'heure (h00, h01, ..., h47)
        const hourFormatted = formatHourLayerName(clampedHour);
        let layerName: string;

        // Déterminer le nom du layer selon le type
        if (!selectedPollutant) {
          return;
        }
        layerName = getPollutantLayerName(selectedPollutant, hourFormatted);

        // Créer et ajouter le layer WMTS
        const wmtsLayer = createModelingWMTSLayer(layerName);
        if (map) {
          wmtsLayer.addTo(map);
          modelingLayerRef.current = wmtsLayer;
          setCurrentModelingWMTSLayer(wmtsLayer);
          setCurrentModelingLegendUrl(getModelingLegendUrl(layerName));
          setCurrentModelingLegendTitle(getModelingLegendTitle(layerName));
        }
      } catch (error) {
        console.error(
          "❌ [MODELING] Erreur lors du chargement du layer de modélisation:",
          error
        );
      }
    }

    // Cleanup function pour retirer les layers lors du démontage ou changement
    return () => {
      if (map) {
        if (modelingLayerRef.current) {
          map.removeLayer(modelingLayerRef.current);
          modelingLayerRef.current = null;
        }
        if (windLayerGroupRef.current) {
          map.removeLayer(windLayerGroupRef.current);
          windLayerGroupRef.current = null;
          windLayerRef.current = null;
        }
      }
      clearAromeFieldLayer();
      setCurrentModelingWMTSLayer(null);
      setCurrentModelingLegendUrl(null);
      setCurrentModelingLegendTitle(null);
      setAromeLegend(null);
    };
  }, [
    currentModelingLayer,
    selectedTimeStep,
    selectedPollutant,
    modelingHourIndex,
    aromeInstant?.date,
    aromeInstant?.hour,
    aromeDomain,
    loadWindModeling,
    loadAromeModeling,
    clearAromeFieldLayer,
    mapRef,
  ]);

  // Effet pour gérer la couche communale (utilise GeoJSON pour un contrôle total du style)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    let isCancelled = false;

    // Supprimer l'ancienne couche si elle existe
    if (communalLayerRef.current && map) {
      map.removeLayer(communalLayerRef.current);
      communalLayerRef.current = null;
    }

    // Charger et ajouter la couche si elle est activée
    if (isCommunalLayerEnabled && map) {
      createCommunalGeoJSONLayer(map)
        .then((layerGroup) => {
          if (!isCancelled && map) {
            layerGroup.addTo(map);
            communalLayerRef.current = layerGroup;
          }
        })
        .catch((error) => {
          console.error("Erreur lors du chargement de la couche communale:", error);
        });
    }

    // Cleanup
    return () => {
      isCancelled = true;
      if (map && communalLayerRef.current) {
        map.removeLayer(communalLayerRef.current);
        communalLayerRef.current = null;
      }
    };
  }, [isCommunalLayerEnabled, mapRef]);

  // Effet pour gérer la couche EFFIS points de chaleur (WFS GeoJSON)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    let isCancelled = false;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    const abortController = new AbortController();

    const removeHotspotsLayer = () => {
      if (effisHotspotsLayerRef.current && map) {
        map.removeLayer(effisHotspotsLayerRef.current);
        effisHotspotsLayerRef.current = null;
      }
    };

    const loadHotspots = async () => {
      setIsEffisHotspotsLoading(true);
      setEffisHotspotsError(null);
      try {
        const { layer, stats } = await createEffisHotspotsGeoJSONLayer(
          mapBounds,
          effisHotspotsPeriod,
          {
            renderer: hotspotsRendererRef.current ?? undefined,
            referenceDate: effisReferenceDate,
            signal: abortController.signal,
          }
        );
        if (isCancelled || !map) return;
        removeHotspotsLayer();
        layer.addTo(map);
        effisHotspotsLayerRef.current = layer;
        setEffisHotspotsStats(stats);
      } catch (error) {
        if (isCancelled || abortController.signal.aborted) return;
        console.error('Erreur WFS EFFIS points de chaleur:', error);
        setEffisHotspotsError(
          error instanceof Error ? error.message : String(error)
        );
        setEffisHotspotsStats(null);
      } finally {
        if (!isCancelled) {
          setIsEffisHotspotsLoading(false);
        }
      }
    };

    removeHotspotsLayer();
    setEffisHotspotsStats(null);

    if (isEffisHotspotsEnabled) {
      loadHotspots();

      // Inutile de rafraîchir une date passée : elle ne bouge plus.
      if (!effisReferenceDate) {
        refreshInterval = setInterval(loadHotspots, EFFIS_REDRAW_INTERVAL_MS);
      }
    }

    return () => {
      isCancelled = true;
      abortController.abort();
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      removeHotspotsLayer();
      setEffisHotspotsStats(null);
    };
  }, [
    isEffisHotspotsEnabled,
    effisHotspotsPeriod,
    effisReferenceDate,
    mapRef,
    mapBounds,
  ]);

  // Effet pour gérer la couche EFFIS zones brûlées (WFS GeoJSON)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    let isCancelled = false;
    const abortController = new AbortController();

    const removeBurnedAreasLayer = () => {
      if (effisBurnedAreasLayerRef.current && map) {
        map.removeLayer(effisBurnedAreasLayerRef.current);
        effisBurnedAreasLayerRef.current = null;
      }
    };

    removeBurnedAreasLayer();
    setEffisBurnedAreasStats(null);

    if (isEffisBurnedAreasEnabled) {
      setIsEffisBurnedAreasLoading(true);
      setEffisBurnedAreasError(null);
      createEffisBurnedAreasGeoJSONLayer(mapBounds, effisBurnedAreasPeriod, {
        referenceDate: effisReferenceDate,
        signal: abortController.signal,
      })
        .then(({ layer, stats }) => {
          if (isCancelled || !map) return;
          removeBurnedAreasLayer();
          layer.addTo(map);
          effisBurnedAreasLayerRef.current = layer;
          setEffisBurnedAreasStats(stats);
        })
        .catch((error) => {
          if (isCancelled || abortController.signal.aborted) return;
          console.error('Erreur WFS EFFIS zones brûlées:', error);
          setEffisBurnedAreasError(
            error instanceof Error ? error.message : String(error)
          );
          setEffisBurnedAreasStats(null);
        })
        .finally(() => {
          if (!isCancelled) {
            setIsEffisBurnedAreasLoading(false);
          }
        });
    }

    return () => {
      isCancelled = true;
      abortController.abort();
      removeBurnedAreasLayer();
      setEffisBurnedAreasStats(null);
    };
  }, [
    isEffisBurnedAreasEnabled,
    effisBurnedAreasPeriod,
    effisReferenceDate,
    mapRef,
    mapBounds,
  ]);

  return {
    currentTileLayer,
    currentModelingWMTSLayer,
    currentModelingLegendUrl,
    currentModelingLegendTitle,
    aromeLegend,
    aromeError,
    isEffisHotspotsLoading,
    isEffisBurnedAreasLoading,
    effisHotspotsStats,
    effisBurnedAreasStats,
    effisHotspotsError,
    effisBurnedAreasError,
  };
};
