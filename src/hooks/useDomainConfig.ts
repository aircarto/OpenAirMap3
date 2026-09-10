import { useState } from 'react';
import { getConfigForDomain, DomainConfig } from '../config/domainConfig';

const resolveDomainHostname = (): string => {
  const forcedDomain = import.meta.env.VITE_FORCE_DOMAIN_CONFIG?.trim();
  return forcedDomain || window.location.hostname;
};

export const useDomainConfig = (): DomainConfig => {
  const [config] = useState<DomainConfig>(() =>
    getConfigForDomain(resolveDomainHostname())
  );

  return config;
};
