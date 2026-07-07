import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MicrospotService } from '../MicrospotService';
import { pollutants } from '../../constants/pollutants';

const baseParams = {
  pollutant: 'pm25',
  timeStep: 'quartHeure',
  sources: ['atmoMicro'],
};

const buildLocation = (overrides = {}) => ({
  id: '40',
  name: 'Marseille Longchamps',
  typology: 'Urbaine',
  influence: 'Trafic',
  lat: 43.305287,
  lon: 5.394716,
  alt: null,
  start_date: '2025-01-01T00:00:00Z',
  end_date: null,
  ...overrides,
});

const buildDevice = (overrides = {}) => ({
  id: '112233445566',
  name: 'Capteur Quartier',
  brand: 'AirCarto',
  model: 'ModuleAir',
  aggregations: ['PM2.5: 600', 'PM10: 600'],
  actual_location: 'Marseille Longchamps',
  actual_location_id: '40',
  ...overrides,
});

const buildObservation = (overrides = {}) => ({
  id: '112233445566',
  name: 'Capteur Quartier',
  location_id: '40',
  location_name: 'Marseille Longchamps',
  variable_id: '39',
  variable_label: 'PM 2.5',
  lat: 43.297,
  lon: 5.3701,
  time: '2025-02-15T10:15:00Z',
  unit: 'µg/m³',
  value: 10.5,
  value_raw: 14.2,
  value_ref: 12.1,
  status_code: 'O',
  ...overrides,
});

const mockRequests = (
  service: MicrospotService,
  handlers: {
    devices?: unknown;
    latest?: unknown;
    locations?: unknown;
    historical?: unknown;
  }
) => {
  return vi.spyOn(service as any, 'makeRequest').mockImplementation((url: string) => {
    if (url.includes('/lists/devices')) {
      if (handlers.devices instanceof Error) {
        return Promise.reject(handlers.devices);
      }
      return Promise.resolve(handlers.devices ?? []);
    }
    if (url.includes('/observations/latest')) {
      if (handlers.latest instanceof Error) {
        return Promise.reject(handlers.latest);
      }
      return Promise.resolve(handlers.latest ?? []);
    }
    if (url.includes('/observations/')) {
      if (handlers.historical instanceof Error) {
        return Promise.reject(handlers.historical);
      }
      return Promise.resolve(handlers.historical ?? []);
    }
    if (url.includes('/lists/locations')) {
      return Promise.resolve(handlers.locations ?? []);
    }
    return Promise.resolve([]);
  });
};

describe('MicrospotService', () => {
  let service: MicrospotService;

  beforeEach(() => {
    (MicrospotService as any).devicesByVariableCache = new Map();
    (MicrospotService as any).devicesByVariableFetchPromises = new Map();
    (MicrospotService as any).deviceByIdCache = new Map();
    (MicrospotService as any).siteVariablesCache = new Map();
    (MicrospotService as any).locationsCache = null;
    (MicrospotService as any).lastLocationsFetch = 0;
    (MicrospotService as any).locationsFetchPromise = null;
    (MicrospotService as any).stagingLogEmitted = false;
    service = new MicrospotService();
  });

  it('retourne un tableau vide pour un polluant non supporté', async () => {
    const makeRequestSpy = vi.spyOn(service as any, 'makeRequest');

    const result = await service.fetchData({
      ...baseParams,
      pollutant: 'h2s',
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it('retourne un tableau vide pour un pas de temps non supporté', async () => {
    const makeRequestSpy = vi.spyOn(service as any, 'makeRequest');

    const result = await service.fetchData({
      ...baseParams,
      timeStep: 'jour',
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it('transforme devices et observations en appareils de mesure enrichis', async () => {
    const makeRequestSpy = mockRequests(service, {
      devices: [buildDevice()],
      latest: [buildObservation()],
      locations: [buildLocation()],
    });

    const result = await service.fetchData(baseParams);

    expect(makeRequestSpy).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1);

    const device = result[0];
    expect(device).toMatchObject({
      id: '112233445566',
      name: 'Capteur Quartier',
      latitude: 43.297,
      longitude: 5.3701,
      source: 'atmoMicro',
      pollutant: 'pm25',
      value: 12.1,
      unit: 'µg/m³',
      status: 'active',
      address: 'Capteur Quartier, Trafic',
      departmentId: '',
      has_correction: true,
      corrected_value: 10.5,
      raw_value: 14.2,
    });
    expect(device).toHaveProperty('qualityLevel', 'moyen');
    expect(service.isMeasuresUnavailableIncident()).toBe(false);

    const urls = makeRequestSpy.mock.calls.map(([url]) => url as string);
    const deviceUrl = urls.find((url) => url.includes('/lists/devices'));
    expect(deviceUrl).toContain('variable=39');
    expect(deviceUrl).not.toContain('active=');

    const latestUrl = urls.find((url) => url.includes('/observations/latest'));
    expect(latestUrl).toContain('include=raw_value%2Cmetadata');
    expect(latestUrl).toContain('decimals=1');
  });

  it("ajoute un device inactif lorsque le capteur n'a pas de mesure", async () => {
    mockRequests(service, {
      devices: [
        buildDevice(),
        buildDevice({
          id: 'AABBCCDDEEFF',
          name: 'Site Sans Mesure',
          actual_location_id: '41',
        }),
      ],
      latest: [buildObservation()],
      locations: [
        buildLocation(),
        buildLocation({
          id: '41',
          name: 'Autre lieu',
          lat: 43.31,
          lon: 5.4,
        }),
      ],
    });

    const result = await service.fetchData(baseParams);

    const inactiveDevice = result.find((device) => device.id === 'AABBCCDDEEFF');
    expect(inactiveDevice).toBeTruthy();
    expect(inactiveDevice).toMatchObject({
      id: 'AABBCCDDEEFF',
      name: 'Site Sans Mesure',
      status: 'inactive',
      value: 0,
      qualityLevel: 'default',
    });
  });

  it('garde les devices en inactif et active l incident quand observations/latest renvoie 204 (null)', async () => {
    mockRequests(service, {
      devices: [buildDevice()],
      latest: null,
      locations: [buildLocation()],
    });

    const result = await service.fetchData(baseParams);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '112233445566',
      status: 'inactive',
      value: 0,
      qualityLevel: 'default',
    });
    expect(service.isMeasuresUnavailableIncident()).toBe(true);
  });

  it('garde les devices en inactif et active l incident quand observations/latest renvoie un tableau vide', async () => {
    mockRequests(service, {
      devices: [buildDevice()],
      latest: [],
      locations: [buildLocation()],
    });

    const result = await service.fetchData(baseParams);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '112233445566',
      status: 'inactive',
      value: 0,
      qualityLevel: 'default',
    });
    expect(service.isMeasuresUnavailableIncident()).toBe(true);
  });

  it('garde les devices en inactif si observations/latest echoue (ex: erreur HTTP)', async () => {
    mockRequests(service, {
      devices: [buildDevice()],
      latest: new Error('HTTP error! status: 503'),
      locations: [buildLocation()],
    });

    const result = await service.fetchData(baseParams);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '112233445566',
      status: 'inactive',
      value: 0,
      qualityLevel: 'default',
    });
    expect(service.isMeasuresUnavailableIncident()).toBe(true);
  });

  it('recupere les donnees historiques via observations/ pour un capteur', async () => {
    const historical = [
      buildObservation({
        time: '2025-02-15T09:00:00Z',
        value: 8.2,
        value_raw: 9.1,
        value_ref: 8.2,
      }),
      buildObservation({
        time: '2025-02-15T10:00:00Z',
        value: 10.5,
        value_raw: 14.2,
        value_ref: 12.1,
      }),
    ];

    const makeRequestSpy = mockRequests(service, {
      historical,
    });

    const result = await service.fetchHistoricalData({
      siteId: '112233445566',
      pollutant: 'pm25',
      timeStep: 'heure',
      startDate: '2025-02-15',
      endDate: '2025-02-15',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      timestamp: '2025-02-15T09:00:00Z',
      value: 8.2,
      unit: 'µg/m³',
      has_correction: true,
      corrected_value: 8.2,
      raw_value: 9.1,
    });
    expect(result[1]).toMatchObject({
      timestamp: '2025-02-15T10:00:00Z',
      value: 10.5,
      has_correction: true,
    });

    const historicalUrl = makeRequestSpy.mock.calls
      .map(([url]) => url as string)
      .find((url) => url.includes('/observations/') && !url.includes('/latest'));
    expect(historicalUrl).toContain('device_id=112233445566');
    expect(historicalUrl).toContain('variable=39');
    expect(historicalUrl).toContain('aggregation=hourly');
    expect(historicalUrl).toContain('include=raw_value');
    expect(historicalUrl).toContain('decimals=1');
  });

  it('retourne un tableau vide pour un pas de temps historique non supporte', async () => {
    const makeRequestSpy = vi.spyOn(service as any, 'makeRequest');

    const result = await service.fetchHistoricalData({
      siteId: '112233445566',
      pollutant: 'pm25',
      timeStep: 'invalid',
      startDate: '2025-02-15',
      endDate: '2025-02-15',
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it('resout les variables via metadata quand aggregations est vide', async () => {
    const makeRequestSpy = mockRequests(service, {
      devices: [
        buildDevice({
          aggregations: [],
        }),
      ],
      latest: [
        buildObservation({
          device_variables: [
            {
              variable_id: '39',
              variable_label: 'PM 2.5',
              last_measurement_at: '2025-02-15T10:00:01',
            },
            {
              variable_id: '24',
              variable_label: 'PM 10',
              last_measurement_at: '2025-02-15T10:00:01',
            },
          ],
        }),
      ],
    });

    const result = await service.fetchSiteVariables('112233445566');

    expect(result.variables).toMatchObject({
      pm25: {
        label: pollutants.pm25.name,
        code_iso: '39',
        en_service: true,
      },
      pm10: {
        label: pollutants.pm10.name,
        code_iso: '24',
        en_service: true,
      },
    });

    const latestUrl = makeRequestSpy.mock.calls
      .map(([url]) => url as string)
      .find((url) => url.includes('/observations/latest'));
    expect(latestUrl).toContain('device_id=112233445566');
    expect(latestUrl).toContain('include=metadata');
  });
});
