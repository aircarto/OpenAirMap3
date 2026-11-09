import { env } from "../lib/env";

// Pas de temps affiché à l'ouverture : « heure » sauf si le déploiement demande
// le Scan (NEXT_PUBLIC_DEFAULT_TIME_STEP=instantane).
const scanByDefault = env.defaultTimeStep === "instantane";

export const pasDeTemps = {
  instantane: { name: "Scan", code: "instantane", activated: scanByDefault }, // Valeurs instantanées
  deuxMin: { name: "≤ 2 min", code: "2min", activated: false }, // Moyenne sur 2 minutes
  quartHeure: { name: "15 min", code: "qh", activated: false }, // Moyenne sur 15 minutes
  heure: { name: "Heure", code: "h", activated: !scanByDefault }, // Moyenne horaire
  jour: { name: "Jour", code: "d", activated: false }, // Moyenne journalière
};

/** Pas de temps pour lesquels le mode historique est disponible (15 min, heure, jour uniquement) */
export const HISTORICAL_MODE_ALLOWED_TIME_STEPS = [
  "quartHeure",
  "heure",
  "jour",
] as const;

export const isHistoricalModeAllowedForTimeStep = (timeStep: string): boolean =>
  (HISTORICAL_MODE_ALLOWED_TIME_STEPS as readonly string[]).includes(timeStep);
