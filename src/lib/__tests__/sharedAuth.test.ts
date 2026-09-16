import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSharedAuthToken,
  credentialsMatch,
  detectLocaleFromPathname,
  isSharedAuthEnabled,
  isSharedAuthPublicPath,
  sharedAuthLoginPath,
  timingSafeEqualString,
  verifySharedAuthToken,
} from '../sharedAuth';

describe('sharedAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isSharedAuthEnabled est false par défaut', () => {
    expect(isSharedAuthEnabled()).toBe(false);
  });

  it('isSharedAuthEnabled lit SHARED_AUTH_ENABLED', () => {
    vi.stubEnv('SHARED_AUTH_ENABLED', 'true');
    expect(isSharedAuthEnabled()).toBe(true);
  });

  it('crée et vérifie un jeton signé', async () => {
    const secret = 'test-secret-value';
    const token = await createSharedAuthToken(secret, 3600);
    expect(await verifySharedAuthToken(token, secret)).toBe(true);
    expect(await verifySharedAuthToken(token, 'wrong-secret')).toBe(false);
    expect(await verifySharedAuthToken('bad.token', secret)).toBe(false);
  });

  it('rejette un jeton expiré', async () => {
    const secret = 'test-secret-value';
    const token = await createSharedAuthToken(secret, -10);
    expect(await verifySharedAuthToken(token, secret)).toBe(false);
  });

  it('credentialsMatch compare user et password', () => {
    const expected = {
      user: 'aircrowd',
      password: 's3cret',
      secret: 'hmac',
    };
    expect(credentialsMatch('aircrowd', 's3cret', expected)).toBe(true);
    expect(credentialsMatch('aircrowd ', 's3cret', expected)).toBe(true);
    expect(credentialsMatch('aircrowd', 'wrong', expected)).toBe(false);
    expect(credentialsMatch('other', 's3cret', expected)).toBe(false);
  });

  it('timingSafeEqualString', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'ab')).toBe(false);
  });

  it('isSharedAuthPublicPath autorise login et API auth', () => {
    expect(isSharedAuthPublicPath('/connexion')).toBe(true);
    expect(isSharedAuthPublicPath('/en/login')).toBe(true);
    expect(isSharedAuthPublicPath('/api/auth/login')).toBe(true);
    expect(isSharedAuthPublicPath('/robots.txt')).toBe(true);
    expect(
      isSharedAuthPublicPath('/feuxdeforet/fdf/cartographie/geojson')
    ).toBe(true);
    expect(isSharedAuthPublicPath('/aircarto/capteurs/metadata')).toBe(true);
    expect(isSharedAuthPublicPath('/')).toBe(false);
    expect(isSharedAuthPublicPath('/a-propos')).toBe(false);
  });

  it('sharedAuthLoginPath et detectLocaleFromPathname', () => {
    expect(sharedAuthLoginPath('fr')).toBe('/connexion');
    expect(sharedAuthLoginPath('en')).toBe('/en/login');
    expect(detectLocaleFromPathname('/en/about')).toBe('en');
    expect(detectLocaleFromPathname('/a-propos')).toBe('fr');
  });
});
