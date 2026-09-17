import type { DomainConfig } from '../config/domainConfig';
import { getDefaultSources, sources } from '../constants/sources';
import { getDefaultPollutant, pollutants } from '../constants/pollutants';
import {
  getAvailableTimeSteps,
  type TimeStepCode,
} from '../constants/timeSteps';

/** Source autorisée pour l’instance (codes top-level ou `groupe.sous`). */
export const isSourceAllowedForDomain = (
  sourceCode: string,
  config: DomainConfig
): boolean => {
  const allowed = config.allowedSources;
  if (!allowed || allowed.length === 0) return true;
  if (allowed.includes(sourceCode)) return true;
  const topLevel = sourceCode.split('.')[0];
  return Boolean(topLevel && allowed.includes(topLevel));
};

export const getDefaultSourcesForDomain = (config: DomainConfig): string[] => {
  const defaults = getDefaultSources().filter((code) =>
    isSourceAllowedForDomain(code, config)
  );
  if (defaults.length > 0) return defaults;

  // Repli : premières sources autorisées non-groupe
  const allowed = config.allowedSources ?? [];
  return allowed.filter((code) => {
    const source = sources[code];
    return source && !source.isGroup;
  });
};

export const isPollutantAllowedForDomain = (
  pollutantCode: string,
  config: DomainConfig
): boolean => {
  const allowed = config.allowedPollutants;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(pollutantCode);
};

export const getDefaultPollutantForDomain = (config: DomainConfig): string => {
  const globalDefault = getDefaultPollutant();
  if (isPollutantAllowedForDomain(globalDefault, config)) {
    return globalDefault;
  }
  const allowed = config.allowedPollutants ?? Object.keys(pollutants);
  return allowed[0] ?? globalDefault;
};

export const getAvailableTimeStepsForDomain = (
  config: DomainConfig
): TimeStepCode[] => {
  const activated = getAvailableTimeSteps();
  const allowed = config.allowedTimeSteps;
  if (!allowed || allowed.length === 0) return activated;
  const filtered = activated.filter((code) => allowed.includes(code));
  return filtered.length > 0 ? filtered : activated;
};

export const isTimeStepAllowedForDomain = (
  timeStep: string,
  config: DomainConfig
): boolean => getAvailableTimeStepsForDomain(config).includes(timeStep as TimeStepCode);

export const getDefaultTimeStepForDomain = (config: DomainConfig): string =>
  getAvailableTimeStepsForDomain(config)[0] ?? 'heure';

/** Menu sources : afficher le bloc communautaire. */
export const domainShowsCommunitySources = (config: DomainConfig): boolean => {
  if (!config.allowedSources || config.allowedSources.length === 0) return true;
  return config.allowedSources.some(
    (code) => code === 'communautaire' || code.startsWith('communautaire.')
  );
};

/** Menu sources : afficher SignalAir. */
export const domainShowsSignalAir = (config: DomainConfig): boolean => {
  if (!config.allowedSources || config.allowedSources.length === 0) return true;
  return config.allowedSources.includes('signalair');
};
