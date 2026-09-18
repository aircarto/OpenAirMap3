import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import { getConfigForDomain } from './src/config/domainConfig';
import { getHostnameFromHostHeader } from './src/lib/domain';
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

const LOCALE_PREFIX_RE = /^\/(en|es|it|de|ar|fr)(?=\/|$)/;

const resolveRequestHostname = (request: NextRequest): string => {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    '';
  return getHostnameFromHostHeader(host);
};

const attachHostCookie = (request: NextRequest, response: NextResponse) => {
  const hostname = resolveRequestHostname(request);

  response.cookies.set(OAM_HOST_COOKIE, hostname, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
  });

  return response;
};

const resolveAuthLocale = (pathname: string, hostname: string): string => {
  if (LOCALE_PREFIX_RE.test(pathname)) {
    return detectLocaleFromPathname(pathname);
  }
  return getConfigForDomain(hostname).defaultLocale ?? routing.defaultLocale;
};

/**
 * Si l’instance définit une locale par défaut ≠ fr (ex. AirCrowd → en),
 * redirige les URLs sans préfixe (et sans cookie NEXT_LOCALE) vers /{locale}.
 */
const maybeRedirectDomainDefaultLocale = (
  request: NextRequest
): NextResponse | null => {
  const hostname = resolveRequestHostname(request);
  const preferred = getConfigForDomain(hostname).defaultLocale;
  if (!preferred || preferred === routing.defaultLocale) {
    return null;
  }

  const { pathname } = request.nextUrl;
  if (LOCALE_PREFIX_RE.test(pathname)) {
    return null;
  }
  if (request.cookies.get('NEXT_LOCALE')?.value) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.pathname =
    pathname === '/' ? `/${preferred}` : `/${preferred}${pathname}`;
  const response = NextResponse.redirect(url);
  response.cookies.set('NEXT_LOCALE', preferred, {
    path: '/',
    sameSite: 'lax',
  });
  return response;
};

/**
 * next-intl pour les pages ; robots/sitemap hors i18n mais avec cookie Host.
 * Auth partagée optionnelle (SHARED_AUTH_ENABLED) via cookie signé.
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Chunks App Router sous dossiers dynamiques ([locale], …) : certains proxies
  // laissent %5B/%5D (parfois en minuscules). Next sert les fichiers avec [].
  if (pathname.startsWith('/_next/static/')) {
    const needsBracketFix =
      pathname.includes('%5B') ||
      pathname.includes('%5D') ||
      pathname.includes('%5b') ||
      pathname.includes('%5d');
    if (needsBracketFix) {
      const url = request.nextUrl.clone();
      url.pathname = pathname
        .replaceAll(/%5B/gi, '[')
        .replaceAll(/%5D/gi, ']');
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  const hostname = resolveRequestHostname(request);

  if (isSharedAuthEnabled() && !isSharedAuthPublicPath(pathname)) {
    const token = request.cookies.get(SHARED_AUTH_COOKIE)?.value;
    const { secret } = getSharedAuthCredentials();
    const valid = await verifySharedAuthToken(token, secret);

    if (!valid) {
      const locale = resolveAuthLocale(pathname, hostname);
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

  // Proxies same-origin (rewrites next.config) : next-intl ne doit pas
  // préfixer /fr|/en ni détourner vers une page 404 App Router.
  if (
    pathname.startsWith('/aircrowd-wms') ||
    pathname.startsWith('/feuxdeforet') ||
    pathname.startsWith('/aircarto')
  ) {
    return attachHostCookie(request, NextResponse.next());
  }

  const domainLocaleRedirect = maybeRedirectDomainDefaultLocale(request);
  if (domainLocaleRedirect) {
    return attachHostCookie(request, domainLocaleRedirect);
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
    '/_next/static/:path*',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
