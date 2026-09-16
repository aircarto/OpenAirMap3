import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export const OAM_HOST_COOKIE = 'oam-host';

const attachHostCookie = (request: NextRequest, response: NextResponse) => {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    '';
  const hostname = host.split(':')[0]?.toLowerCase() ?? 'localhost';

  response.cookies.set(OAM_HOST_COOKIE, hostname, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
  });

  return response;
};

/**
 * next-intl pour les pages ; robots/sitemap hors i18n mais avec cookie Host.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return attachHostCookie(request, NextResponse.next());
  }

  return attachHostCookie(request, intlMiddleware(request));
}

export const config = {
  matcher: [
    '/',
    '/(fr|en|es|it|de|ar)/:path*',
    '/robots.txt',
    '/sitemap.xml',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
