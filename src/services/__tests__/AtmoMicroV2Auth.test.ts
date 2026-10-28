import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AtmoMicroV2Service } from '../AtmoMicroV2Service';
import { setAccessToken } from '../../auth/tokenStore';

const MICROSPOT_BASE = '/microspot';

describe('AtmoMicroV2Service auth', () => {
  beforeEach(() => {
    setAccessToken(null);
    AtmoMicroV2Service.resetCaches();
    vi.stubEnv('NEXT_PUBLIC_MICROSPOT_API_URL', MICROSPOT_BASE);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    AtmoMicroV2Service.resetCaches();
  });

  it('n’envoie pas de Bearer ni de params privilégiés sans session', async () => {
    const service = new AtmoMicroV2Service();
    await (
      service as unknown as { makeRequest: (url: string) => Promise<unknown> }
    ).makeRequest(`${MICROSPOT_BASE}/lists/devices`);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe(`${MICROSPOT_BASE}/lists/devices`);
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
  });

  it('ajoute Bearer + include_non_exposed sur /lists quand connecté', async () => {
    setAccessToken('tok-lists');
    const service = new AtmoMicroV2Service();
    await (
      service as unknown as { makeRequest: (url: string) => Promise<unknown> }
    ).makeRequest(`${MICROSPOT_BASE}/lists/devices`);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('include_non_exposed=true');
    expect(String(url)).not.toContain('invalid=');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer tok-lists'
    );
  });

  it('ajoute Bearer + invalid + include_non_exposed sur /observations', async () => {
    setAccessToken('tok-obs');
    const service = new AtmoMicroV2Service();
    await (
      service as unknown as { makeRequest: (url: string) => Promise<unknown> }
    ).makeRequest(`${MICROSPOT_BASE}/observations/latest?aggregation=hourly`);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    const href = String(url);
    expect(href).toContain('invalid=true');
    expect(href).toContain('include_non_exposed=true');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer tok-obs'
    );
  });

  it('ne touche pas les URLs hors microspot (QAQC AtmoRef)', async () => {
    setAccessToken('tok-qaqc');
    const service = new AtmoMicroV2Service();
    const atmoRefUrl =
      'https://api.atmosud.org/observations/stations?format=json&download=false&metadata=true';

    await (
      service as unknown as { makeRequest: (url: string) => Promise<unknown> }
    ).makeRequest(atmoRefUrl);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe(atmoRefUrl);
    expect(String(url)).not.toContain('invalid=');
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
  });
});
