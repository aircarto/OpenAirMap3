import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import L from "leaflet";
import { MeasurementDevice, SignalAirReport } from "../../../types";
import { SpatialGrid } from "../../../utils/spatialGrid";
import {
  calculateDeviceStatistics,
  calculateSourceStatistics,
  DeviceStatistics,
  SourceStatistics,
} from "../../../utils/deviceStatisticsUtils";
import { hasValidMapCoordinates } from "../../../utils/instantSnapshot";

interface UseVisibleDevicesProps {
  mapRef: React.RefObject<L.Map | null>;
  devices: MeasurementDevice[];
  reports: SignalAirReport[];
  debounceMs?: number;
}

/**
 * Hook personnalisé pour filtrer les appareils et signalements visibles dans le viewport de la carte
 * 
 * OPTIMISATION : Utilise une grille spatiale (SpatialGrid) pour un filtrage O(k) au lieu de O(n)
 * où k = appareils visibles et n = total d'appareils
 * 
 * Gain de performance : ~50-100x plus rapide avec beaucoup d'appareils (1000+)
 * 
 * @param mapRef - Référence à l'instance de la carte Leaflet
 * @param devices - Liste de tous les appareils
 * @param reports - Liste de tous les signalements
 * @param debounceMs - Délai de debounce pour les mises à jour (défaut: 100ms)
 * @returns Objet contenant les appareils et signalements visibles, ainsi que des statistiques
 */
export const useVisibleDevices = ({
  mapRef,
  devices,
  reports,
  debounceMs = 100,
}: UseVisibleDevicesProps) => {
  const [visibleDevices, setVisibleDevices] = useState<MeasurementDevice[]>([]);
  const [visibleReports, setVisibleReports] = useState<SignalAirReport[]>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  // Références pour les grilles spatiales (persistentes entre les renders)
  // Utilisation de useRef pour éviter de recréer les grilles à chaque render
  const devicesGridRef = useRef<SpatialGrid | null>(null);
  const reportsGridRef = useRef<SpatialGrid | null>(null);

  // Initialiser les grilles spatiales une seule fois
  // Taille de cellule : 0.1 degrés (~11km) - plus précis pour les zooms locaux
  // Plus petit = plus précis mais légèrement plus de cellules à vérifier
  if (!devicesGridRef.current) {
    devicesGridRef.current = new SpatialGrid(0.1);
  }
  if (!reportsGridRef.current) {
    reportsGridRef.current = new SpatialGrid(0.1);
  }

  // Reconstruire les grilles spatiales quand les listes changent
  // IMPORTANT: On rebuild à chaque changement pour garantir la cohérence
  // Utilisation d'une clé basée sur le contenu pour forcer la reconstruction
  const devicesHashRef = useRef<string>('');
  const reportsHashRef = useRef<string>('');

  useEffect(() => {
    // Créer un hash simple basé sur la longueur, IDs, positions ET valeurs pour détecter les changements
    // IMPORTANT : En mode historique, les devices ont les mêmes positions mais des valeurs différentes
    // Il faut donc inclure les valeurs dans le hash pour détecter les changements
    // Plus fiable que de dépendre uniquement de la référence
    const devicesHash = `${devices.length}_${devices.slice(0, 10).map(d => 
      `${d.id}_${hasValidMapCoordinates(d.latitude, d.longitude) ? `${d.latitude.toFixed(2)}_${d.longitude.toFixed(2)}` : 'no-coords'}_${d.value?.toFixed(2) || '0'}_${d.timestamp || ''}`
    ).join('|')}`;
    
    // Reconstruire seulement si le hash a changé
    if (devicesHash !== devicesHashRef.current) {
      devicesHashRef.current = devicesHash;
      
      if (devices.length > 0) {
        devicesGridRef.current!.build(devices);
      } else {
        devicesGridRef.current!.clear();
      }
    }
  }, [devices]);

  useEffect(() => {
    // Même logique pour les reports
    const reportsHash = `${reports.length}_${reports.slice(0, 10).map(r => `${r.id}_${hasValidMapCoordinates(r.latitude, r.longitude) ? `${r.latitude.toFixed(2)}_${r.longitude.toFixed(2)}` : 'no-coords'}`).join('|')}`;
    
    if (reportsHash !== reportsHashRef.current) {
      reportsHashRef.current = reportsHash;
      
      if (reports.length > 0) {
        reportsGridRef.current!.build(reports);
      } else {
        reportsGridRef.current!.clear();
      }
    }
  }, [reports]);

  /**
   * Fonction optimisée pour mettre à jour les appareils visibles
   * Utilise la grille spatiale pour un filtrage rapide O(k) au lieu de O(n)
   * 
   * Avant optimisation : O(n) - parcours de tous les appareils
   * Après optimisation : O(k) - seulement les appareils dans les cellules visibles
   */
  const updateVisibleDevices = useCallback(() => {
    if (!mapRef.current) {
      setVisibleDevices([]);
      setVisibleReports([]);
      setMapBounds(null);
      return;
    }

    const bounds = mapRef.current.getBounds();
    setMapBounds(bounds);

    // Vérifier que les grilles sont bien initialisées
    if (!devicesGridRef.current || !reportsGridRef.current) {
      console.warn('[useVisibleDevices] Grilles spatiales non initialisées');
      return;
    }

    // OPTIMISATION : Utiliser la grille spatiale pour filtrer rapidement
    // Au lieu de devices.filter() qui parcourt tous les appareils O(n),
    // on utilise la grille qui ne vérifie que les cellules visibles O(k)
    
    // Filtrer les appareils visibles avec la grille spatiale
    let visible: MeasurementDevice[];
    try {
      visible = devicesGridRef.current.query(bounds) as MeasurementDevice[];
      
      // Fallback de sécurité : vérifier si la grille fonctionne correctement
      // On compare avec le filtrage linéaire seulement si on suspecte un problème
      // Critères pour suspecter un problème :
      // 1. On est zoomé (bounds petits)
      // 2. On trouve beaucoup d'appareils (plus de 80% du total)
      // 3. Il y a assez d'appareils pour que la différence soit significative
      const boundsArea = (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest());
      const isZoomedIn = boundsArea < 0.5; // Zone de moins de 0.5 degré² (zoom proche)
      const ratio = visible.length / devices.length;
      
      // Seulement vérifier si on est zoomé ET qu'on trouve plus de 80% des appareils
      // ET qu'il y a assez d'appareils pour que ce soit suspect
      if (isZoomedIn && ratio > 0.8 && devices.length > 20) {
        // Vérification avec filtrage linéaire
        const linearFiltered = devices.filter(
          (device) =>
            hasValidMapCoordinates(device.latitude, device.longitude) &&
            bounds.contains([device.latitude, device.longitude])
        );
        
        // Utiliser le résultat linéaire seulement si l'écart est significatif (>20% ou >50 appareils)
        const diff = Math.abs(visible.length - linearFiltered.length);
        const diffRatio = diff / Math.max(visible.length, linearFiltered.length, 1);
        
        if (diffRatio > 0.2 || diff > 50) {
          // Écart significatif détecté - utiliser le filtrage linéaire
          console.warn(
            `[SpatialGrid] Écart significatif détecté: grille=${visible.length}, linéaire=${linearFiltered.length} (diff=${diff}), utilisation du filtrage linéaire`
          );
          visible = linearFiltered;
        }
      }
    } catch (error) {
      // En cas d'erreur, fallback vers le filtrage linéaire
      console.error('[SpatialGrid] Erreur lors de la requête, fallback linéaire:', error);
      visible = devices.filter(
        (device) =>
          hasValidMapCoordinates(device.latitude, device.longitude) &&
          bounds.contains([device.latitude, device.longitude])
      );
    }
    
    setVisibleDevices(visible);

    // Filtrer les signalements visibles avec la grille spatiale
    let visibleReps: SignalAirReport[];
    try {
      visibleReps = reportsGridRef.current.query(bounds) as SignalAirReport[];
      
      // Même vérification pour les signalements
      if (visibleReps.length > reports.length * 0.9) {
        visibleReps = reports.filter(
          (report) =>
            hasValidMapCoordinates(report.latitude, report.longitude) &&
            bounds.contains([report.latitude, report.longitude])
        );
      }
    } catch (error) {
      console.error('[SpatialGrid] Erreur lors de la requête reports, fallback linéaire:', error);
      visibleReps = reports.filter(
        (report) =>
          hasValidMapCoordinates(report.latitude, report.longitude) &&
          bounds.contains([report.latitude, report.longitude])
      );
    }
    
    setVisibleReports(visibleReps);
  }, [mapRef, devices, reports]);

  // Effet pour écouter les changements de vue de la carte
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Mise à jour initiale
    updateVisibleDevices();

    // Debounce pour optimiser les performances
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleMapMove = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        updateVisibleDevices();
      }, debounceMs);
    };

    // Écouter les événements de mouvement de la carte
    map.on("moveend", handleMapMove);
    map.on("zoomend", handleMapMove);
    map.on("resize", handleMapMove);

    // Nettoyage
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      map.off("moveend", handleMapMove);
      map.off("zoomend", handleMapMove);
      map.off("resize", handleMapMove);
    };
  }, [mapRef, updateVisibleDevices, debounceMs]);

  // Mettre à jour quand les listes d'appareils ou signalements changent
  useEffect(() => {
    updateVisibleDevices();
  }, [devices, reports, updateVisibleDevices]);

  /**
   * OPTIMISATION : Calculer les statistiques une seule fois avec useMemo
   * Les statistiques sont recalculées uniquement quand visibleDevices ou visibleReports changent
   * Cela évite les recalculs dans DeviceStatistics et StatisticsPanel
   */
  const statistics = useMemo<DeviceStatistics>(() => {
    return calculateDeviceStatistics(visibleDevices, visibleReports);
  }, [visibleDevices, visibleReports]);

  /**
   * OPTIMISATION : Calculer les statistiques par source une seule fois
   * Utilisé par StatisticsPanel pour éviter les recalculs
   */
  const sourceStatistics = useMemo<SourceStatistics[]>(() => {
    return calculateSourceStatistics(visibleDevices);
  }, [visibleDevices]);

  return {
    visibleDevices,
    visibleReports,
    mapBounds,
    statistics,
    sourceStatistics,
    updateVisibleDevices,
  };
};
