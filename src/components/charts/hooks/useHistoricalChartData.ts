/**
 * Hook pour gérer les données transformées et la configuration du graphique historique
 */

import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HistoricalDataPoint, StationInfo } from "../../../types";
import {
  transformData,
  groupPollutantsByUnit,
} from "../utils/historicalChartDataTransformers";
import {
  getCommonThresholds,
  getXAxisDateFormat,
  generateSeriesConfigs,
  SeriesConfig,
} from "../utils/historicalChartConfig";
import { fallbackColors } from "../utils/historicalChartUtils";

interface UseHistoricalChartDataProps {
  data: Record<string, HistoricalDataPoint[]>;
  selectedPollutants: string[];
  source: string;
  stations: any[];
  isMobile: boolean;
  showRawData: boolean;
  useSolidNebuleAirLines: boolean;
  timeStep?: string;
  modelingData?: Record<string, HistoricalDataPoint[]>;
}

export const useHistoricalChartData = ({
  data,
  selectedPollutants,
  source,
  stations,
  isMobile,
  showRawData,
  useSolidNebuleAirLines,
  timeStep,
  modelingData,
}: UseHistoricalChartDataProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "fr";
  const localeForDate = locale.includes("fr") ? "fr-FR" : locale.includes("en") ? "en-GB" : locale.includes("es") ? "es-ES" : locale.includes("it") ? "it-IT" : "fr-FR";

  // Ref pour mémoriser le dernier résultat de fusion
  const lastMergedDataRef = useRef<{
    dataString: string;
    modelingString: string;
    result: Record<string, HistoricalDataPoint[]>;
  } | null>(null);

  // Fusionner les données mesurées et de modélisation
  // Utiliser une comparaison profonde pour éviter les recréations inutiles
  const mergedData = useMemo(() => {
    if (!modelingData || Object.keys(modelingData).length === 0) {
      // Si pas de modélisation, retourner directement data
      const dataString = JSON.stringify(data);
      if (
        lastMergedDataRef.current?.dataString === dataString &&
        lastMergedDataRef.current?.modelingString === ""
      ) {
        return lastMergedDataRef.current.result;
      }
      lastMergedDataRef.current = {
        dataString,
        modelingString: "",
        result: data,
      };
      return data;
    }

    // Vérifier si les données ont vraiment changé
    const dataString = JSON.stringify(data);
    const modelingString = JSON.stringify(modelingData);

    // Si les données n'ont pas changé, retourner le résultat précédent
    if (
      lastMergedDataRef.current &&
      lastMergedDataRef.current.dataString === dataString &&
      lastMergedDataRef.current.modelingString === modelingString
    ) {
      return lastMergedDataRef.current.result;
    }

    // Fusionner les données de modélisation avec les données mesurées
    const merged: Record<string, HistoricalDataPoint[]> = { ...data };

    Object.entries(modelingData).forEach(([key, points]) => {
      // La clé peut être soit "pollutant" (ex: "pm25") soit déjà "pollutant_modeling" (ex: "pm25_modeling")
      // Si elle se termine déjà par "_modeling", l'utiliser telle quelle, sinon ajouter "_modeling"
      const modelingKey = key.endsWith("_modeling") ? key : `${key}_modeling`;
      merged[modelingKey] = points;
    });

    // Mémoriser le résultat
    lastMergedDataRef.current = {
      dataString,
      modelingString,
      result: merged,
    };

    return merged;
  }, [data, modelingData]);

  // Ref pour mémoriser le dernier chartData
  const lastChartDataRef = useRef<{
    mergedDataString: string;
    selectedPollutantsString: string;
    source: string;
    stationsString: string;
    isMobile: boolean;
    timeStep: string | undefined;
    result: any[];
  } | null>(null);

  // Transformer les données pour amCharts
  const chartData = useMemo(() => {
    // Créer des clés de comparaison (copier avant de trier pour ne pas modifier l'original)
    const mergedDataString = JSON.stringify(mergedData);
    const selectedPollutantsString = [...selectedPollutants].sort().join(",");
    const stationsString = JSON.stringify(stations);

    // Toujours recalculer si selectedPollutants change (même si mergedData n'a pas encore les données)
    // Cela permet d'afficher immédiatement le nouveau polluant (même vide) et de le mettre à jour quand les données arrivent
    const shouldRecalculate =
      !lastChartDataRef.current ||
      lastChartDataRef.current.selectedPollutantsString !==
        selectedPollutantsString ||
      lastChartDataRef.current.source !== source ||
      lastChartDataRef.current.stationsString !== stationsString ||
      lastChartDataRef.current.isMobile !== isMobile ||
      lastChartDataRef.current.timeStep !== timeStep ||
      lastChartDataRef.current.mergedDataString !== mergedDataString;

    if (!shouldRecalculate && lastChartDataRef.current) {
      return lastChartDataRef.current.result;
    }

    const result = transformData(
      mergedData,
      selectedPollutants,
      source,
      stations,
      isMobile,
      timeStep
    );

    // Mémoriser le résultat
    lastChartDataRef.current = {
      mergedDataString,
      selectedPollutantsString,
      source,
      stationsString,
      isMobile,
      timeStep,
      result,
    };

    return result;
  }, [mergedData, selectedPollutants, source, stations, isMobile, timeStep]);

  // Grouper les polluants par unité (utiliser mergedData pour inclure les données de modélisation si nécessaire)
  const unitGroups = useMemo(() => {
    const groups = groupPollutantsByUnit(
      mergedData,
      selectedPollutants,
      source,
      stations
    );
    return groups;
  }, [selectedPollutants, mergedData, source, stations]);

  const unitKeys = useMemo(() => Object.keys(unitGroups), [unitGroups]);

  // Déterminer le format optimal pour les labels de l'axe X
  const xAxisDateFormat = useMemo(() => {
    return getXAxisDateFormat(chartData, isMobile, localeForDate);
  }, [chartData, isMobile, localeForDate]);

  // Obtenir les seuils communs
  const commonThresholds = useMemo(() => {
    return getCommonThresholds(selectedPollutants, source, stations);
  }, [selectedPollutants, source, stations]);

  // Pré-calculer les données de correction par polluant
  const pollutantDataFlags = useMemo(() => {
    const flags: Record<string, { hasCorrected: boolean; hasRaw: boolean }> =
      {};
    selectedPollutants.forEach((pollutant) => {
      flags[pollutant] = {
        hasCorrected: chartData.some(
          (point) => point[`${pollutant}_corrected`] !== undefined
        ),
        hasRaw: chartData.some(
          (point) => point[`${pollutant}_raw`] !== undefined
        ),
      };
    });
    return flags;
  }, [selectedPollutants, chartData]);

  // Ref pour mémoriser la dernière configuration des séries
  const lastSeriesConfigsRef = useRef<{
    configKey: string;
    result: SeriesConfig[];
  } | null>(null);

  // Générer les configurations de séries
  const seriesConfigs = useMemo<SeriesConfig[]>(() => {
    // Vérifier quelles séries de modélisation sont présentes dans chartData
    const modelingSeriesPresent = selectedPollutants
      .map((pollutant) => {
        const modelingKey = `${pollutant}_modeling`;
        const hasModeling = chartData.some((point: any) => {
          const value = point[modelingKey];
          return value !== undefined && value !== null && !isNaN(value);
        });
        return hasModeling ? `${pollutant}_modeling` : null;
      })
      .filter(Boolean)
      .join(",");

    // Créer une clé de comparaison pour la configuration (copier avant de trier)
    const sortedPollutants = [...selectedPollutants].sort();
    const sortedUnitKeys = [...unitKeys].sort();
    const configKey = JSON.stringify({
      source,
      stations: stations
        .map((s) => s.id)
        .sort()
        .join(","),
      selectedPollutants: sortedPollutants.join(","),
      unitKeys: sortedUnitKeys.join(","),
      unitGroups: JSON.stringify(unitGroups),
      pollutantDataFlags: JSON.stringify(pollutantDataFlags),
      showRawData,
      useSolidNebuleAirLines,
      timeStep,
      chartDataLength: chartData.length,
      modelingSeriesPresent, // Inclure la présence de séries de modélisation
      locale: localeForDate, // Invalider le cache quand la langue change
    });

    // Si la configuration n'a pas changé, retourner le résultat précédent
    if (
      lastSeriesConfigsRef.current &&
      lastSeriesConfigsRef.current.configKey === configKey
    ) {
      return lastSeriesConfigsRef.current.result;
    }

    const configs = generateSeriesConfigs(
      source,
      stations,
      selectedPollutants,
      unitKeys,
      unitGroups,
      pollutantDataFlags,
      showRawData,
      useSolidNebuleAirLines,
      fallbackColors,
      timeStep,
      chartData,
      t
    );

    // Mémoriser le résultat
    lastSeriesConfigsRef.current = {
      configKey,
      result: configs,
    };

    return configs;
  }, [
    source,
    stations,
    selectedPollutants,
    unitKeys,
    unitGroups,
    pollutantDataFlags,
    showRawData,
    useSolidNebuleAirLines,
    timeStep,
    chartData,
    t,
  ]);

  // Détecter si des données corrigées sont disponibles (pour AtmoMicro ou en mode comparaison avec stations atmoMicro)
  const hasCorrectedData = useMemo(() => {
    // Mode normal AtmoMicro
    if (source === "atmoMicro") {
      return selectedPollutants.some((pollutant) => {
        return chartData.some(
          (point) => point[`${pollutant}_corrected`] !== undefined
        );
      });
    }

    // Mode comparaison : vérifier si au moins une station atmoMicro a des données corrigées
    if (source === "comparison" && stations && stations.length > 0) {
      return stations.some((station) => {
        if (station.source === "atmoMicro") {
          return chartData.some(
            (point) => point[`${station.id}_corrected`] !== undefined
          );
        }
        return false;
      });
    }

    return false;
  }, [source, selectedPollutants, chartData, stations]);

  // Ref pour mémoriser le dernier amChartsData
  const lastAmChartsDataRef = useRef<{
    chartDataString: string;
    result: any[];
  } | null>(null);

  // Transformer les données pour amCharts (timestamp en nombre)
  // IMPORTANT: Préserver les valeurs null pour les gaps
  // Les points null insérés par fillGapsInData doivent être préservés
  const amChartsData = useMemo(() => {
    // Créer une clé de comparaison basée sur le contenu de chartData
    const chartDataString = JSON.stringify(chartData);

    // Si les données n'ont pas changé, retourner le résultat précédent
    if (
      lastAmChartsDataRef.current &&
      lastAmChartsDataRef.current.chartDataString === chartDataString
    ) {
      return lastAmChartsDataRef.current.result;
    }

    const transformed = chartData.map((point: any) => {
      let timestamp: number;

      // Si le point a déjà un timestamp en nombre (depuis fillGapsInData), l'utiliser
      if (
        point.timestamp !== undefined &&
        typeof point.timestamp === "number"
      ) {
        timestamp = point.timestamp;
      } else if (point.timestampValue !== undefined) {
        timestamp = point.timestampValue;
      } else if (typeof point.rawTimestamp === "number") {
        timestamp = point.rawTimestamp;
      } else {
        const rawTs = point.rawTimestamp;
        if (typeof rawTs === "string" && rawTs.includes("T")) {
          if (rawTs.match(/[+-]\d{2}:\d{2}$/)) {
            timestamp = new Date(rawTs).getTime();
          } else if (rawTs.includes("Z")) {
            timestamp = new Date(rawTs).getTime();
          } else {
            timestamp = new Date(rawTs + "Z").getTime();
          }
        } else {
          timestamp = new Date(rawTs).getTime();
        }
      }

      // Préserver toutes les propriétés du point, y compris les valeurs null
      return {
        ...point,
        timestamp, // S'assurer que timestamp est toujours un nombre
      };
    });

    // Trier par timestamp pour que les gaps soient correctement positionnés
    const sorted = transformed.sort((a, b) => a.timestamp - b.timestamp);

    // Mémoriser le résultat
    lastAmChartsDataRef.current = {
      chartDataString,
      result: sorted,
    };

    return sorted;
  }, [chartData]);

  return {
    chartData,
    amChartsData,
    unitGroups,
    unitKeys,
    xAxisDateFormat,
    commonThresholds,
    seriesConfigs,
    hasCorrectedData,
  };
};
