import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildAirCrowdLayerName,
  formatAirCrowdWmsHour,
  getAirCrowdWmsUrl,
  isAirCrowdWmsPollutantSupported,
  parseAirCrowdWmsAvailability,
  pickNearestAvailableAirCrowdHour,
} from '../AirCrowdWmsLayerService';

describe('AirCrowdWmsLayerService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('construit le nom de layer attendu', () => {
    expect(buildAirCrowdLayerName('pm10', '2026-09-02', 11)).toBe(
      'aircrowd:aircrowd_pm10_2026_09_02_11h'
    );
  });

  it('pad l’heure sur 2 chiffres', () => {
    expect(formatAirCrowdWmsHour(9)).toBe('09h');
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

  it('honore VITE_AIRCROWD_WMS_URL absolue', () => {
    vi.stubEnv(
      'VITE_AIRCROWD_WMS_URL',
      'https://preprod-geoservices.atmosud.org/aircrowd/wms'
    );
    expect(getAirCrowdWmsUrl()).toBe(
      'https://preprod-geoservices.atmosud.org/aircrowd/wms'
    );
  });
});
