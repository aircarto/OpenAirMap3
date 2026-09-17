export const pasDeTemps = {
  instantane: { name: "Scan", code: "instantane", activated: false }, // Valeurs instantanées
  deuxMin: { name: "≤ 2 min", code: "2min", activated: false }, // Moyenne sur 2 minutes
  quartHeure: { name: "15 min", code: "qh", activated: false }, // Moyenne sur 15 minutes
  heure: { name: "Heure", code: "h", activated: true }, // Moyenne horaire
  jour: { name: "Jour", code: "d", activated: false }, // Moyenne journalière
};

export type TimeStepCode = keyof typeof pasDeTemps;

/** Pas de temps exposés dans l’UI (`activated: true` dans le catalogue). */
export const getAvailableTimeSteps = (): TimeStepCode[] =>
  (Object.keys(pasDeTemps) as TimeStepCode[]).filter(
    (code) => pasDeTemps[code].activated
  );

export const isTimeStepAvailable = (timeStep: string): boolean =>
  pasDeTemps[timeStep as TimeStepCode]?.activated === true;

export const getDefaultTimeStep = (): TimeStepCode =>
  getAvailableTimeSteps()[0] ?? "heure";

/** Pas de temps pour lesquels le mode historique / TimeBar est disponible */
export const HISTORICAL_MODE_ALLOWED_TIME_STEPS = [
  "heure",
] as const;

export const isHistoricalModeAllowedForTimeStep = (timeStep: string): boolean =>
  (HISTORICAL_MODE_ALLOWED_TIME_STEPS as readonly string[]).includes(timeStep);
