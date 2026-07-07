export const MICROSPOT_ENV = 'staging' as const;

export const MICROSPOT_BASE_URL =
  (import.meta.env.VITE_MICROSPOT_API_URL as string | undefined)?.trim() ||
  '/microspot';

export const MICROSPOT_DEVICES_CACHE_DURATION = 30 * 60 * 1000;

/** Limite max d'observations par requête sur GET /observations/ */
export const MICROSPOT_OBSERVATIONS_LIMIT = 5000;

/** Taille des tranches temporelles pour l'historique capteur par capteur (jours) */
export const MICROSPOT_HISTORICAL_CHUNK_DAYS = 30;

/** Taille des tranches pour l'agrégation scan (données plus denses) */
export const MICROSPOT_SCAN_HISTORICAL_CHUNK_DAYS = 7;
export const MICROSPOT_POLLUTANT_TO_ISO: Record<string, string> = {
  pm25: '39',
  pm10: '24',
  pm1: '68',
  no2: '03',
  o3: '08',
  so2: '01',
};

/** Code ISO → code OpenAirMap */
export const MICROSPOT_ISO_TO_POLLUTANT: Record<string, string> = {
  '24': 'pm10',
  '39': 'pm25',
  '68': 'pm1',
  '03': 'no2',
  '08': 'o3',
  '01': 'so2',
};

export type MicrospotAggregation = 'scan' | 'quarter-hourly' | 'hourly' | 'daily';

export interface MicrospotTimeStepConfig {
  aggregation: MicrospotAggregation;
  delay: number;
}

/** Mapping pas de temps OpenAirMap → agrégation + délai fraîcheur (minutes) */
export const MICROSPOT_TIME_STEP_CONFIGS: Record<string, MicrospotTimeStepConfig> =
  {
    instantane: { aggregation: 'scan', delay: 181 },
    deuxMin: { aggregation: 'scan', delay: 3 },
    quartHeure: { aggregation: 'quarter-hourly', delay: 19 },
    heure: { aggregation: 'hourly', delay: 64 },
  };

export const getMicrospotIsoCode = (pollutant: string): string | null =>
  MICROSPOT_POLLUTANT_TO_ISO[pollutant] ?? null;

export const getMicrospotTimeStepConfig = (
  timeStep: string
): MicrospotTimeStepConfig | null =>
  MICROSPOT_TIME_STEP_CONFIGS[timeStep] ?? null;
