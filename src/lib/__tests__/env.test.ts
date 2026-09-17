import { afterEach, describe, expect, it, vi } from 'vitest';

describe('readEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('lit NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER via accès littéral (carte publicEnv)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER', 'false');
    const { readEnv } = await import('../env');
    expect(readEnv('NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER')).toBe('false');
  });

  it('accepte l’alias VITE_ENABLE_WILDFIRE_LAYER', async () => {
    vi.stubEnv('VITE_ENABLE_WILDFIRE_LAYER', 'false');
    const { readEnv } = await import('../env');
    expect(readEnv('NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER')).toBe('false');
  });

  it('lit les variables serveur hors carte publicEnv', async () => {
    vi.stubEnv('NOINDEX', 'true');
    const { readEnv, isNoIndexEnabled } = await import('../env');
    expect(readEnv('NOINDEX')).toBe('true');
    expect(isNoIndexEnabled()).toBe(true);
  });
});
