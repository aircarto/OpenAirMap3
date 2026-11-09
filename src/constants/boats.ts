/**
 * Configuration de la couche de suivi des bateaux (AIS).
 *
 * Les positions proviennent du système boat-airplane-detection (InfluxDB,
 * bucket "Boat") exposées via une route API dont l'URL est fournie par la
 * variable d'environnement VITE_BOAT_API_URL.
 */

import { BoatTrack } from "../types";

// Intervalle de rafraîchissement des positions (les messages AIS arrivent
// toutes les 2 à 30 secondes par navire ; 30s est un bon compromis charge/fluidité)
export const BOAT_REFRESH_INTERVAL_MS = 30 * 1000;

/**
 * Lien entre le sélecteur de pas de temps en haut de la carte
 * (Scan / ≤2min / 15min / Heure / Jour) et l'affichage des bateaux.
 *
 * Chaque pas de temps définit :
 * - hours : profondeur du trajet récupérée auprès de l'API (paramètre `hours`)
 * - every : finesse des points demandée à l'API (paramètre `every`) — doit
 *   appartenir à la liste blanche de dataBoats.php
 * - previewMaxAgeMs : longueur de la petite traîne affichée pour les bateaux
 *   non sélectionnés (les bateaux cliqués montrent toujours tout le trajet)
 *
 * Idée : plus on « zoome » dans le temps (Scan), plus la traîne est courte et
 * fine ; plus on prend large (Jour), plus on voit un long historique espacé.
 */
export interface BoatTimeStepConfig {
  hours: number;
  every: string;
  /**
   * Longueur de la traîne des bateaux non sélectionnés.
   * - `null` = toute la fenêtre chargée (donc = exactement le pas de temps)
   * - `0` = aucune traîne (mode Scan : juste la position actuelle)
   */
  previewMaxAgeMs: number | null;
}

// La traîne DESSINÉE correspond EXACTEMENT au pas de temps choisi :
// Scan = position actuelle, 2 min = trajet des 2 dernières minutes, etc.
//
// On découple la fenêtre CHARGÉE (`hours`) de la traîne DESSINÉE
// (`previewMaxAgeMs`) : pour les pas de temps courts on charge quand même
// 30 min de données pour que les marqueurs restent stables (pas de bateaux
// qui clignotent/disparaissent), mais on ne dessine la traîne que sur la
// durée du pas de temps. `previewMaxAgeMs: null` = toute la fenêtre chargée.
//
// Bonus : Scan / 2 min / 15 min partagent la même fenêtre (0.5h, 30s), donc
// basculer entre eux ne déclenche aucun rechargement réseau — seule la
// longueur de traîne change à l'écran.
export const BOAT_TIMESTEP_CONFIG: Record<string, BoatTimeStepConfig> = {
  instantane: { hours: 1, every: "30s", previewMaxAgeMs: 15 * 60 * 1000 }, // traînée visible (15 min) ; trajet complet (1 h chargée) au clic
  deuxMin: { hours: 0.5, every: "30s", previewMaxAgeMs: 2 * 60 * 1000 }, // 2 min
  quartHeure: { hours: 0.5, every: "30s", previewMaxAgeMs: 15 * 60 * 1000 }, // 15 min
  heure: { hours: 1, every: "60s", previewMaxAgeMs: null }, // 1 h (toute la fenêtre)
  jour: { hours: 24, every: "300s", previewMaxAgeMs: null }, // 24 h
};

// Repli si le pas de temps est inconnu (ex: source spéciale sans équivalent)
export const DEFAULT_BOAT_TIMESTEP = "quartHeure";

export const getBoatTimeStepConfig = (
  timeStep: string | undefined
): BoatTimeStepConfig =>
  (timeStep && BOAT_TIMESTEP_CONFIG[timeStep]) ||
  BOAT_TIMESTEP_CONFIG[DEFAULT_BOAT_TIMESTEP];

// Le tracé est découpé en tronçons d'opacité croissante (effet de fondu :
// plus c'est ancien, plus c'est transparent). Nombre maximum de tronçons
// par bateau pour limiter le nombre de couches Leaflet.
export const BOAT_TRAIL_MAX_SEGMENTS = 24;

// Deux styles de traîne :
// - vue d'ensemble (aucune sélection) : courte, fine et discrète
// - bateau sélectionné : trajectoire complète, épaisse et bien visible
export interface BoatTrailStyle {
  weight: number;
  minOpacity: number;
  maxOpacity: number;
  /** Profondeur de traîne affichée (ms) ; null = toute la fenêtre chargée */
  maxAgeMs: number | null;
}

export const BOAT_TRAIL_PREVIEW: BoatTrailStyle = {
  weight: 2,
  minOpacity: 0.06,
  maxOpacity: 0.35,
  maxAgeMs: 10 * 60 * 1000, // 10 dernières minutes seulement
};

export const BOAT_TRAIL_SELECTED: BoatTrailStyle = {
  weight: 4,
  minOpacity: 0.25,
  maxOpacity: 0.95,
  maxAgeMs: null, // toute la trajectoire chargée
};

// Au-delà de ce délai sans nouvelle position, le marqueur est estompé
// (navire probablement sorti de la zone ou transpondeur coupé)
export const BOAT_STALE_AFTER_MS = 30 * 60 * 1000;

// Vitesse maximale plausible (nœuds) : au-delà, la vitesse calculée à partir
// de deux positions successives est considérée comme aberrante et ignorée
export const BOAT_MAX_PLAUSIBLE_SPEED_KNOTS = 80;

// En deçà de cette vitesse, le navire est considéré à l'arrêt (à quai / au
// mouillage) : le marqueur est alors orienté au heading AIS (orientation de la
// coque) plutôt qu'au cap sur le fond, qui n'a aucun sens à l'arrêt.
export const BOAT_STATIONARY_SPEED_KNOTS = 0.5;

// À partir de ce niveau de zoom Leaflet, on dessine la coque à la vraie échelle
// (silhouette en mètres, façon MarineTraffic) au lieu de l'icône de taille fixe.
// En dessous, les navires seraient des taches de quelques pixels : on garde
// l'icône lisible. ~15 correspond à l'échelle d'un port.
export const BOAT_HULL_MIN_ZOOM = 15;

/**
 * Cap d'affichage d'un navire (0 = nord), partagé par l'icône ET la coque pour
 * qu'un bateau garde la même orientation quel que soit le zoom.
 * - en route (vitesse ≥ seuil) : cap sur le fond (COG), à défaut heading ;
 * - à l'arrêt : heading (orientation de la coque), à défaut le COG.
 * `courseDeg` contient déjà le COG AIS ou, à défaut, un cap dérivé protégé du
 * jitter GPS ; il n'y a donc plus de cap parasite à quai.
 * Renvoie null si aucune orientation fiable n'est disponible (la coque retombe
 * alors sur l'icône ; l'icône, elle, se rabat sur 0 = nord).
 */
export const getBoatDisplayHeadingDeg = (track: BoatTrack): number | null => {
  const isMoving = (track.speedKnots ?? 0) >= BOAT_STATIONARY_SPEED_KNOTS;
  return isMoving
    ? track.courseDeg ?? track.headingDeg ?? null
    : track.headingDeg ?? track.courseDeg ?? null;
};

/**
 * Catégories de navires dérivées du code AIS `ship_type`.
 * Référence : ITU-R M.1371 (types de navires AIS).
 * `key` sert de suffixe de clé i18n (`boats.types.<key>`).
 */
export interface BoatCategory {
  key:
    | "fishing"
    | "special"
    | "pleasure"
    | "highspeed"
    | "passenger"
    | "cargo"
    | "tanker"
    | "other";
  color: string;
}

const BOAT_CATEGORIES: Record<BoatCategory["key"], BoatCategory> = {
  fishing: { key: "fishing", color: "#f59e0b" },
  special: { key: "special", color: "#0d9488" },
  pleasure: { key: "pleasure", color: "#8b5cf6" },
  highspeed: { key: "highspeed", color: "#ec4899" },
  passenger: { key: "passenger", color: "#2563eb" },
  cargo: { key: "cargo", color: "#16a34a" },
  tanker: { key: "tanker", color: "#dc2626" },
  other: { key: "other", color: "#6b7280" },
};

export const getBoatCategory = (
  shipType: number | null | undefined
): BoatCategory => {
  if (shipType == null) return BOAT_CATEGORIES.other;

  if (shipType === 30) return BOAT_CATEGORIES.fishing;
  if (shipType === 36 || shipType === 37) return BOAT_CATEGORIES.pleasure;
  // Remorqueurs, pilotes, SAR, dragage, militaire... : navires de service
  if (
    [31, 32, 33, 34, 35, 50, 51, 52, 53, 55].includes(shipType) ||
    (shipType >= 90 && shipType <= 99)
  ) {
    return BOAT_CATEGORIES.special;
  }
  if (shipType >= 40 && shipType <= 49) return BOAT_CATEGORIES.highspeed;
  if (shipType >= 60 && shipType <= 69) return BOAT_CATEGORIES.passenger;
  if (shipType >= 70 && shipType <= 79) return BOAT_CATEGORIES.cargo;
  if (shipType >= 80 && shipType <= 89) return BOAT_CATEGORIES.tanker;

  return BOAT_CATEGORIES.other;
};
