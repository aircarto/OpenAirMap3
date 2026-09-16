import {
  DOMAIN_CONFIG,
  DomainConfig,
  getConfigForDomain,
} from '../config/domainConfig';
import { readEnv } from '../lib/env';

/**
 * Résout la config d'instance à partir du hostname HTTP,
 * avec surcharge optionnelle NEXT_PUBLIC_FORCE_DOMAIN_CONFIG
 * (ex. "atmosud" ou "default") pour le local / la preprod.
 */
export const resolveDomainConfig = (hostname: string): DomainConfig => {
  const forced = readEnv('NEXT_PUBLIC_FORCE_DOMAIN_CONFIG')?.trim();
  if (forced) {
    if (DOMAIN_CONFIG[forced]) {
      return DOMAIN_CONFIG[forced];
    }
    // Accepte aussi un hostname forcé
    return getConfigForDomain(forced);
  }
  return getConfigForDomain(hostname);
};

export const getHostnameFromHostHeader = (hostHeader: string): string => {
  // host peut être "example.org:443"
  return hostHeader.split(':')[0]?.toLowerCase() ?? 'localhost';
};

export const isAtmoSudOperator = (hostname: string): boolean =>
  hostname.endsWith('.atmosud.org') || hostname === 'atmosud.org';
