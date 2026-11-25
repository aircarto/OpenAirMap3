import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getMicrospotApiBaseUrl,
  getOidcRedirectUri,
  isKeycloakAuthEnabled,
} from '../keycloakConfig';

describe('keycloakConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retourne l’URL microspot prod par défaut', () => {
    vi.stubEnv('NEXT_PUBLIC_MICROSPOT_API_URL', '');
    expect(getMicrospotApiBaseUrl()).toBe(
      'https://api-export-prod.uspot.probesys.net/microspot'
    );
  });

  it('utilise NEXT_PUBLIC_MICROSPOT_API_URL sans slash final', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_MICROSPOT_API_URL',
      'http://172.16.13.183:3032/microspot/'
    );
    expect(getMicrospotApiBaseUrl()).toBe(
      'http://172.16.13.183:3032/microspot'
    );
  });

  it('force redirect_uri via NEXT_PUBLIC_AUTH_ORIGIN', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ORIGIN', 'http://localhost:3000/');
    expect(getOidcRedirectUri()).toBe('http://localhost:3000/auth/callback');
  });

  it('désactive Keycloak si le flag est false', () => {
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_URL', 'https://auth.atmosud.org');
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_REALM', 'master');
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_CLIENT_ID', 'openairmap');
    expect(isKeycloakAuthEnabled()).toBe(false);
  });

  it('active Keycloak seulement si flag + config complets', () => {
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_URL', 'https://auth.atmosud.org');
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_REALM', 'master');
    vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_CLIENT_ID', 'openairmap');
    expect(isKeycloakAuthEnabled()).toBe(true);
  });
});
