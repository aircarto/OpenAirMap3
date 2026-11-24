import { getMicrospotApiBaseUrl } from '../../auth/keycloakConfig';
import { getAccessToken } from '../../auth/tokenStore';
import type {
  MicrospotCampaignListItem,
  MicrospotDeviceWithLocationHistory,
  MicrospotObservation,
  MicrospotStatusCode,
  MicrospotStudy,
} from '../../types';

/**
 * Client microspot de la page « Campagnes » (utilisateurs connectés).
 *
 * Distinct d'AtmoMicroV2Service pour deux raisons :
 * - il lui faut les en-têtes (`X-Truncated`), que BaseDataService ne renvoie pas ;
 * - un 401 est une erreur : pas de repli public, le privilège est le sens de la page.
 *
 * Le Bearer est relu à chaque requête : une extraction longue traverse des renews.
 *
 * @see uspot-api-export docs/api-routes.md
 */

export class MicrospotAuthError extends Error {
  constructor(message = 'Session Keycloak absente ou expirée') {
    super(message);
    this.name = 'MicrospotAuthError';
  }
}

export class MicrospotHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'MicrospotHttpError';
  }

  /** 503 (base injoignable), 504 (statement_timeout), 502/429 : à relancer. */
  get retryable(): boolean {
    return [429, 502, 503, 504].includes(this.status);
  }
}

export interface ObservationsChunkParams {
  campaignId: number;
  deviceId: string;
  variables: string[]; // codes ISO
  from: Date;
  to: Date;
}

export interface ObservationsChunkResult {
  rows: MicrospotObservation[];
  truncated: boolean;
}

export const OBSERVATION_INCLUDES =
  'raw_value,corrections_detail,manually_validated,device_model';
export const OBSERVATION_LIMIT = 500000;
export const OBSERVATION_DECIMALS = 2;

const resolveUrl = (path: string, params: Record<string, string>): string => {
  const base = getMicrospotApiBaseUrl().replace(/\/+$/, '');
  const search = new URLSearchParams(params).toString();
  return `${base}${path}${search ? `?${search}` : ''}`;
};

/** ISO UTC sans millisecondes, accepté par from_date_time / date_time. */
export const toApiDateTime = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function request<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<{ data: T[]; headers: Headers }> {
  const token = getAccessToken();
  if (!token) {
    throw new MicrospotAuthError();
  }

  const url = resolveUrl(path, params);
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal,
  });

  if (response.status === 401) {
    throw new MicrospotAuthError();
  }
  if (!response.ok) {
    throw new MicrospotHttpError(
      response.status,
      `HTTP ${response.status} ${response.statusText} (${path})`
    );
  }
  // Résultat vide : 204 sans corps (comportement 1 de l'API).
  if (response.status === 204) {
    return { data: [], headers: response.headers };
  }
  const text = await response.text();
  if (!text.trim()) {
    return { data: [], headers: response.headers };
  }
  const parsed = JSON.parse(text) as unknown;
  return {
    data: Array.isArray(parsed) ? (parsed as T[]) : [],
    headers: response.headers,
  };
}

const PRIVILEGED_LIST = { include_non_exposed: 'true' };

export const MicrospotCampaignClient = {
  async listStudies(signal?: AbortSignal): Promise<MicrospotStudy[]> {
    const { data } = await request<MicrospotStudy>(
      '/lists/studies',
      PRIVILEGED_LIST,
      signal
    );
    return data;
  },

  async listCampaigns(
    signal?: AbortSignal
  ): Promise<MicrospotCampaignListItem[]> {
    const { data } = await request<MicrospotCampaignListItem>(
      '/lists/campaigns',
      { ...PRIVILEGED_LIST, list_devices: 'true' },
      signal
    );
    return data;
  },

  /**
   * Historique des positions de chaque capteur. Seule source qui couvre les
   * sites « auto created » des capteurs citoyens (absents de /lists/locations).
   */
  async listDeviceLocationHistories(
    signal?: AbortSignal
  ): Promise<MicrospotDeviceWithLocationHistory[]> {
    const { data } = await request<MicrospotDeviceWithLocationHistory>(
      '/lists/devices',
      { ...PRIVILEGED_LIST, locations_history: 'true' },
      signal
    );
    return data;
  },

  async listStatusCodes(signal?: AbortSignal): Promise<MicrospotStatusCode[]> {
    const { data } = await request<MicrospotStatusCode>(
      '/lists/observations/status_code',
      {},
      signal
    );
    return data;
  },

  async fetchObservationsChunk(
    params: ObservationsChunkParams,
    signal?: AbortSignal
  ): Promise<ObservationsChunkResult> {
    const { data, headers } = await request<MicrospotObservation>(
      '/observations',
      {
        aggregation: 'hourly',
        campaign_id: String(params.campaignId),
        device_id: params.deviceId,
        variable: params.variables.join(','),
        from_date_time: toApiDateTime(params.from),
        date_time: toApiDateTime(params.to),
        include: OBSERVATION_INCLUDES,
        decimals: String(OBSERVATION_DECIMALS),
        limit: String(OBSERVATION_LIMIT),
        invalid: 'true',
        include_non_exposed: 'true',
      },
      signal
    );
    const truncated =
      headers.get('X-Truncated')?.toLowerCase() === 'true' ||
      data.length >= OBSERVATION_LIMIT;
    return { rows: data, truncated };
  },
};

export type MicrospotCampaignClientType = typeof MicrospotCampaignClient;
