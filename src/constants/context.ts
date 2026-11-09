/**
 * Commentaires & signalements : identifiants de « sujet ».
 *
 * Tout repose sur le champ `capteur_id` de la table capteurs.context, qui
 * identifie ce dont parle le commentaire :
 *   - capteur          -> son id (ex: "nebuleair-200")
 *   - bateau           -> "boat-<mmsi>"
 *   - zone             -> "zone-<type>-<slug du nom>"
 *   - signalement GPS  -> "sig-<id généré>" (avec geoloc=true + lat/long)
 *
 * Toutes les lignes d'un même sujet partagent ce `capteur_id` = un fil.
 */

/** Réduit une chaîne à `^[a-zA-Z0-9_-]+$` (contrainte de l'API), sans accents */
const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();

/** Sujet pour un capteur : on garde son id tel quel (déjà au bon format) */
export const sensorSubjectId = (deviceId: string): string =>
  slugify(deviceId);

/** Sujet pour un bateau (MMSI) */
export const boatSubjectId = (mmsi: string): string => `boat-${slugify(mmsi)}`;

/** Sujet pour un avion (adresse ICAO hex) */
export const planeSubjectId = (hex: string): string => `plane-${slugify(hex)}`;

/** Sujet pour une zone (aéroport/port/seveso) */
export const zoneSubjectId = (kind: string, name: string): string =>
  `zone-${kind}-${slugify(name)}`.slice(0, 100);

/** Identifiant unique pour un nouveau signalement GPS */
export const newSignalementId = (): string => {
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1_000_000).toString(36);
  return `sig-${time}${rand}`;
};

/** Nom d'auteur mémorisé localement (pas d'authentification côté API) */
const USER_STORAGE_KEY = "openairmap-context-user";

export const getStoredUser = (): string => {
  try {
    return localStorage.getItem(USER_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const setStoredUser = (name: string): void => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
};

/** Types de signalement proposés (alignés sur la whitelist de l'API) */
export const SIGNALEMENT_TYPES = [
  "fire",
  "industrial",
  "traffic",
  "neighbourhood",
] as const;

export type SignalementType = (typeof SIGNALEMENT_TYPES)[number];
