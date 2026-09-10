/**
 * Configuration centralisée des marqueurs
 * Centralise tous les chemins et configurations des marqueurs
 */

import { featureFlags } from "../config/featureFlags";

export interface MarkerConfig {
  source: string;
  basePath: string;
  levels: string[];
  defaultLevel: string;
}

export const MARKER_CONFIGS: Record<string, MarkerConfig> = {
  atmoRef: {
    source: "atmoRef",
    basePath: "atmoRefMarkers/refStationAtmoSud",
    levels: [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
      "default",
    ],
    defaultLevel: "default",
  },
  atmoMicro: {
    source: "atmoMicro",
    basePath: "atmoMicroMarkers/microStationAtmoSud",
    levels: [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
      "default",
    ],
    defaultLevel: "default",
  },
  nebuleair: {
    source: "nebuleair",
    basePath: "nebuleAirMarkers/nebuleAir",
    levels: [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
      "default",
    ],
    defaultLevel: "default",
  },
  purpleair: {
    source: "purpleair",
    basePath: "purpleAirMarkers/purpleAir",
    levels: [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
      "default",
    ],
    defaultLevel: "default",
  },
  sensorCommunity: {
    source: "sensorCommunity",
    basePath: "sensorCommunityMarkers/SensorCommunity",
    levels: [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
      "default",
    ],
    defaultLevel: "default",
  },
  signalair: {
    source: "signalair",
    basePath: "signalAirMarkers",
    levels: ["odeur", "bruit", "brulage", "visuel", "pollen"],
    defaultLevel: "odeur",
  },
  mobileair: {
    source: "mobileair",
    basePath: "mobileAirMarkers/mobileAir",
    levels: [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
      "default",
    ],
    defaultLevel: "default",
  },
};

/**
 * Mapping spécial pour SignalAir (types de signalements)
 */
export const SIGNAL_AIR_MAPPING: Record<string, string> = {
  odeur: "odeur",
  bruit: "bruits", // Le fichier s'appelle "bruits.png"
  brulage: "brulage",
  visuel: "visuel",
  pollen: "pollen",
};

/**
 * Mappe les sources communautaires vers le marqueur unifié
 * @param source - Le code de la source
 * @returns Le code de la source pour le marqueur (peut être différent de la source originale)
 */
function getMarkerSource(source: string): string {
  if (!featureFlags.markerNebuleAir) {
    // Si le flag est false : les 3 sources communautaires partagent le même marqueur (celui de nebuleair)
    if (source === "sensorCommunity" || source === "purpleair" || source === "nebuleair") {
      return "nebuleair";
    }
  } else {
    // Si le flag est true : nebuleair a son propre marqueur
    // sensorCommunity et purpleair partagent le marqueur de sensorCommunity
    if (source === "sensorCommunity" || source === "purpleair") {
      return "sensorCommunity";
    }
    // nebuleair garde son propre marqueur (retourne "nebuleair")
  }
  return source;
}

/**
 * Obtient le chemin complet d'un marqueur
 * @param source - Le code de la source
 * @param level - Le niveau de qualité ou type de signalement
 * @returns Le chemin complet vers l'image du marqueur
 */
export function getMarkerPath(source: string, level: string): string {
  // Mapper la source vers le marqueur approprié (sensorCommunity et purpleair -> nebuleair)
  const markerSource = getMarkerSource(source);
  const config = MARKER_CONFIGS[markerSource];

  if (!config) {
    console.warn(
      `Configuration de marqueur non trouvée pour la source: ${source} (mappée vers: ${markerSource})`
    );
    return `/markers/atmoRefMarkers/refStationAtmoSud_default.png`;
  }

  // Gestion spéciale pour SignalAir
  if (markerSource === "signalair") {
    const signalType = SIGNAL_AIR_MAPPING[level] || "odeur";
    return `/markers/${config.basePath}/${signalType}.png`;
  }

  // Vérifier que le niveau est valide
  if (!config.levels.includes(level)) {
    console.warn(
      `Niveau de qualité invalide: ${level} pour la source: ${source} (mappée vers: ${markerSource})`
    );
    level = config.defaultLevel;
  }

  return `/markers/${config.basePath}_${level}.png`;
}

/**
 * Obtient tous les niveaux disponibles pour une source
 * @param source - Le code de la source
 * @returns Liste des niveaux disponibles
 */
export function getAvailableLevels(source: string): string[] {
  const markerSource = getMarkerSource(source);
  return MARKER_CONFIGS[markerSource]?.levels || [];
}

/**
 * Obtient le niveau par défaut pour une source
 * @param source - Le code de la source
 * @returns Le niveau par défaut
 */
export function getDefaultLevel(source: string): string {
  const markerSource = getMarkerSource(source);
  return MARKER_CONFIGS[markerSource]?.defaultLevel || "default";
}

/**
 * Vérifie si un marqueur existe pour une source et un niveau donnés
 * @param source - Le code de la source
 * @param level - Le niveau de qualité
 * @returns True si le marqueur existe
 */
export function markerExists(source: string, level: string): boolean {
  const markerSource = getMarkerSource(source);
  const config = MARKER_CONFIGS[markerSource];
  if (!config) return false;

  if (markerSource === "signalair") {
    return Object.prototype.hasOwnProperty.call(SIGNAL_AIR_MAPPING, level);
  }

  return config.levels.includes(level);
}
