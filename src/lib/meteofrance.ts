/**
 * Accès serveur à l'API DPObs Météo-France (PoC JWT).
 *
 * Le token est lu depuis METEOFRANCE_API_TOKEN (jamais exposé au client).
 * Base URL : v1 (abonnement portail courant) ; v2 renvoie 403 avec le JWT PoC.
 * Surcharger via METEOFRANCE_DPOBS_BASE_URL si besoin.
 */

export const DEFAULT_DPOBS_BASE_URL =
  'https://public-api.meteofrance.fr/public/DPObs/v1';

export const getDpobsBaseUrl = (): string =>
  (process.env.METEOFRANCE_DPOBS_BASE_URL?.trim() || DEFAULT_DPOBS_BASE_URL).replace(
    /\/$/,
    ''
  );

export const getMeteoFranceApiToken = (): string | null => {
  const token = process.env.METEOFRANCE_API_TOKEN?.trim();
  return token ? token : null;
};

export type MeteoFranceUpstreamResult = {
  status: number;
  contentType: string | null;
  body: string;
};

/**
 * Appelle un chemin relatif DPObs (ex. `liste-stations`, `station/horaire?...`).
 */
export async function fetchDpobs(
  pathAndQuery: string
): Promise<MeteoFranceUpstreamResult> {
  const token = getMeteoFranceApiToken();
  if (!token) {
    return {
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'METEOFRANCE_API_TOKEN manquant',
        message:
          'Ajoutez un JWT généré sur le portail API Météo-France dans METEOFRANCE_API_TOKEN.',
      }),
    };
  }

  const base = getDpobsBaseUrl();
  const path = pathAndQuery.replace(/^\//, '');
  const url = `${base}/${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json,application/geo+json,text/csv,*/*',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const body = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    body,
  };
}
