/**
 * Stockage module-level du Bearer Keycloak.
 *
 * Les services de données (hors React) lisent le token ici ; AuthProvider le
 * met à jour après login / renew / logout.
 */

import { dispatchAuthChanged } from './authEvents';

let accessToken: string | null = null;

const listeners = new Set<(token: string | null) => void>();

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  if (accessToken === token) return;
  accessToken = token;
  listeners.forEach((listener) => listener(token));
  dispatchAuthChanged();
};

export const subscribeAccessToken = (
  listener: (token: string | null) => void
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isAuthenticated = (): boolean => Boolean(accessToken);
