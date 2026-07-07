import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { HistoricalDataPoint, StationInfo } from "../../types";
import {
  exportAmChartsAsPNG,
  exportDataAsCSV,
  generateExportFilename,
} from "../../utils/exportUtils";
import { featureFlags } from "../../config/featureFlags";
import ExportMenu from "./ExportMenu";
import { useHistoricalChartData } from "./hooks/useHistoricalChartData";
import { useAmChartsChart } from "./hooks/useAmChartsChart";
import { getChartMargins } from "./utils/historicalChartConfig";

interface HistoricalChartProps {
  data: Record<string, HistoricalDataPoint[]>;
  selectedPollutants: string[];
  source: string; // Source de données (atmoRef, atmoMicro, comparison, etc.)
  onHasCorrectedDataChange?: (hasCorrectedData: boolean) => void;
  stations?: any[]; // Stations pour le mode comparaison
  showRawData?: boolean; // Contrôler l'affichage des données brutes
  stationInfo?: StationInfo | null; // Informations de la station pour les exports
  timeStep?: string; // Pas de temps sélectionné (pour les métadonnées d'export)
  sensorTimeStep?: number | null; // Pas de temps du capteur en secondes (pour le mode instantane)
  modelingData?: Record<string, HistoricalDataPoint[]>; // Données de modélisation
  hideThresholdBackgroundForColorblind?: boolean; // Masque le fond coloré par seuil (mode daltoniens)
  revealUpToDate?: string;
  xAxisMin?: string;
  xAxisMax?: string;
}

const HistoricalChart: React.FC<HistoricalChartProps> = ({
  data,
  selectedPollutants,
  source,
  onHasCorrectedDataChange,
  stations = [],
  showRawData = true,
  stationInfo = null,
  timeStep,
  sensorTimeStep,
  modelingData,
  hideThresholdBackgroundForColorblind = false,
  revealUpToDate,
  xAxisMin,
  xAxisMax,
}) => {
  // État pour détecter le mode paysage sur mobile
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  // État pour détecter si on est sur mobile
  const [isMobile, setIsMobile] = useState(false);

  // Références pour le conteneur
  const containerRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef<string>(
    `historical-chart-${Math.random().toString(36).substr(2, 9)}`
  );

  const useSolidNebuleAirLines =
    featureFlags.solidLineNebuleAir &&
    (source?.toLowerCase() === "nebuleair" ||
      (source === "comparison" &&
        stations.some((station) => station.source === "nebuleair")));

  // Créer une clé stable basée sur les IDs des stations pour éviter les recréations inutiles
  const prevStationsKeyRef = useRef<string>("");
  const stationsKey = useMemo(() => {
    if (stations.length === 0) {
      const emptyKey = "";
      if (prevStationsKeyRef.current !== emptyKey) {
        prevStationsKeyRef.current = emptyKey;
      }
      return prevStationsKeyRef.current;
    }
    const newKey = stations
      .map((s) => s.id)
      .sort()
      .join(",");
    if (newKey !== prevStationsKeyRef.current) {
      prevStationsKeyRef.current = newKey;
    }
    return prevStationsKeyRef.current;
  }, [stations]);

  // Mémoriser stationInfo basé sur son ID pour éviter les recréations inutiles
  const stationInfoKey = useMemo(() => {
    return stationInfo?.id || null;
  }, [stationInfo?.id]);

  // Effet pour détecter le mode paysage sur mobile
  useEffect(() => {
    const checkOrientation = () => {
      const mobile = window.innerWidth <= 768;
      const isLandscape = window.innerHeight < window.innerWidth;
      setIsMobile(mobile);
      setIsLandscapeMobile(mobile && isLandscape);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Utiliser le hook pour gérer les données transformées
  const {
    chartData,
    amChartsData,
    unitKeys,
    xAxisDateFormat,
    commonThresholds,
    seriesConfigs,
    hasCorrectedData,
  } = useHistoricalChartData({
    data,
    selectedPollutants,
    source,
    stations,
    isMobile,
    showRawData,
    useSolidNebuleAirLines,
    timeStep,
    modelingData,
    revealUpToDate,
  });

  // Calculer les marges du graphique
  const chartMargins = useMemo(() => {
    return getChartMargins(isLandscapeMobile, isMobile);
  }, [isLandscapeMobile, isMobile]);

  // Utiliser le hook pour gérer le graphique amCharts
  const { chartRef, rootRef } = useAmChartsChart({
    containerRef,
    containerId: containerIdRef.current,
    chartData,
    amChartsData,
    seriesConfigs,
    unitKeys,
    commonThresholds: hideThresholdBackgroundForColorblind
      ? null
      : commonThresholds,
    xAxisDateFormat,
    chartMargins,
    isMobile,
    isLandscapeMobile,
    stationInfo,
    timeStep,
    xAxisMin,
    xAxisMax,
  });

  // Notifier le composant parent si des données corrigées sont disponibles
  useEffect(() => {
    if (onHasCorrectedDataChange) {
      onHasCorrectedDataChange(hasCorrectedData);
    }
  }, [hasCorrectedData, onHasCorrectedDataChange]);

  // Fonctions d'exportation - Mémorisées pour éviter les recréations inutiles
  const handleExportPNG = useCallback(async () => {
    if (!chartData.length || !chartRef.current || !rootRef.current) return;

    try {
      const filename = generateExportFilename(
        source,
        selectedPollutants,
        stations,
        stationInfo
      );

      await exportAmChartsAsPNG(
        containerRef,
        filename,
        stationInfo,
        selectedPollutants,
        source,
        stations,
        timeStep,
        sensorTimeStep
      );
    } catch (error) {
      console.error("Erreur lors de l'export PNG:", error);
      alert("Erreur lors de l'exportation en PNG");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chartData.length,
    source,
    selectedPollutants,
    stationsKey,
    stationInfoKey,
  ]);

  const handleExportCSV = useCallback(() => {
    if (!chartData.length) return;

    try {
      const filename = generateExportFilename(
        source,
        selectedPollutants,
        stations,
        stationInfo
      );
      exportDataAsCSV(
        chartData,
        filename,
        source,
        stations,
        selectedPollutants,
        stationInfo,
        timeStep,
        sensorTimeStep
      );
    } catch (error) {
      console.error("Erreur lors de l'export CSV:", error);
      alert("Erreur lors de l'exportation en CSV");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, source, selectedPollutants, stationsKey, stationInfoKey]);

  // Afficher un message si aucune donnée n'est disponible
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Bouton burger et menu d'export en haut à droite */}
      <ExportMenu
        hasData={chartData.length > 0}
        onExportPNG={handleExportPNG}
        onExportCSV={handleExportCSV}
      />

      {/* Graphique (zoom/pan axe Y via scrollbar Y native amCharts) */}
      <div className="flex-1 min-h-0">
        <div
          ref={containerRef}
          id={containerIdRef.current}
          className="w-full h-full"
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    </div>
  );
};

export default HistoricalChart;
