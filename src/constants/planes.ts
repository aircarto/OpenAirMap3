/**
 * Configuration de la couche de suivi des avions (ADS-B).
 *
 * Positions issues du système boat-airplane-detection (InfluxDB, bucket
 * "Plane") exposées via la route VITE_PLANE_API_URL. Même principe que les
 * bateaux : sillage lié au sélecteur de pas de temps, icône orientée au cap.
 */

// Les avions bougent vite : on rafraîchit plus souvent que les bateaux.
export const PLANE_REFRESH_INTERVAL_MS = 15 * 1000;

export const PLANE_TRAIL_MAX_SEGMENTS = 24;

export interface PlaneTrailStyle {
  weight: number;
  minOpacity: number;
  maxOpacity: number;
  maxAgeMs: number | null;
}

export const PLANE_TRAIL_PREVIEW: PlaneTrailStyle = {
  weight: 2,
  minOpacity: 0.06,
  maxOpacity: 0.4,
  maxAgeMs: 10 * 60 * 1000,
};

export const PLANE_TRAIL_SELECTED: PlaneTrailStyle = {
  weight: 3.5,
  minOpacity: 0.25,
  maxOpacity: 0.95,
  maxAgeMs: null,
};

// Au-delà de ce délai sans position, le marqueur est estompé (avion sorti
// de portée ADS-B — ça arrive vite).
export const PLANE_STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Lien avec le sélecteur de pas de temps (comme les bateaux). Les avions
 * traversent vite : les fenêtres restent courtes pour rester lisibles.
 */
export interface PlaneTimeStepConfig {
  hours: number;
  every: string;
  previewMaxAgeMs: number | null;
}

export const PLANE_TIMESTEP_CONFIG: Record<string, PlaneTimeStepConfig> = {
  instantane: { hours: 0.5, every: "30s", previewMaxAgeMs: 2 * 60 * 1000 }, // petit sillage (2 min), trajet complet au clic
  deuxMin: { hours: 0.5, every: "30s", previewMaxAgeMs: 2 * 60 * 1000 },
  quartHeure: { hours: 0.5, every: "30s", previewMaxAgeMs: 15 * 60 * 1000 },
  heure: { hours: 1, every: "30s", previewMaxAgeMs: null },
  jour: { hours: 6, every: "120s", previewMaxAgeMs: null },
};

export const getPlaneTimeStepConfig = (
  timeStep: string | undefined
): PlaneTimeStepConfig =>
  (timeStep && PLANE_TIMESTEP_CONFIG[timeStep]) ||
  PLANE_TIMESTEP_CONFIG.quartHeure;

/**
 * Catégorie d'aéronef dérivée de la catégorie d'émetteur ADS-B (A0..A7, B*).
 * `key` sert de suffixe i18n (`planes.types.<key>`).
 */
export interface PlaneCategory {
  key: "airliner" | "jet" | "helicopter" | "light" | "other";
  color: string;
}

const PLANE_CATEGORIES: Record<PlaneCategory["key"], PlaneCategory> = {
  airliner: { key: "airliner", color: "#2563eb" }, // ligne (bleu)
  jet: { key: "jet", color: "#0891b2" }, // aviation d'affaires / léger (cyan)
  helicopter: { key: "helicopter", color: "#f59e0b" }, // hélicoptère (orange)
  light: { key: "light", color: "#8b5cf6" }, // planeur/ULM/drone (violet)
  other: { key: "other", color: "#6b7280" }, // autre (gris)
};

export const getPlaneCategory = (
  category: string | null | undefined,
  typeHint?: string | null
): PlaneCategory => {
  const c = (category || "").toUpperCase();
  // Hélicoptère : catégorie ADS-B A7, ou indice dans la description du type
  // (ex: "AIRBUS HELICOPTERS EC-145", "ROBINSON HELICOPTER")
  if (c === "A7" || /HELICOPT/i.test(typeHint || "")) {
    return PLANE_CATEGORIES.helicopter;
  }
  if (c === "A3" || c === "A4" || c === "A5") return PLANE_CATEGORIES.airliner;
  if (c === "A1" || c === "A2" || c === "A6") return PLANE_CATEGORIES.jet;
  if (c === "B1" || c === "B2" || c === "B4" || c === "B6" || c === "B7")
    return PLANE_CATEGORIES.light;
  return PLANE_CATEGORIES.other;
};

/** Pieds -> mètres */
export const feetToMeters = (ft: number): number => Math.round(ft * 0.3048);
