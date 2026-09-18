import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  airCrowdEndToMapInstantStart,
  buildAirCrowdLayerName,
  formatAirCrowdWmsHour,
  getAirCrowdWmsLegendTitle,
  getAirCrowdWmsUrl,
  isAirCrowdWmsPollutantSupported,
  mapInstantStartToAirCrowdEnd,
  parseAirCrowdWmsAvailability,
  pickNearestAvailableAirCrowdHour,
} from '../AirCrowdWmsLayerService';

describe('AirCrowdWmsLayerService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('construit le nom de layer (début TimeBar → fin GeoServer)', () => {
    // Créneau 10h–11h → suffixe 11h
    expect(buildAirCrowdLayerName('pm10', '2026-09-02', 10)).toBe(
      'aircrowd:aircrowd_pm10_2026_09_02_11h'
    );
    // Créneau 23h–00h → lendemain 00h
    expect(buildAirCrowdLayerName('pm25', '2026-09-02', 23)).toBe(
      'aircrowd:aircrowd_pm25_2026_09_03_00h'
    );
  });

  it('convertit début TimeBar ↔ fin layer', () => {
    expect(mapInstantStartToAirCrowdEnd('2026-09-18', 14)).toEqual({
      dateIso: '2026-09-18',
      endHour: 15,
    });
    expect(airCrowdEndToMapInstantStart('2026-09-18', 15)).toEqual({
      dateIso: '2026-09-18',
      startHour: 14,
    });
  });

  it('formate un titre de légende lisible', () => {
    expect(getAirCrowdWmsLegendTitle('pm25', '2026-09-18', 14)).toBe(
      'Cartographie AirCrowd\nPM₂.₅ · 18/09 · 14h–15h'
    );
  });

  it('ne supporte que pm10/pm25 en PoC', () => {
    expect(isAirCrowdWmsPollutantSupported('pm25')).toBe(true);
    expect(isAirCrowdWmsPollutantSupported('no2')).toBe(false);
  });

  it('parse GetCapabilities vers un calendrier', () => {
    const xml = `
      <Capability>
        <Layer><Name>aircrowd:aircrowd_pm25_2026_09_02_11h</Name></Layer>
        <Layer><Name>aircrowd_pm25_2026_09_02_12h</Name></Layer>
        <Layer><Name>other:ignored</Name></Layer>
      </Capability>
    `;
    const availability = parseAirCrowdWmsAvailability(xml);
    expect(availability.minDate).toBe('2026-09-02');
    expect(availability.maxDate).toBe('2026-09-02');
    expect(availability.byPollutant.pm25['2026-09-02']).toEqual([11, 12]);
  });

  it('choisit l’heure publiée la plus proche', () => {
    expect(pickNearestAvailableAirCrowdHour([11, 12, 15], 13)).toBe(12);
    expect(pickNearestAvailableAirCrowdHour([], 11)).toBeNull();
  });

  it('honore NEXT_PUBLIC_AIRCROWD_WMS_URL / VITE_AIRCROWD_WMS_URL absolue', () => {
    vi.stubEnv(
      'VITE_AIRCROWD_WMS_URL',
      'https://preprod-geoservices.atmosud.org/aircrowd/wms'
    );
    expect(getAirCrowdWmsUrl()).toBe(
      'https://preprod-geoservices.atmosud.org/aircrowd/wms'
    );
  });

  it('utilise le proxy same-origin par défaut', () => {
    expect(getAirCrowdWmsUrl()).toMatch(/\/aircrowd-wms\/wms$/);
  });
});
