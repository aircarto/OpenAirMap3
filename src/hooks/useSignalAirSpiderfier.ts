import { useEffect, useRef, useState, useMemo } from "react";
import { useMap } from "react-leaflet";
import { SignalAirReport } from "../types";

interface UseSignalAirSpiderfierProps {
  reports: SignalAirReport[];
  enabled: boolean;
  zoomThreshold?: number;
}

// Fonction pour normaliser et comparer les positions géographiques
// Utilise une précision de 9 décimales (environ 0.11 mm de précision)
// Cette précision garantit que seules les positions vraiment identiques sont regroupées
const normalizeCoordinate = (coord: number): number => {
  // Arrondir à 9 décimales pour éviter les problèmes de précision des nombres flottants
  return Math.round(coord * 1000000000) / 1000000000;
};

// Fonction pour créer une clé de position normalisée
const getPositionKey = (lat: number, lng: number): string => {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  return `${normalizedLat},${normalizedLng}`;
};

export const useSignalAirSpiderfier = ({
  reports,
  enabled,
  zoomThreshold = 12,
}: UseSignalAirSpiderfierProps) => {
  const map = useMap();
  const [spiderfiedMarkers, setSpiderfiedMarkers] = useState<Map<string, any>>(
    new Map()
  );
  const [groupCenters, setGroupCenters] = useState<
    Map<number, [number, number]>
  >(new Map());
  const [currentZoom, setCurrentZoom] = useState<number>(map?.getZoom() || 0);
  const markerRefs = useRef<Map<string, any>>(new Map());

  // Écouter les changements de zoom
  useEffect(() => {
    if (!map) return;

    const handleZoom = () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
    };

    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
    };

    // Écouter les événements de zoom
    map.on("zoom", handleZoom);
    map.on("zoomend", handleZoomEnd);

    // Initialiser le zoom actuel
    const initialZoom = map.getZoom();
    if (initialZoom !== undefined) {
      setCurrentZoom(initialZoom);
    }

    return () => {
      map.off("zoom", handleZoom);
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, zoomThreshold]);

  // Grouper les signalements par position exacte (lat, lng) avec comparaison numérique robuste
  const reportsByPosition = useMemo(() => {
    const groups = new Map<string, SignalAirReport[]>();
    reports.forEach((report) => {
      // Utiliser une clé normalisée pour éviter les problèmes de précision flottante
      const key = getPositionKey(report.latitude, report.longitude);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(report);
    });
    return groups;
  }, [reports]);

  // Déterminer quels signalements doivent être spiderfiés (seulement ceux avec position exacte identique)
  const reportsToSpiderfy = useMemo(() => {
    const result: SignalAirReport[][] = [];
    reportsByPosition.forEach((group) => {
      // Seulement spiderfier si plus d'un signalement à la même position exacte
      if (group.length > 1) {
        result.push(group);
      }
    });
    return result;
  }, [reportsByPosition]);

  useEffect(() => {
    if (!enabled || !map || reports.length === 0 || reportsToSpiderfy.length === 0) {
      // Désactiver le spiderfier si pas de signalements ou pas de groupes à spiderfier
      setSpiderfiedMarkers(new Map());
      setGroupCenters(new Map());
      return;
    }

    // Vérifier si le zoom est suffisant pour activer le spiderfier
    const shouldSpiderfy = currentZoom >= zoomThreshold;

    if (!shouldSpiderfy) {
      // Désactiver le spiderfier si le zoom n'est pas suffisant
      setSpiderfiedMarkers(new Map());
      setGroupCenters(new Map());
      return;
    }

    // Fonction pour générer des positions en spirale
    const generateSpiralPositions = (
      centerLat: number,
      centerLng: number,
      count: number
    ) => {
      const positions = [];
      const angleStep = (2 * Math.PI) / count;
      const radius = 0.001; // Rayon en degrés

      for (let i = 0; i < count; i++) {
        const angle = i * angleStep;
        const lat = centerLat + radius * Math.cos(angle);
        const lng = centerLng + radius * Math.sin(angle);
        positions.push([lat, lng]);
      }
      return positions;
    };

    // Utiliser les groupes précalculés basés sur les positions géographiques exactes
    const analyzeOverlappingMarkers = () => {
      return reportsToSpiderfy;
    };

    // Traiter les groupes qui se chevauchent
    const processOverlappingGroups = (groups: SignalAirReport[][]) => {
      const newSpiderfiedMarkers = new Map<string, any>();
      const newGroupCenters = new Map<number, [number, number]>();

      groups.forEach((group, groupIndex) => {
        if (group.length < 2) return;

        // Calculer le centre du groupe
        const centerLat =
          group.reduce((sum, report) => sum + report.latitude, 0) /
          group.length;
        const centerLng =
          group.reduce((sum, report) => sum + report.longitude, 0) /
          group.length;

        // Stocker le centre du groupe
        newGroupCenters.set(groupIndex, [centerLat, centerLng]);

        // Générer des positions en spirale
        const spiralPositions = generateSpiralPositions(
          centerLat,
          centerLng,
          group.length
        );

        group.forEach((report, reportIndex) => {
          const newPosition = spiralPositions[reportIndex];
          newSpiderfiedMarkers.set(report.id, {
            originalPosition: [report.latitude, report.longitude],
            spiderfiedPosition: newPosition,
            report: report,
            groupIndex: groupIndex,
          });
        });
      });

      setSpiderfiedMarkers(newSpiderfiedMarkers);
      setGroupCenters(newGroupCenters);
    };

    // Analyser et traiter les marqueurs
    const groups = analyzeOverlappingMarkers();
    processOverlappingGroups(groups);
  }, [enabled, map, reportsToSpiderfy, currentZoom, zoomThreshold, reports.length]);

  // Fonction pour obtenir la position d'un marqueur (originale ou éclatée)
  const getMarkerPosition = (report: SignalAirReport) => {
    const spiderfiedData = spiderfiedMarkers.get(report.id);
    if (spiderfiedData) {
      return spiderfiedData.spiderfiedPosition;
    }
    return [report.latitude, report.longitude];
  };

  // Fonction pour vérifier si un marqueur est éclaté
  const isMarkerSpiderfied = (report: SignalAirReport) => {
    return spiderfiedMarkers.has(report.id);
  };

  // Fonction pour obtenir les données d'éclatement d'un marqueur
  const getSpiderfiedData = (report: SignalAirReport) => {
    return spiderfiedMarkers.get(report.id);
  };

  return {
    getMarkerPosition,
    isMarkerSpiderfied,
    getSpiderfiedData,
    spiderfiedMarkers: Array.from(spiderfiedMarkers.values()),
    groupCenters: Array.from(groupCenters.entries()),
  };
};

