/** Ancienneté au-delà de laquelle un capteur déconnecté est dit inactif. */
export const RECENT_ACTIVITY_MAX_SECONDS = 24 * 60 * 60;

export interface SensorActivity {
  timeUTC?: string | null;
  last_seen_sec?: number | null;
}

/**
 * Lit un horodatage de capteur en millisecondes epoch.
 *
 * L'API mêle deux formes : un ISO complet (`2025-09-02T15:15:00Z`) et un
 * « SQL » sans fuseau (`2025-02-07 17:29:43`). `new Date()` interprète la
 * seconde en heure **locale**, si bien qu'un `timeUTC` lu naïvement dérive du
 * décalage du navigateur. On normalise donc avant de parser.
 */
export const parseSensorTimestamp = (
  raw: string | null | undefined
): number | null => {
  if (!raw) return null;

  const isoish = raw.trim().replace(" ", "T");
  const hasZone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(isoish);
  const parsed = Date.parse(hasZone ? isoish : `${isoish}Z`);

  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Ancienneté de la dernière émission d'un capteur, en secondes.
 *
 * `timeUTC` prime sur `last_seen_sec` : c'est un instant absolu, donc toujours
 * juste, là où `last_seen_sec` est figé au moment de la réponse. Le catalogue
 * de capteurs vivant en cache pour toute la session, s'y fier afficherait
 * encore « il y a 2 minutes » une heure plus tard.
 */
export const getSensorAgeSeconds = (
  sensor: SensorActivity,
  now: number = Date.now()
): number | null => {
  const timestamp = parseSensorTimestamp(sensor.timeUTC);
  if (timestamp !== null) {
    return Math.max(0, Math.round((now - timestamp) / 1000));
  }

  const fallback = sensor.last_seen_sec;
  return typeof fallback === "number" && Number.isFinite(fallback)
    ? Math.max(0, Math.round(fallback))
    : null;
};
