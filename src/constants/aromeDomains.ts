/** Domaines multi-niveaux du POC AROME (PACA exclu). */
export const AROME_DOMAIN_IDS = [
  'Marseille',
  'Nice',
  'Toulon',
  'Fos',
] as const;

export type AromeDomainId = (typeof AROME_DOMAIN_IDS)[number];

export const AROME_DOMAIN_DEFAULT: AromeDomainId = 'Marseille';

/** bbox retarome: [min_lon, min_lat, max_lon, max_lat] */
export const AROME_DOMAIN_BBOX: Record<
  AromeDomainId,
  [number, number, number, number]
> = {
  Marseille: [5.15, 43.15, 5.6, 43.45],
  Nice: [7.05, 43.55, 7.45, 43.85],
  Toulon: [5.7, 42.95, 6.2, 43.25],
  Fos: [4.75, 43.35, 5.15, 43.6],
};

/** Leaflet [[south, west], [north, east]] */
export function aromeDomainLeafletBounds(
  domain: AromeDomainId
): [[number, number], [number, number]] {
  const [minLon, minLat, maxLon, maxLat] = AROME_DOMAIN_BBOX[domain];
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

export function isAromeDomainId(value: string): value is AromeDomainId {
  return (AROME_DOMAIN_IDS as readonly string[]).includes(value);
}

export function assertAromeDomain(value: string): AromeDomainId {
  if (!isAromeDomainId(value)) {
    throw new Error(
      `Domaine AROME invalide: ${value}. Attendu: ${AROME_DOMAIN_IDS.join(', ')}`
    );
  }
  return value;
}

/** Instant calendaire local (comme MapInstant) → date/heure du fichier netCDF (UTC). */
export type AromeLocalInstant = {
  date: string;
  hour: number;
  minute?: number;
};

export type AromeUtcInstant = {
  date: string;
  hour: number;
};

/**
 * Les archives AROME sont en UTC tz-naive (00–23 UTC).
 * OpenAirMap affiche un instant local : on convertit via le fuseau du navigateur
 * (Europe/Paris sur les postes Atmosud).
 */
export function mapInstantToAromeUtc(
  instant: AromeLocalInstant
): AromeUtcInstant {
  const [y, m, d] = instant.date.split('-').map(Number);
  const hour = Math.max(0, Math.min(23, Math.floor(instant.hour)));
  const minute = Math.max(0, Math.min(59, Math.floor(instant.minute ?? 0)));
  const local = new Date(y, m - 1, d, hour, minute, 0, 0);
  const yy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(local.getUTCDate()).padStart(2, '0');
  return {
    date: `${yy}-${mm}-${dd}`,
    hour: local.getUTCHours(),
  };
}
