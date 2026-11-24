import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MicrospotAuthError,
  MicrospotCampaignClient,
  MicrospotHttpError,
} from '../MicrospotCampaignClient';
import { setAccessToken } from '../../../auth/tokenStore';

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('MicrospotCampaignClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_MICROSPOT_API_URL', '/microspot');
    vi.stubGlobal('fetch', vi.fn());
    setAccessToken('token-1');
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refuse d’appeler sans session', async () => {
    setAccessToken(null);
    await expect(MicrospotCampaignClient.listCampaigns()).rejects.toBeInstanceOf(MicrospotAuthError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('relit le Bearer à chaque requête (renew pendant une extraction)', async () => {
    vi.mocked(fetch).mockImplementation(async () => json([]));
    await MicrospotCampaignClient.listCampaigns();
    setAccessToken('token-2');
    await MicrospotCampaignClient.listCampaigns();
    const auth = vi
      .mocked(fetch)
      .mock.calls.map(([, init]) => new Headers(init?.headers).get('Authorization'));
    expect(auth).toEqual(['Bearer token-1', 'Bearer token-2']);
  });

  it('demande les campagnes non exposées avec leurs capteurs', async () => {
    vi.mocked(fetch).mockResolvedValue(json([]));
    await MicrospotCampaignClient.listCampaigns();
    const url = new URL(String(vi.mocked(fetch).mock.calls[0]![0]), 'http://x');
    expect(url.pathname).toBe('/microspot/lists/campaigns');
    expect(url.searchParams.get('list_devices')).toBe('true');
    expect(url.searchParams.get('include_non_exposed')).toBe('true');
  });

  it('traite un 204 comme une liste vide', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const result = await MicrospotCampaignClient.fetchObservationsChunk({
      campaignId: 1,
      deviceId: 'd',
      variables: ['39'],
      from: new Date('2025-01-01T00:00:00Z'),
      to: new Date('2025-01-02T00:00:00Z'),
    });
    expect(result).toEqual({ rows: [], truncated: false });
  });

  it('envoie les paramètres d’extraction et lit X-Truncated', async () => {
    vi.mocked(fetch).mockResolvedValue(json([{ id: 'd' }], { 'X-Truncated': 'true' }));
    const result = await MicrospotCampaignClient.fetchObservationsChunk({
      campaignId: 48,
      deviceId: '2451381',
      variables: ['39', '24'],
      from: new Date('2025-01-01T00:00:00Z'),
      to: new Date('2025-07-01T00:00:00Z'),
    });
    expect(result.truncated).toBe(true);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0]![0]), 'http://x');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      aggregation: 'hourly',
      campaign_id: '48',
      device_id: '2451381',
      variable: '39,24',
      from_date_time: '2025-01-01T00:00:00Z',
      date_time: '2025-07-01T00:00:00Z',
      include: 'raw_value,corrections_detail,manually_validated,device_model',
      limit: '500000',
      invalid: 'true',
      include_non_exposed: 'true',
    });
    expect(url.searchParams.has('gapfill')).toBe(false);
  });

  it('remonte un 401 en erreur d’auth, sans repli public', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 401 }));
    await expect(MicrospotCampaignClient.listStudies()).rejects.toBeInstanceOf(MicrospotAuthError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('marque les 504 comme relançables', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 504, statusText: 'Gateway Timeout' }));
    const error = await MicrospotCampaignClient.listStatusCodes().catch((e) => e);
    expect(error).toBeInstanceOf(MicrospotHttpError);
    expect((error as MicrospotHttpError).retryable).toBe(true);
  });

  it('demande l’historique des positions des capteurs (sites citoyens compris)', async () => {
    vi.mocked(fetch).mockResolvedValue(json([{ id: 'd1', name: 'Neb-1', locations_history: [] }]));
    const devices = await MicrospotCampaignClient.listDeviceLocationHistories();
    expect(devices.map((d) => d.id)).toEqual(['d1']);
    const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string, 'http://x');
    expect(url.pathname).toMatch(/\/lists\/devices$/);
    expect(url.searchParams.get('locations_history')).toBe('true');
    expect(url.searchParams.get('include_non_exposed')).toBe('true');
  });
});
