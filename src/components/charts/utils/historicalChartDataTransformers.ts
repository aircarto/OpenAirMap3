/**
 * Transformateurs de données pour HistoricalChart
 */

import { HistoricalDataPoint } from "../../../types";
import { pollutants } from "../../../constants/pollutants";
import { encodeUnit, ensureNonNegativeValue } from "./historicalChartUtils";

/**
 * Normalise un timestamp en millisecondes UTC
 */
export const normalizeTimestamp = (ts: string | number): number => {
  if (typeof ts === "number") return ts;
  if (typeof ts === "string" && ts.includes("T")) {
    // Format ISO : peut contenir Z, +00:00, -05:00, etc.
    if (ts.match(/[+-]\d{2}:\d{2}$/)) {
      // Format avec offset de fuseau horaire
      return new Date(ts).getTime();
    } else if (ts.includes("Z")) {
      // Format ISO UTC avec Z
      return new Date(ts).getTime();
    } else {
      // Format ISO sans Z ni offset : traiter comme UTC
      return new Date(ts + "Z").getTime();
    }
  }
  return new Date(ts).getTime();
};

/**
 * Formate un timestamp pour l'affichage
 */
export const formatTimestamp = (
  timestamp: string | number,
  isMobile: boolean
): string => {
  let dateMs: number;

  if (typeof timestamp === "number") {
    dateMs = timestamp;
  } else {
    dateMs = normalizeTimestamp(timestamp);
  }

  const date = new Date(dateMs);
  // Format plus court sur mobile uniquement
  return isMobile
    ? `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}h`
    : date.toLocaleString("fr-FR", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/**
 * Calcule l'intervalle en millisecondes pour un pas de temps donné
 */
const getTimeStepInterval = (timeStep: string): number | null => {
  const intervals: Record<string, number> = {
    quartHeure: 15 * 60 * 1000, // 15 minutes en millisecondes
    heure: 60 * 60 * 1000, // 1 heure en millisecondes
    jour: 24 * 60 * 60 * 1000, // 1 jour en millisecondes
  };
  return intervals[timeStep] || null;
};

/**
 * Arrondit un timestamp au pas de temps le plus proche
 */
const roundToTimeStep = (timestamp: number, interval: number): number => {
  return Math.floor(timestamp / interval) * interval;
};

/**
 * Génère tous les timestamps attendus entre le premier et le dernier point pour un pas de temps agrégé
 */
const generateExpectedTimestamps = (
  firstTimestamp: number,
  lastTimestamp: number,
  interval: number
): number[] => {
  const timestamps: number[] = [];
  let current = roundToTimeStep(firstTimestamp, interval);
  const last = roundToTimeStep(lastTimestamp, interval);

  while (current <= last) {
    timestamps.push(current);
    current += interval;
  }

  return timestamps;
};

/**
 * Détecte les gaps dans les données et insère des valeurs null pour les timestamps manquants
 * Uniquement pour les pas de temps agrégés (15min, 1h, 1j)
 *
 * Selon la doc amCharts 5:
 * - Les données doivent contenir des valeurs null aux emplacements où les gaps doivent apparaître
 * - Avec connect: false, amCharts ne connectera pas les points null, créant des gaps visuels
 * - Les timestamps doivent être des nombres (millisecondes depuis epoch)
 */
export const fillGapsInData = (data: any[], timeStep?: string): any[] => {
  // Ne traiter que les pas de temps agrégés
  if (!timeStep || !["quartHeure", "heure", "jour"].includes(timeStep)) {
    return data;
  }

  const interval = getTimeStepInterval(timeStep);
  if (!interval || data.length === 0) {
    return data;
  }

  // S'assurer que les données sont triées par timestamp
  const sortedData = [...data].sort((a, b) => {
    const tsA =
      a.timestampValue !== undefined
        ? a.timestampValue
        : normalizeTimestamp(a.rawTimestamp);
    const tsB =
      b.timestampValue !== undefined
        ? b.timestampValue
        : normalizeTimestamp(b.rawTimestamp);
    return tsA - tsB;
  });

  const firstTimestamp =
    sortedData[0].timestampValue !== undefined
      ? sortedData[0].timestampValue
      : normalizeTimestamp(sortedData[0].rawTimestamp);
  const lastTimestamp =
    sortedData[sortedData.length - 1].timestampValue !== undefined
      ? sortedData[sortedData.length - 1].timestampValue
      : normalizeTimestamp(sortedData[sortedData.length - 1].rawTimestamp);

  // Générer tous les timestamps attendus
  const expectedTimestamps = generateExpectedTimestamps(
    firstTimestamp,
    lastTimestamp,
    interval
  );

  // Créer une map des données existantes par timestamp arrondi
  // IMPORTANT: Utiliser le timestamp arrondi comme clé, mais préserver le timestampValue original du point
  const dataMap = new Map<number, any>();
  sortedData.forEach((point) => {
    const ts =
      point.timestampValue !== undefined
        ? point.timestampValue
        : normalizeTimestamp(point.rawTimestamp);
    const roundedTs = roundToTimeStep(ts, interval);

    // Si on a déjà un point pour ce timestamp arrondi, garder celui qui est le plus proche
    if (!dataMap.has(roundedTs)) {
      // Créer une copie du point avec le timestamp arrondi pour timestampValue
      // mais garder les autres propriétés intactes
      const mappedPoint = {
        ...point,
        timestampValue: roundedTs, // Utiliser le timestamp arrondi pour l'alignement
      };
      dataMap.set(roundedTs, mappedPoint);
    } else {
      // Si on a déjà un point, vérifier lequel est le plus proche du timestamp arrondi
      const existingPoint = dataMap.get(roundedTs);
      const existingTs =
        existingPoint.timestampValue !== undefined
          ? existingPoint.timestampValue
          : normalizeTimestamp(existingPoint.rawTimestamp);
      const existingDiff = Math.abs(existingTs - roundedTs);
      const currentDiff = Math.abs(ts - roundedTs);

      // Garder le point le plus proche
      if (currentDiff < existingDiff) {
        const mappedPoint = {
          ...point,
          timestampValue: roundedTs,
        };
        dataMap.set(roundedTs, mappedPoint);
      }
    }
  });

  // Identifier toutes les clés de données (polluants, stations, modélisation, etc.) présentes dans les données
  const allDataKeys = new Set<string>();
  sortedData.forEach((point) => {
    Object.keys(point).forEach((key) => {
      // Inclure toutes les clés sauf les métadonnées de timestamp et les unités
      // Cela inclut les polluants, les données corrigées/brutes, et les données de modélisation
      if (
        !["timestamp", "rawTimestamp", "timestampValue"].includes(key) &&
        !key.endsWith("_unit")
      ) {
        allDataKeys.add(key);
      }
    });
  });

  // Construire le tableau final avec les gaps remplis
  // Selon la doc amCharts: insérer des valeurs null pour créer des gaps avec connect: false
  const filledData: any[] = [];
  let gapCount = 0;
  let dataPointCount = 0;

  expectedTimestamps.forEach((expectedTs) => {
    const existingPoint = dataMap.get(expectedTs);

    if (existingPoint) {
      // Créer une copie du point avec le timestampValue correct (arrondi)
      // pour s'assurer que les timestamps sont bien alignés
      const point = {
        ...existingPoint,
        timestampValue: expectedTs, // Utiliser le timestamp arrondi attendu
      };
      filledData.push(point);
      dataPointCount++;
    } else {
      // Gap détecté : créer un point avec des valeurs null
      // Selon la doc amCharts, les valeurs null créent des gaps avec connect: false
      const date = new Date(expectedTs);
      // Formater le timestamp pour l'affichage (utiliser le même format que les autres points)
      const timestampFormatted = formatTimestamp(date.toISOString(), false);
      const gapPoint: any = {
        timestamp: timestampFormatted, // Formaté pour l'affichage
        rawTimestamp: date.toISOString(),
        timestampValue: expectedTs, // Timestamp en nombre (millisecondes) pour amCharts DateAxis
      };

      // Ajouter null pour chaque série
      // IMPORTANT: Utiliser null (pas undefined) car amCharts détecte mieux null
      // Mais si connect: false ne fonctionne pas, essayer undefined
      allDataKeys.forEach((key) => {
        gapPoint[key] = null; // null est la valeur standard pour les gaps selon la doc
      });

      // Préserver les unités
      if (sortedData.length > 0) {
        const samplePoint = sortedData[0];
        Object.keys(samplePoint).forEach((key) => {
          if (key.endsWith("_unit")) {
            gapPoint[key] = samplePoint[key];
          }
        });
      }

      filledData.push(gapPoint);
      gapCount++;
    }
  });

  return filledData;
};

/**
 * Transforme les données pour le mode comparaison
 */
export const transformComparisonData = (
  data: Record<string, HistoricalDataPoint[]>,
  stations: any[],
  selectedPollutants: string[],
  isMobile: boolean,
  timeStep?: string
): any[] => {
  const allTimestamps = new Map<number, string>(); // Map timestamp numérique -> string original
  const pollutant = selectedPollutants[0]; // Un seul polluant en mode comparaison

  // Récupérer tous les timestamps uniques de toutes les stations
  stations.forEach((station) => {
    if (data[station.id]) {
      data[station.id].forEach((point) => {
        const timestampMs = normalizeTimestamp(point.timestamp);
        if (!allTimestamps.has(timestampMs)) {
          allTimestamps.set(timestampMs, point.timestamp);
        }
      });
    }
  });

  // Trier les timestamps numériques
  const sortedTimestamps = Array.from(allTimestamps.entries()).sort(
    (a, b) => a[0] - b[0]
  );

  // Créer les points de données
  const transformedData = sortedTimestamps.map(
    ([timestampMs, originalTimestamp]) => {
      const date = new Date(timestampMs);
      const timestamp = formatTimestamp(originalTimestamp, isMobile);

      const point: any = {
        timestamp,
        rawTimestamp: originalTimestamp,
        timestampValue: timestampMs,
      };

      // Ajouter les valeurs pour chaque station
      stations.forEach((station) => {
        if (data[station.id]) {
          const dataPoint = data[station.id].find(
            (p) => normalizeTimestamp(p.timestamp) === timestampMs
          );
          if (dataPoint) {
            // Pour les stations atmoMicro, gérer les données corrigées et brutes
            if (station.source === "atmoMicro") {
              // Valeur corrigée si disponible
              if (dataPoint.corrected_value !== undefined) {
                point[`${station.id}_corrected`] = ensureNonNegativeValue(
                  dataPoint.corrected_value
                );
              }
              // Valeur brute
              if (dataPoint.raw_value !== undefined) {
                point[`${station.id}_raw`] = ensureNonNegativeValue(
                  dataPoint.raw_value
                );
              }
              // Valeur principale : utiliser corrigée si disponible, sinon brute
              if (dataPoint.corrected_value !== undefined) {
                point[station.id] = ensureNonNegativeValue(
                  dataPoint.corrected_value
                );
              } else if (dataPoint.raw_value !== undefined) {
                point[station.id] = ensureNonNegativeValue(dataPoint.raw_value);
              } else {
                point[station.id] = ensureNonNegativeValue(dataPoint.value);
              }
            } else {
              // Pour les autres sources (atmoRef, etc.), utiliser simplement value
              point[station.id] = ensureNonNegativeValue(dataPoint.value);
            }

            let unit = dataPoint.unit;
            if (!unit && pollutants[pollutant]) {
              unit = pollutants[pollutant].unit;
            }
            point[`${station.id}_unit`] = unit;
          }
        }
      });

      return point;
    }
  );

  // Remplir les gaps pour les pas de temps agrégés
  return fillGapsInData(transformedData, timeStep);
};

/**
 * Transforme les données pour le mode normal
 */
export const transformNormalData = (
  data: Record<string, HistoricalDataPoint[]>,
  selectedPollutants: string[],
  source: string,
  isMobile: boolean,
  timeStep?: string
): any[] => {
  // Récupérer tous les timestamps uniques (y compris ceux de la modélisation)
  const allTimestamps = new Set<string>();
  selectedPollutants.forEach((pollutant) => {
    if (data[pollutant]) {
      data[pollutant].forEach((point) => {
        allTimestamps.add(point.timestamp);
      });
    }
    // Ajouter aussi les timestamps de la modélisation
    const modelingKey = `${pollutant}_modeling`;
    if (data[modelingKey]) {
      data[modelingKey].forEach((point) => {
        allTimestamps.add(point.timestamp);
      });
    }
  });

  // Trier les timestamps en les convertissant en dates pour un tri correct
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => {
    return normalizeTimestamp(a) - normalizeTimestamp(b);
  });

  // Log pour déboguer les problèmes de pas de temps
  if (selectedPollutants.includes("pm25") && sortedTimestamps.length > 0) {
    const firstTs = normalizeTimestamp(sortedTimestamps[0]);
    const lastTs = normalizeTimestamp(
      sortedTimestamps[sortedTimestamps.length - 1]
    );
    const timeDiff = lastTs - firstTs;
    const hours = timeDiff / (60 * 60 * 1000);
    const expectedPoints =
      timeStep === "quartHeure"
        ? hours * 4
        : timeStep === "heure"
        ? hours
        : timeStep === "jour"
        ? hours / 24
        : sortedTimestamps.length;
  }

  // Créer les points de données
  const transformedData = sortedTimestamps.map((timestamp) => {
    const dateMs = normalizeTimestamp(timestamp);
    const timestampFormatted = formatTimestamp(timestamp, isMobile);

    const point: any = {
      timestamp: timestampFormatted,
      rawTimestamp: timestamp,
      timestampValue: dateMs,
    };

    // Ajouter les valeurs pour chaque polluant (corrigées et brutes)
    selectedPollutants.forEach((pollutant) => {
      const timestampMs = normalizeTimestamp(timestamp);

      // Pour les pas de temps agrégés, utiliser une tolérance plus large
      // car les données peuvent être arrondies différemment
      const isAggregatedTimeStep =
        timeStep && ["quartHeure", "heure", "jour"].includes(timeStep);
      const tolerance = isAggregatedTimeStep
        ? (timeStep === "quartHeure"
            ? 15 * 60 * 1000
            : timeStep === "heure"
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000) / 2
        : 1000; // 1 seconde pour les pas de temps non agrégés

      // Chercher les données mesurées pour ce polluant
      if (data[pollutant]) {
        const dataPoint = data[pollutant].find((p) => {
          const pTimestampMs = normalizeTimestamp(p.timestamp);
          // Comparer en millisecondes avec une tolérance adaptée au pas de temps
          return Math.abs(pTimestampMs - timestampMs) < tolerance;
        });

        if (dataPoint) {
          // Valeur corrigée si disponible
          if (dataPoint.corrected_value !== undefined) {
            point[`${pollutant}_corrected`] = ensureNonNegativeValue(
              dataPoint.corrected_value
            );
          }

          // Valeur brute
          if (dataPoint.raw_value !== undefined) {
            point[`${pollutant}_raw`] = ensureNonNegativeValue(
              dataPoint.raw_value
            );
          }

          // Valeur principale : pour AtmoMicro avec données corrigées, utiliser _corrected
          if (source === "atmoMicro") {
            if (dataPoint.corrected_value === undefined) {
              point[`${pollutant}_raw`] = ensureNonNegativeValue(
                dataPoint.value
              );
            }
          } else {
            point[pollutant] = ensureNonNegativeValue(dataPoint.value);
          }

          // Stocker l'unité pour ce polluant
          let unit = dataPoint.unit;
          if (!unit && pollutants[pollutant]) {
            unit = pollutants[pollutant].unit;
          }
          point[`${pollutant}_unit`] = unit;
        }
      }

      // Ajouter les données de modélisation si disponibles (même si pas de données mesurées)
      const modelingKey = `${pollutant}_modeling`;
      if (data[modelingKey]) {
        // Chercher le point de modélisation le plus proche (tolérance de 30 minutes pour les données horaires)
        const modelingPoint = data[modelingKey].reduce(
          (closest: any, p: any) => {
            const pTimestampMs = normalizeTimestamp(p.timestamp);
            const diff = Math.abs(pTimestampMs - timestampMs);
            // Tolérance de 30 minutes (1800000 ms) pour les données horaires
            if (diff < 1800000) {
              if (
                !closest ||
                diff <
                  Math.abs(normalizeTimestamp(closest.timestamp) - timestampMs)
              ) {
                return p;
              }
            }
            return closest;
          },
          null
        );

        if (modelingPoint) {
          // Valeurs aberrantes (null, -9999) : afficher un gap, pas 0
          const rawValue = modelingPoint.value;
          const isInvalid =
            rawValue === null ||
            rawValue === undefined ||
            rawValue === -9999;
          point[modelingKey] = isInvalid
            ? null
            : ensureNonNegativeValue(rawValue);
        } else {
          // Si pas de point correspondant, mettre null pour créer un gap
          point[modelingKey] = null;
        }
      }
    });

    return point;
  });

  // Remplir les gaps pour les pas de temps agrégés
  const filledData = fillGapsInData(transformedData, timeStep);

  return filledData;
};

/**
 * Transforme les données pour amCharts
 */
export const transformData = (
  data: Record<string, HistoricalDataPoint[]>,
  selectedPollutants: string[],
  source: string,
  stations: any[],
  isMobile: boolean,
  timeStep?: string
): any[] => {
  if (selectedPollutants.length === 0) return [];

  // Mode comparaison : données par station
  if (source === "comparison" && stations.length > 0) {
    return transformComparisonData(
      data,
      stations,
      selectedPollutants,
      isMobile,
      timeStep
    );
  }

  // Mode normal : données par polluant
  return transformNormalData(
    data,
    selectedPollutants,
    source,
    isMobile,
    timeStep
  );
};

/**
 * Groupe les polluants par unité
 */
export const groupPollutantsByUnit = (
  data: Record<string, HistoricalDataPoint[]>,
  selectedPollutants: string[],
  source: string,
  stations: any[]
): Record<string, string[]> => {
  const unitGroups: Record<string, string[]> = {};

  // Mode comparaison : les données sont groupées par station ID
  if (source === "comparison" && stations.length > 0) {
    const pollutant = selectedPollutants[0];
    for (const station of stations) {
      if (data[station.id] && data[station.id].length > 0) {
        const unit = encodeUnit(data[station.id][0].unit);
        if (!unitGroups[unit]) {
          unitGroups[unit] = [];
        }
        if (!unitGroups[unit].includes(pollutant)) {
          unitGroups[unit].push(pollutant);
        }
        break;
      }
    }
  } else {
    // Mode normal : les données sont groupées par polluant
    selectedPollutants.forEach((pollutant) => {
      if (data[pollutant] && data[pollutant].length > 0) {
        const unit = encodeUnit(data[pollutant][0].unit);
        if (!unitGroups[unit]) {
          unitGroups[unit] = [];
        }
        unitGroups[unit].push(pollutant);
      }
    });
  }

  return unitGroups;
};
