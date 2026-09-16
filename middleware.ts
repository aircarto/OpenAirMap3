import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import {
  SHARED_AUTH_COOKIE,
  detectLocaleFromPathname,
  getSharedAuthCredentials,
  isSharedAuthEnabled,
  isSharedAuthPublicPath,
  sharedAuthLoginPath,
  verifySharedAuthToken,
} from './src/lib/sharedAuth';

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
 * Auth partagée optionnelle (SHARED_AUTH_ENABLED) via cookie signé.
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSharedAuthEnabled() && !isSharedAuthPublicPath(pathname)) {
    const token = request.cookies.get(SHARED_AUTH_COOKIE)?.value;
    const { secret } = getSharedAuthCredentials();
    const valid = await verifySharedAuthToken(token, secret);

    if (!valid) {
      const locale = detectLocaleFromPathname(pathname);
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = sharedAuthLoginPath(locale);
      loginUrl.search = '';
      loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return attachHostCookie(request, NextResponse.redirect(loginUrl));
    }
  }

  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return attachHostCookie(request, NextResponse.next());
  }

  // API auth : ne pas passer par next-intl
  if (pathname.startsWith('/api/')) {
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
    '/api/:path*',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
