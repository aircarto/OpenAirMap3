import { cookies, headers } from 'next/headers';
import {
  getHostnameFromHostHeader,
  resolveDomainConfig,
} from './domain';
import type { DomainConfig } from '../config/domainConfig';
import { DOMAIN_CONFIG } from '../config/domainConfig';

/** Doit rester aligné avec middleware.ts */
export const OAM_HOST_COOKIE = 'oam-host';

const readHostFromHeaders = async (): Promise<string | null> => {
  try {
    const h = await headers();
    if (!h || typeof h.get !== 'function') return null;
    return (
      h.get('x-openairmap-host') ??
      h.get('x-forwarded-host') ??
      h.get('host')
    );
  } catch {
    return null;
  }
};

const readHostFromCookie = async (): Promise<string | null> => {
  try {
    const jar = await cookies();
    return jar.get(OAM_HOST_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
};

/**
 * Config domaine côté serveur.
 * Préfère le header Host, sinon le cookie posé par le middleware.
 */
export const getServerDomainConfig = async (): Promise<{
  hostname: string;
  domainConfig: DomainConfig;
  origin: string;
}> => {
  // Le cookie middleware est la source de vérité multi-domaine en standalone
  // (headers() peut renvoyer l'adresse de socket plutôt que le Host virtuel).
  const fromCookie = await readHostFromCookie();
  const fromHeader = fromCookie ? null : await readHostFromHeaders();
  const hostHeader = fromCookie ?? fromHeader;

  if (!hostHeader) {
    return {
      hostname: 'localhost',
      domainConfig: DOMAIN_CONFIG.default,
      origin: 'http://localhost:3000',
    };
  }

  const hostname = getHostnameFromHostHeader(hostHeader);
  const isLocal =
    hostname === 'localhost' || hostname.startsWith('127.');
  const origin = isLocal
    ? `http://${hostHeader.includes(':') ? hostHeader : `${hostname}:3000`}`
    : `https://${hostname}`;

  return {
    hostname,
    domainConfig: resolveDomainConfig(hostname),
    origin,
  };
};
