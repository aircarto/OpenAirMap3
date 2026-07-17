import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { baseLayers, BaseLayerKey, ModelingLayerType } from "../../../constants/mapLayers";
import {
  getModelingLayerHour,
  formatHourLayerName,
  getPollutantLayerName,
  createModelingWMTSLayer,
  getModelingLegendUrl,
  getModelingLegendTitle,
  isModelingAvailable,
  loadWindFromAtmoSud,
} from "../../../services/ModelingLayerService";
import { createCommunalGeoJSONLayer } from "../../../services/CommunalLayerService";
import {
  createFirmsWmsLayer,
  getFirmsLegendUrl,
} from "../../../services/FirmsLayerService";
import {
  createEffisHotspotsWmsLayer,
  createEffisHotspotsGeoJSONLayer,
  createEffisBurnedAreasGeoJSONLayer,
  getEffisHotspotsLegendUrl,
} from "../../../services/EffisLayerService";

const FIRMS_REDRAW_INTERVAL_MS = 10 * 60 * 1000; // 10 min : fenetre glissante 7 jours
const EFFIS_REDRAW_INTERVAL_MS = 10 * 60 * 1000; // 10 min : fenetre glissante 7 jours

interface UseMapLayersProps {
  mapRef: React.RefObject<L.Map | null>;
  currentBaseLayer: BaseLayerKey;
  selectedTimeStep: string;
  selectedPollutant: string;
  currentModelingLayer: ModelingLayerType | null;
  isCommunalLayerEnabled: boolean;
  isFirmsLayerEnabled: boolean;
  isEffisHotspotsEnabled: boolean;
  isEffisBurnedAreasEnabled: boolean;
}

export const useMapLayers = ({
  mapRef,
  currentBaseLayer,
  selectedTimeStep,
  selectedPollutant,
  currentModelingLayer,
  isCommunalLayerEnabled,
  isFirmsLayerEnabled,
  isEffisHotspotsEnabled,
  isEffisBurnedAreasEnabled,
}: UseMapLayersProps) => {
  const [currentTileLayer, setCurrentTileLayer] = useState<L.TileLayer | null>(
    null
  );
  const [currentModelingWMTSLayer, setCurrentModelingWMTSLayer] =
    useState<L.TileLayer | null>(null);
  const [currentModelingLegendUrl, setCurrentModelingLegendUrl] = useState<
    string | null
  >(null);
  const [currentModelingLegendTitle, setCurrentModelingLegendTitle] = useState<
    string | null
  >(null);
  const [currentFirmsLegendUrl, setCurrentFirmsLegendUrl] = useState<
    string | null
  >(null);
  const [currentEffisHotspotsLegendUrl, setCurrentEffisHotspotsLegendUrl] =
    useState<string | null>(null);
  const [currentEffisBurnedAreasLegendUrl, setCurrentEffisBurnedAreasLegendUrl] =
    useState<string | null>(null);

  const modelingLayerRef = useRef<L.TileLayer | null>(null);
  const windLayerRef = useRef<L.Layer | null>(null);
  const windLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const communalLayerRef = useRef<L.LayerGroup | null>(null);
  const firmsLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const effisHotspotsLayerRef = useRef<L.GeoJSON | L.TileLayer.WMS | null>(null);
  const effisBurnedAreasLayerRef = useRef<L.GeoJSON | null>(null);

  // Fonction pour charger la modélisation de vent
  const loadWindModeling = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      // Nettoyage de la couche existante
      if (windLayerGroupRef.current && mapRef.current) {
        mapRef.current.removeLayer(windLayerGroupRef.current);
        windLayerGroupRef.current = null;
      }
      if (windLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(windLayerRef.current);
        windLayerRef.current = null;
      }

      // Calculer la date et l'heure
      const now = new Date();
      const yyyy = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const HH = String(now.getHours()).padStart(2, "0");
      const dateStr = `${yyyy}${MM}${dd}`;

      // Charger les données de vent depuis AtmoSud
      const data = await loadWindFromAtmoSud(dateStr, HH);

      // Créer le LayerGroup pour le vent
      const windLayerGroup = L.layerGroup();

      // Utiliser leaflet-velocity pour afficher les données de vent
      const velocityLayer = (L as any).velocityLayer({
        displayValues: false,
        displayOptions: false,
        data: data,
        velocityScale: 0.004,
        lineWidth: 2,
        colorScale: [
          "#8cb38a", // couleur unique pour tout le vent
        ],
        minVelocity: 0,
        maxVelocity: 30,
        overlayName: "wind_layer",
      });

      // Ajouter le layer au groupe
      velocityLayer.addTo(windLayerGroup);
      windLayerRef.current = velocityLayer;

      // Ajouter le groupe à la carte
      if (mapRef.current) {
        windLayerGroup.addTo(mapRef.current);
        windLayerGroupRef.current = windLayerGroup;
      }
    } catch (error) {
      console.error(
        "❌ [WIND] Erreur lors du chargement des données de vent:",
        error
      );
      // Afficher un message d'erreur dans la console (vous pouvez adapter pour un système de notification)
      alert(`Impossible de charger les données de vent à cette heure.`);
    }
  }, [mapRef]);

  // Effet pour mettre à jour le fond de carte et le maxZoom
  useEffect(() => {
    if (mapRef.current) {
      // Supprimer l'ancien fond de carte s'il existe
      if (currentTileLayer) {
        mapRef.current.removeLayer(currentTileLayer);
      }

      // Ajouter le nouveau fond de carte seulement si ce n'est pas la carte standard
      if (currentBaseLayer !== "Carte standard") {
        const newTileLayer = baseLayers[currentBaseLayer];
        newTileLayer.addTo(mapRef.current);
        setCurrentTileLayer(newTileLayer);
      } else {
        setCurrentTileLayer(null);
      }

      // Ajuster le maxZoom en fonction de la couche active
      const layerConfig = baseLayers[currentBaseLayer];
      const maxZoom = layerConfig.options.maxZoom || 18;
      mapRef.current.setMaxZoom(maxZoom);
    }
  }, [currentBaseLayer, currentTileLayer, mapRef]);

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

    // Cleanup: retirer l'ancien layer de vent s'il existe
    if (windLayerGroupRef.current && map) {
      map.removeLayer(windLayerGroupRef.current);
      windLayerGroupRef.current = null;
      windLayerRef.current = null;
    }

    // Pour le vent, pas besoin de vérifier isModelingAvailable car il utilise une API différente
    if (currentModelingLayer === "vent") {
      loadWindModeling();
      return;
    }

    // Vérifier si les modélisations sont disponibles pour ce pas de temps (pour pollutant)
    if (!isModelingAvailable(selectedTimeStep)) {
      return;
    }

    // Si un layer de modélisation WMTS est sélectionné (pollutant)
    if (currentModelingLayer === "pollutant") {
      try {
        // Calculer l'heure à afficher
        const hour = getModelingLayerHour(selectedTimeStep);

        // Si l'heure est invalide (scan), ne pas charger
        if (hour < 0) {
          return;
        }

        // Formater l'heure (h00, h01, ..., h47)
        const hourFormatted = formatHourLayerName(hour);
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
      setCurrentModelingWMTSLayer(null);
      setCurrentModelingLegendUrl(null);
      setCurrentModelingLegendTitle(null);
    };
  }, [
    currentModelingLayer,
    selectedTimeStep,
    selectedPollutant,
    loadWindModeling,
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

  // Effet pour gérer la couche NASA FIRMS (points chauds/incendies, WMS)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Supprimer l'ancienne couche si elle existe
    if (firmsLayerRef.current) {
      map.removeLayer(firmsLayerRef.current);
      firmsLayerRef.current = null;
    }
    setCurrentFirmsLegendUrl(null);

    let redrawInterval: ReturnType<typeof setInterval> | null = null;

    if (isFirmsLayerEnabled) {
      const firmsLayer = createFirmsWmsLayer();
      firmsLayer.addTo(map);
      firmsLayerRef.current = firmsLayer;
      setCurrentFirmsLegendUrl(getFirmsLegendUrl());

      // La fenêtre FIRMS glisse sur 7 jours : on force un rafraîchissement périodique
      // des tuiles déjà en cache pour éviter d'afficher des données figées.
      redrawInterval = setInterval(() => {
        firmsLayerRef.current?.redraw();
      }, FIRMS_REDRAW_INTERVAL_MS);
    }

    // Cleanup
    return () => {
      if (redrawInterval) {
        clearInterval(redrawInterval);
      }
      if (map && firmsLayerRef.current) {
        map.removeLayer(firmsLayerRef.current);
        firmsLayerRef.current = null;
      }
      setCurrentFirmsLegendUrl(null);
    };
  }, [isFirmsLayerEnabled, mapRef]);

  // Effet pour gérer la couche EFFIS feux actifs (WFS GeoJSON, repli WMS)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    let isCancelled = false;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    const removeHotspotsLayer = () => {
      if (effisHotspotsLayerRef.current && map) {
        map.removeLayer(effisHotspotsLayerRef.current);
        effisHotspotsLayerRef.current = null;
      }
    };

    const addWmsFallback = () => {
      if (isCancelled || !map) return;
      removeHotspotsLayer();
      const wmsLayer = createEffisHotspotsWmsLayer();
      wmsLayer.addTo(map);
      effisHotspotsLayerRef.current = wmsLayer;
      setCurrentEffisHotspotsLegendUrl(getEffisHotspotsLegendUrl());
    };

    const loadHotspotsWfs = async () => {
      try {
        const geoJsonLayer = await createEffisHotspotsGeoJSONLayer();
        if (isCancelled || !map) return;
        removeHotspotsLayer();
        geoJsonLayer.addTo(map);
        effisHotspotsLayerRef.current = geoJsonLayer;
        setCurrentEffisHotspotsLegendUrl(getEffisHotspotsLegendUrl());
      } catch (error) {
        console.error(
          'Erreur WFS EFFIS hotspots — repli sur WMS:',
          error
        );
        if (!isCancelled) {
          addWmsFallback();
        }
      }
    };

    removeHotspotsLayer();
    setCurrentEffisHotspotsLegendUrl(null);

    if (isEffisHotspotsEnabled) {
      loadHotspotsWfs();

      refreshInterval = setInterval(() => {
        const current = effisHotspotsLayerRef.current;
        if (current && !(current instanceof L.GeoJSON)) {
          (current as L.TileLayer.WMS).redraw();
        } else {
          loadHotspotsWfs();
        }
      }, EFFIS_REDRAW_INTERVAL_MS);
    }

    return () => {
      isCancelled = true;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      removeHotspotsLayer();
      setCurrentEffisHotspotsLegendUrl(null);
    };
  }, [isEffisHotspotsEnabled, mapRef]);

  // Effet pour gérer la couche EFFIS zones brûlées (WFS GeoJSON)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    let isCancelled = false;

    if (effisBurnedAreasLayerRef.current) {
      map.removeLayer(effisBurnedAreasLayerRef.current);
      effisBurnedAreasLayerRef.current = null;
    }
    setCurrentEffisBurnedAreasLegendUrl(null);

    if (isEffisBurnedAreasEnabled) {
      createEffisBurnedAreasGeoJSONLayer()
        .then((burnedAreasLayer) => {
          if (!isCancelled && map) {
            burnedAreasLayer.addTo(map);
            effisBurnedAreasLayerRef.current = burnedAreasLayer;
          }
        })
        .catch((error) => {
          console.error(
            'Erreur lors du chargement des zones brûlées EFFIS:',
            error
          );
        });
    }

    return () => {
      isCancelled = true;
      if (map && effisBurnedAreasLayerRef.current) {
        map.removeLayer(effisBurnedAreasLayerRef.current);
        effisBurnedAreasLayerRef.current = null;
      }
      setCurrentEffisBurnedAreasLegendUrl(null);
    };
  }, [isEffisBurnedAreasEnabled, mapRef]);

  return {
    currentTileLayer,
    currentModelingWMTSLayer,
    currentModelingLegendUrl,
    currentModelingLegendTitle,
    currentFirmsLegendUrl,
    currentEffisHotspotsLegendUrl,
    currentEffisBurnedAreasLegendUrl,
  };
};
