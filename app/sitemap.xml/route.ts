import { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { isNoIndexEnabled } from '@/lib/env';
import { getHostnameFromHostHeader } from '@/lib/domain';
import { localizedPath } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const PATHS = ['/', '/a-propos', '/mentions-legales'] as const;

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
  if (isNoIndexEnabled()) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
    );
  }

  const origin = originFromRequest(request);
  const urls: string[] = [];

  for (const pathname of PATHS) {
    for (const locale of routing.locales) {
      urls.push(`${origin}${localizedPath(locale, pathname)}`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
