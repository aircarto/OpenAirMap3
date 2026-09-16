'use client';

import { useState } from 'react';
import { DomainConfig } from '../config/domainConfig';
import { resolveDomainConfig } from '../lib/domain';

export const useDomainConfig = (): DomainConfig => {
  const [config] = useState<DomainConfig>(() =>
    resolveDomainConfig(
      typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    )
  );

  return config;
};
