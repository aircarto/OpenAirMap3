/**
 * Configuration pour HistoricalChart (séries, formatage, seuils)
 */

import type { TFunction } from "i18next";
import { pollutants } from "../../../constants/pollutants";
import { QUALITY_COLORS } from "../../../constants/qualityColors";
import { areThresholdsEqual } from "./historicalChartUtils";
import { getPollutantColor } from "./historicalChartUtils";

/**
 * Éclaircit une couleur hexadécimale
 */
const lightenColor = (color: string, factor: number): string => {
  // Convertir la couleur hex en RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Éclaircir en ajoutant du blanc
  const newR = Math.min(255, Math.round(r + (255 - r) * factor));
  const newG = Math.min(255, Math.round(g + (255 - g) * factor));
  const newB = Math.min(255, Math.round(b + (255 - b) * factor));

  // Convertir en hex
  return `#${newR.toString(16).padStart(2, "0")}${newG
    .toString(16)
    .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
};

export interface SeriesConfig {
  dataKey: string;
  name: string;
  color: string;
  strokeWidth: number;
  strokeDasharray: string;
  yAxisId: "left" | "right";
  connectNulls: boolean;
}

/**
 * Obtient les seuils communs des polluants sélectionnés
 */
export const getCommonThresholds = (
  selectedPollutants: string[],
  source: string,
  stations: any[]
): any | null => {
  if (selectedPollutants.length === 0) return null;

  // En mode comparaison, on a un seul polluant
  const pollutantsToCheck =
    source === "comparison" && stations.length > 0
      ? [selectedPollutants[0]]
      : selectedPollutants;

  // Récupérer les seuils du premier polluant
  const firstPollutant = pollutantsToCheck[0];
  const firstThresholds = pollutants[firstPollutant]?.thresholds;
  if (!firstThresholds) return null;

  // Vérifier si tous les polluants ont les mêmes seuils
  const allHaveSameThresholds = pollutantsToCheck.every((pollutant) => {
    const pollutantThresholds = pollutants[pollutant]?.thresholds;
    return (
      pollutantThresholds &&
      areThresholdsEqual(firstThresholds, pollutantThresholds)
    );
  });

  return allHaveSameThresholds ? firstThresholds : null;
};

/** Locale pour le formatage des dates (ex: "fr-FR", "en-GB") */
const getLocale = (locale?: string): string => locale || "fr-FR";

/**
 * Détermine le format optimal pour les labels de l'axe X selon la plage de dates
 */
export const getXAxisDateFormat = (
  chartData: any[],
  isMobile: boolean,
  locale?: string
): { type: string; format: (date: Date) => string } => {
  const loc = getLocale(locale);
  if (chartData.length === 0) {
    return {
      type: "hour",
      format: (date: Date) =>
        date.toLocaleString(loc, { hour: "2-digit", minute: "2-digit" }),
    };
  }

  // Récupérer les dates min et max
  const dates = chartData
    .map((point: any) => {
      const timestamp =
        point.timestampValue !== undefined
          ? point.timestampValue
          : point.rawTimestamp;
      if (typeof timestamp === "number") {
        return new Date(timestamp);
      }
      return new Date(timestamp);
    })
    .filter((date) => !isNaN(date.getTime()));

  if (dates.length === 0) {
    return {
      type: "hour",
      format: (date: Date) =>
        date.toLocaleString(loc, { hour: "2-digit", minute: "2-digit" }),
    };
  }

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Calculer la différence en millisecondes
  const diffMs = maxDate.getTime() - minDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const diffMonths =
    (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
    (maxDate.getMonth() - minDate.getMonth());
  const diffYears = maxDate.getFullYear() - minDate.getFullYear();

  // Déterminer le format selon la plage
  if (diffYears > 0) {
    return {
      type: "year-month",
      format: (date: Date) => {
        if (isMobile) {
          return `${date.getMonth() + 1}/${date.getFullYear()}`;
        }
        return date.toLocaleString(loc, {
          month: "short",
          year: "numeric",
        });
      },
    };
  } else if (diffMonths > 3) {
    return {
      type: "month",
      format: (date: Date) => {
        if (isMobile) {
          return `${date.getMonth() + 1}/${date.getFullYear()}`;
        }
        return date.toLocaleString(loc, {
          month: "short",
          year: "numeric",
        });
      },
    };
  } else if (diffMonths > 0) {
    return {
      type: "month-day",
      format: (date: Date) => {
        if (isMobile) {
          return `${date.getDate()}/${date.getMonth() + 1}`;
        }
        return date.toLocaleString(loc, { month: "short", day: "2-digit" });
      },
    };
  } else if (diffDays > 1) {
    return {
      type: "day",
      format: (date: Date) => {
        if (isMobile) {
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          return `${day}/${month} ${hours}:${minutes}`;
        }
        return date.toLocaleString(loc, { day: "2-digit", month: "short" });
      },
    };
  } else if (diffDays > 0) {
    return {
      type: "day-hour",
      format: (date: Date) => {
        if (isMobile) {
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          return `${day}/${month} ${hours}:${minutes}`;
        }
        return date.toLocaleString(loc, {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    };
  } else {
    return {
      type: "hour",
      format: (date: Date) => {
        if (isMobile) {
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          return `${hours}:${minutes}`;
        }
        return date.toLocaleString(loc, {
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    };
  }
};

/**
 * Génère les configurations de séries pour amCharts
 */
export const generateSeriesConfigs = (
  source: string,
  stations: any[],
  selectedPollutants: string[],
  unitKeys: string[],
  unitGroups: Record<string, string[]>,
  pollutantDataFlags: Record<
    string,
    { hasCorrected: boolean; hasRaw: boolean }
  >,
  showRawData: boolean,
  useSolidNebuleAirLines: boolean,
  fallbackColors: string[],
  timeStep?: string,
  chartData?: any[],
  t?: TFunction
): SeriesConfig[] => {
  const suffix = (key: "correctedSuffix" | "rawSuffix" | "modelingSuffix") =>
    t ? t(`chart.${key}`) : key === "correctedSuffix" ? " (corrigé)" : key === "rawSuffix" ? " (brute)" : " (modélisation)";
  const pollName = (code: string) =>
    t ? t(`pollutants.${code}`) : (pollutants[code]?.name || code);

  // Pour les pas de temps agrégés, insérer des points null et utiliser connect: false
  // pour créer des gaps visuels dans la ligne
  // Les points null sont insérés par fillGapsInData
  const isAggregatedTimeStep =
    timeStep && ["quartHeure", "heure", "jour"].includes(timeStep);
  // Avec connect: false et des points null, amCharts devrait dessiner des segments séparés
  const shouldConnectNulls = !isAggregatedTimeStep;

  if (source === "comparison" && stations.length > 0) {
    const configs: SeriesConfig[] = [];
    stations.forEach((station, index) => {
      const pollutant = selectedPollutants[0];
      const stationColor = fallbackColors[index % fallbackColors.length];
      const pollutantName = pollName(pollutant);

      // Pour les stations atmoMicro, gérer les données corrigées et brutes
      if (station.source === "atmoMicro" && chartData) {
        // Vérifier si cette station a des données corrigées
        const hasCorrected = chartData.some(
          (point: any) => point[`${station.id}_corrected`] !== undefined
        );
        const hasRaw = chartData.some(
          (point: any) => point[`${station.id}_raw`] !== undefined
        );

        // Ajouter la série corrigée si disponible
        if (hasCorrected) {
          configs.push({
            dataKey: `${station.id}_corrected`,
            name: `${station.name} - ${pollutantName} ${suffix("correctedSuffix")}`,
            color: stationColor,
            strokeWidth: 2,
            strokeDasharray: "0",
            yAxisId: "left" as const,
            connectNulls: shouldConnectNulls,
          });
        }

        // Ajouter la série brute si disponible et si showRawData est activé ou s'il n'y a pas de données corrigées
        if (hasRaw && (showRawData || !hasCorrected)) {
          configs.push({
            dataKey: `${station.id}_raw`,
            name: `${station.name} - ${pollutantName} ${suffix("rawSuffix")}`,
            color: stationColor,
            strokeWidth: 2,
            strokeDasharray: "3 3",
            yAxisId: "left" as const,
            connectNulls: shouldConnectNulls,
          });
        }

        // Si aucune donnée corrigée ni brute, utiliser la valeur principale
        if (!hasCorrected && !hasRaw) {
          configs.push({
            dataKey: station.id,
            name: `${station.name} - ${pollutantName}`,
            color: stationColor,
            strokeWidth: 2,
            strokeDasharray: "0",
            yAxisId: "left" as const,
            connectNulls: shouldConnectNulls,
          });
        }
      } else {
        // Pour les autres sources, déterminer le style de ligne selon la source
        // NebuleAir : dépend de useSolidNebuleAirLines (feature flag SOLID_LINE_NEBULEAIR)
        // AtmoRef et autres : trait plein
        const isNebuleAir = station.source === "nebuleair";
        configs.push({
          dataKey: station.id,
          name: `${station.name} - ${pollutantName}`,
          color: stationColor,
          strokeWidth: 2,
          strokeDasharray: isNebuleAir && !useSolidNebuleAirLines ? "3 3" : "0",
          yAxisId: "left" as const,
          connectNulls: shouldConnectNulls,
        });
      }
    });
    return configs;
  }

  // Mode normal : séries par unité
  const configs: SeriesConfig[] = [];
  unitKeys.forEach((unit, unitIndex) => {
    const pollutantsInUnit = unitGroups[unit];
    const yAxisId = unitIndex === 0 ? ("left" as const) : ("right" as const);

    pollutantsInUnit.forEach((pollutant, pollutantIndex) => {
      const pollutantColor = getPollutantColor(pollutant, pollutantIndex);
      const pollutantName = pollName(pollutant);
      const flags = pollutantDataFlags[pollutant] || {
        hasCorrected: false,
        hasRaw: false,
      };
      const hasCorrectedData = flags.hasCorrected;
      const hasRawData = flags.hasRaw;

      const isAtmoRef = source === "atmoRef";
      const isAtmoMicro = source === "atmoMicro";

      if (isAtmoRef) {
        // AtmoRef : toujours trait plein
        configs.push({
          dataKey: pollutant,
          name: pollutantName,
          color: pollutantColor,
          strokeWidth: 2,
          strokeDasharray: "0",
          yAxisId,
          connectNulls: shouldConnectNulls,
        });
      } else if (isAtmoMicro) {
        // AtmoMicro : données corrigées (trait plein) et brutes (trait discontinu)
        if (hasCorrectedData) {
          configs.push({
            dataKey: `${pollutant}_corrected`,
            name: `${pollutantName} ${suffix("correctedSuffix")}`,
            color: pollutantColor,
            strokeWidth: 2,
            strokeDasharray: "0",
            yAxisId,
            connectNulls: shouldConnectNulls,
          });
        }
        if (hasRawData && (showRawData || !hasCorrectedData)) {
          configs.push({
            dataKey: `${pollutant}_raw`,
            name: `${pollutantName} ${suffix("rawSuffix")}`,
            color: pollutantColor,
            strokeWidth: 2,
            strokeDasharray: "3 3",
            yAxisId,
            connectNulls: shouldConnectNulls,
          });
        }
      } else if (useSolidNebuleAirLines) {
        configs.push({
          dataKey: pollutant,
          name: pollutantName,
          color: pollutantColor,
          strokeWidth: 2,
          strokeDasharray: "0",
          yAxisId,
          connectNulls: shouldConnectNulls,
        });
      } else {
        // Autres sources : trait discontinu par défaut
        configs.push({
          dataKey: pollutant,
          name: pollutantName,
          color: pollutantColor,
          strokeWidth: 2,
          strokeDasharray: "3 3",
          yAxisId,
          connectNulls: shouldConnectNulls,
        });
      }

      // Ajouter la série de modélisation si disponible
      const modelingKey = `${pollutant}_modeling`;
      if (chartData && chartData.length > 0) {
        // Vérifier si des points ont des données de modélisation
        const modelingPoints = chartData.filter((point: any) => {
          const value = point[modelingKey];
          return value !== undefined && value !== null && !isNaN(value);
        });

        if (modelingPoints.length > 0) {
          // Utiliser une couleur plus claire pour la modélisation (assombrir légèrement)
          const modelingColor = lightenColor(pollutantColor, 0.3); // Éclaircir de 30%
          configs.push({
            dataKey: modelingKey,
            name: `${pollutantName} ${suffix("modelingSuffix")}`,
            color: modelingColor,
            strokeWidth: 2,
            strokeDasharray: "5 5", // Pointillés plus espacés pour distinguer de la mesure
            yAxisId,
            connectNulls: shouldConnectNulls,
          });
        } else {
          // Log détaillé pour déboguer
          const samplePoints = chartData.slice(0, 5);
          const sampleKeys = samplePoints.map((p: any) => Object.keys(p));
        }
      } else {
      }
    });
  });

  return configs;
};

/**
 * Calcule les marges du graphique selon le mode
 */
export const getChartMargins = (
  isLandscapeMobile: boolean,
  isMobile: boolean
): { top: number; right: number; left: number; bottom: number } => {
  if (isLandscapeMobile) {
    return { top: 40, right: 5, left: 2, bottom: 5 };
  }
  if (isMobile) {
    return { top: 40, right: 5, left: 5, bottom: 10 };
  }
  return { top: 45, right: 30, left: 20, bottom: 5 };
};
