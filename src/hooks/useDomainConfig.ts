import { useState } from "react";
import { getConfigForDomain, DomainConfig } from "../config/domainConfig";

export const useDomainConfig = (): DomainConfig => {
  const [config] = useState<DomainConfig>(() =>
    getConfigForDomain(window.location.hostname)
  );

  return config;
};
