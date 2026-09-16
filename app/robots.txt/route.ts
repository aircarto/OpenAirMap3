import { NextRequest } from 'next/server';
import { isNoIndexEnabled } from '@/lib/env';
import { getHostnameFromHostHeader, resolveDomainConfig } from '@/lib/domain';

export const dynamic = 'force-dynamic';

const originFromRequest = (request: NextRequest): string => {
  const hostHeader =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    'localhost:3000';
  const hostname = getHostnameFromHostHeader(hostHeader);
  const proto =
    hostname === 'localhost' || hostname.startsWith('127.')
      ? 'http'
      : (request.headers.get('x-forwarded-proto') ?? 'https');
  return hostname === 'localhost' || hostname.startsWith('127.')
    ? `http://${hostHeader}`
    : `${proto}://${hostname}`;
};

export function GET(request: NextRequest) {
  // Touche domainConfig pour garder le même chemin de résolution Host
  resolveDomainConfig(
    getHostnameFromHostHeader(
      request.headers.get('x-forwarded-host') ??
        request.headers.get('host') ??
        'localhost'
    )
  );

  if (isNoIndexEnabled()) {
    return new Response('User-Agent: *\nDisallow: /\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const origin = originFromRequest(request);
  const body = `User-Agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
