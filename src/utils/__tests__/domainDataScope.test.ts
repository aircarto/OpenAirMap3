import { describe, expect, it } from 'vitest';
import { DOMAIN_CONFIG } from '../../config/domainConfig';
import {
  domainShowsCommunitySources,
  domainShowsSignalAir,
  getDefaultPollutantForDomain,
  getDefaultSourcesForDomain,
  getDefaultTimeStepForDomain,
  getAvailableTimeStepsForDomain,
  isPollutantAllowedForDomain,
  isSourceAllowedForDomain,
} from '../domainDataScope';

describe('domainDataScope AirCrowd', () => {
  const aircrowd = DOMAIN_CONFIG['aircrowd.atmosud.org'];

  it('restreint sources / polluants / pas de temps', () => {
    expect(getDefaultSourcesForDomain(aircrowd)).toEqual([
      'atmoRef',
      'atmoMicro',
    ]);
    expect(getDefaultPollutantForDomain(aircrowd)).toBe('pm25');
    expect(getDefaultTimeStepForDomain(aircrowd)).toBe('heure');
    expect(getAvailableTimeStepsForDomain(aircrowd)).toEqual(['heure']);
    expect(isPollutantAllowedForDomain('pm10', aircrowd)).toBe(true);
    expect(isPollutantAllowedForDomain('no2', aircrowd)).toBe(false);
    expect(isSourceAllowedForDomain('communautaire.nebuleair', aircrowd)).toBe(
      false
    );
    expect(domainShowsCommunitySources(aircrowd)).toBe(false);
    expect(domainShowsSignalAir(aircrowd)).toBe(false);
  });

  it('laisse atmosud ouvert (catalogue complet)', () => {
    const atmosud = DOMAIN_CONFIG.atmosud;
    expect(getDefaultSourcesForDomain(atmosud)).toEqual([
      'atmoRef',
      'atmoMicro',
      'communautaire.nebuleair',
    ]);
    expect(isPollutantAllowedForDomain('no2', atmosud)).toBe(true);
    expect(domainShowsCommunitySources(atmosud)).toBe(true);
    expect(domainShowsSignalAir(atmosud)).toBe(true);
  });
});
