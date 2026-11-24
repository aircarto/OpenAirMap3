import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetBanCache, formatBanAddress, isInFrance, reverseGeocode } from '../banReverse';

describe('formatBanAddress', () => {
  it('compose « voie, code postal ville »', () => {
    expect(
      formatBanAddress({ properties: { name: 'Quai de la Fraternité', postcode: '13001', city: 'Marseille', distance: 23 } })
    ).toBe('Quai de la Fraternité, 13001 Marseille');
  });

  it('écarte une adresse trop lointaine', () => {
    expect(formatBanAddress({ properties: { name: 'Route', postcode: '04000', city: 'Digne', distance: 850 } })).toBeNull();
  });
});

describe('reverseGeocode', () => {
  beforeEach(() => {
    __resetBanCache();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('n’interroge pas la BAN hors de France (ex. Livourne)', async () => {
    expect(isInFrance(43.57, 10.31)).toBe(false);
    expect(await reverseGeocode(43.57, 10.31)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('interroge la Géoplateforme une seule fois par position', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ features: [{ properties: { name: '1 Rue A', postcode: '84000', city: 'Avignon', distance: 12 } }] }),
        { status: 200 }
      )
    );
    expect(await reverseGeocode(43.9, 4.8)).toBe('1 Rue A, 84000 Avignon');
    expect(await reverseGeocode(43.9, 4.8)).toBe('1 Rue A, 84000 Avignon');
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://data.geopf.fr/geocodage/reverse');
    expect(url.searchParams.get('index')).toBe('address');
  });

  it('ne met pas une erreur réseau en cache', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(
      new Response(JSON.stringify({ features: [] }), { status: 200 })
    );
    expect(await reverseGeocode(43.5, 5.5)).toBeNull();
    await Promise.resolve();
    expect(await reverseGeocode(43.5, 5.5)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
