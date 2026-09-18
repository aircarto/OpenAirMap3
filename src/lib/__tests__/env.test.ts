import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, isNoIndexEnabled, parseBooleanEnv } from '../env';

describe('env Next', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lit NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER et parse false', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER', 'false');
    expect(env.wildfireLayer).toBe('false');
    expect(parseBooleanEnv(env.wildfireLayer, true)).toBe(false);
  });

  it('lit NOINDEX côté serveur', () => {
    vi.stubEnv('NOINDEX', 'true');
    expect(env.noIndex).toBe('true');
    expect(isNoIndexEnabled()).toBe(true);
  });
});
