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

interface UseMapLayersProps {
  mapRef: React.RefObject<L.Map | null>;
  currentBaseLayer: BaseLayerKey;
  selectedTimeStep: string;
  selectedPollutant: string;
  currentModelingLayer: ModelingLayerType | null;
  modelingHourIndex?: number | null;
  isCommunalLayerEnabled: boolean;
}

export const useMapLayers = ({
  mapRef,
  currentBaseLayer,
  selectedTimeStep,
  selectedPollutant,
  currentModelingLayer,
  modelingHourIndex,
  isCommunalLayerEnabled,
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

  const modelingLayerRef = useRef<L.TileLayer | null>(null);
  const windLayerRef = useRef<L.Layer | null>(null);
  const windLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const communalLayerRef = useRef<L.LayerGroup | null>(null);

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

    // Cleanup: retirer l'ancien layer de modélisation s'il existe
    if (modelingLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(modelingLayerRef.current);
      modelingLayerRef.current = null;
      setCurrentModelingWMTSLayer(null);
    }

    // Par défaut, aucune légende n'est affichée tant qu'un nouveau layer n'est pas chargé
    setCurrentModelingLegendUrl(null);
    setCurrentModelingLegendTitle(null);

    // Cleanup: retirer l'ancien layer de vent s'il existe
    if (windLayerGroupRef.current && mapRef.current) {
      mapRef.current.removeLayer(windLayerGroupRef.current);
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
        // Calculer l'heure à afficher (0..47, h24 = heure en cours).
        // Si un index est fourni (slider), il surchage la logique par défaut.
        const fallbackHour = getModelingLayerHour(selectedTimeStep);
        const hour =
          typeof modelingHourIndex === "number" ? modelingHourIndex : fallbackHour;

        // Si l'heure est invalide (scan), ne pas charger
        if (hour < 0) {
          return;
        }
        // Bornage de sécurité
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
        if (mapRef.current) {
          wmtsLayer.addTo(mapRef.current);
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
      if (mapRef.current) {
        if (modelingLayerRef.current) {
          mapRef.current.removeLayer(modelingLayerRef.current);
          modelingLayerRef.current = null;
        }
        if (windLayerGroupRef.current) {
          mapRef.current.removeLayer(windLayerGroupRef.current);
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
    modelingHourIndex,
    loadWindModeling,
    mapRef,
  ]);

  // Effet pour gérer la couche communale (utilise GeoJSON pour un contrôle total du style)
  useEffect(() => {
    if (!mapRef.current) return;

    let isCancelled = false;

    // Supprimer l'ancienne couche si elle existe
    if (communalLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(communalLayerRef.current);
      communalLayerRef.current = null;
    }

    // Charger et ajouter la couche si elle est activée
    if (isCommunalLayerEnabled && mapRef.current) {
      createCommunalGeoJSONLayer(mapRef.current)
        .then((layerGroup) => {
          if (!isCancelled && mapRef.current) {
            layerGroup.addTo(mapRef.current);
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
      if (mapRef.current && communalLayerRef.current) {
        mapRef.current.removeLayer(communalLayerRef.current);
        communalLayerRef.current = null;
      }
    };
  }, [isCommunalLayerEnabled, mapRef]);

  return {
    currentTileLayer,
    currentModelingWMTSLayer,
    currentModelingLegendUrl,
    currentModelingLegendTitle,
  };
};
