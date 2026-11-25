import { env, parseBooleanEnv } from '../lib/env';

const DEFAULT_MICROSPOT_API_URL =
  'https://api-export-prod.uspot.probesys.net/microspot';

/** Proxy Next same-origin (dev) — conserve le Bearer vers l'API LAN. */
const SAME_ORIGIN_MICROSPOT_PROXY = '/microspot';

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

/**
 * Auth Keycloak opt-in : activée seulement si le flag est true ET que
 * URL / realm / client_id sont renseignés.
 */
export const isKeycloakAuthEnabled = (): boolean => {
  if (!parseBooleanEnv(env.keycloakEnabled, false)) {
    return false;
  }
  return Boolean(
    env.keycloakUrl?.trim() &&
      env.keycloakRealm?.trim() &&
      env.keycloakClientId?.trim()
  );
};

export const getKeycloakAuthority = (): string | null => {
  const url = env.keycloakUrl?.trim();
  const realm = env.keycloakRealm?.trim();
  if (!url || !realm) return null;
  return `${trimSlash(url)}/realms/${realm}`;
};

export const getKeycloakClientId = (): string | null => {
  const clientId = env.keycloakClientId?.trim();
  return clientId || null;
};

/** Base URL de l'API microspot (sans slash final). Préférer `/microspot` en dev. */
export const getMicrospotApiBaseUrl = (): string => {
  const configured = env.microspotApiUrl?.trim();
  if (configured) {
    return trimSlash(configured);
  }
  // En développement navigateur, le proxy Next évite le cross-origin qui
  // fait échouer les appels privilégiés (Bearer) vers l'IP LAN.
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return SAME_ORIGIN_MICROSPOT_PROXY;
  }
  return DEFAULT_MICROSPOT_API_URL;
};

/**
 * Origine OIDC : NEXT_PUBLIC_AUTH_ORIGIN si défini, sinon window.location.origin.
 * Permet d'aligner redirect_uri sur l'IP LAN déclarée dans Keycloak.
 */
export const getAuthOrigin = (): string => {
  const configured = env.authOrigin?.trim();
  if (configured) {
    return trimSlash(configured);
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export const getOidcRedirectUri = (): string => {
  const origin = getAuthOrigin();
  if (!origin) {
    return '/auth/callback';
  }
  return `${origin}/auth/callback`;
};

export const getOidcPostLogoutRedirectUri = (): string => {
  const origin = getAuthOrigin();
  return origin || '/';
};
