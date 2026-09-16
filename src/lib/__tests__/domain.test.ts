import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOMAIN_CONFIG } from '../../config/domainConfig';
import { resolveDomainConfig } from '../domain';

describe('resolveDomainConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('utilise le hostname sans force', () => {
    expect(resolveDomainConfig('openairmap.atmosud.org')).toBe(
      DOMAIN_CONFIG.atmosud
    );
    expect(resolveDomainConfig('openairmap.fr')).toBe(DOMAIN_CONFIG.default);
  });

  it('honore NEXT_PUBLIC_FORCE_DOMAIN_CONFIG', () => {
    vi.stubEnv('NEXT_PUBLIC_FORCE_DOMAIN_CONFIG', 'atmosud');
    expect(resolveDomainConfig('localhost')).toBe(DOMAIN_CONFIG.atmosud);
  });
});
