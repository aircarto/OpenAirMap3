import { readEnv } from './env';

/** Cookie httpOnly de session auth partagée */
export const SHARED_AUTH_COOKIE = 'oam-shared-auth';

/** Durée de session (7 jours) */
export const SHARED_AUTH_MAX_AGE_SEC = 7 * 24 * 60 * 60;

const TRUE_VALUES = new Set(['true', '1', 'on', 'yes', 'enabled']);

/**
 * Uniquement Web Crypto (`globalThis.crypto`) — compatible Edge middleware.
 * Pas d’import `node:crypto` (cassé par le bundler middleware).
 */
const getSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) indisponible');
  }
  return subtle;
};

const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) {
    return false;
  }
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  return defaultValue;
};

export type SharedAuthCredentials = {
  user: string;
  password: string;
  secret: string;
};

export const getSharedAuthCredentials = (): SharedAuthCredentials => ({
  user: (readEnv('SHARED_AUTH_USER') ?? '').trim(),
  password: readEnv('SHARED_AUTH_PASSWORD') ?? '',
  secret: (readEnv('SHARED_AUTH_SECRET') ?? '').trim(),
});

/**
 * Opt-in serveur uniquement (pas de NEXT_PUBLIC_).
 * Défaut false → instances openairmap / preprod inchangées.
 */
export const isSharedAuthEnabled = (): boolean =>
  parseBool(readEnv('SHARED_AUTH_ENABLED'), false);

/** Credentials + secret présents (sinon gate actif mais login impossible). */
export const isSharedAuthConfigured = (): boolean => {
  const { user, password, secret } = getSharedAuthCredentials();
  return Boolean(user && password && secret);
};

const toBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const importHmacKey = async (secret: string): Promise<CryptoKey> =>
  getSubtle().importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

const signPayload = async (payload: string, secret: string): Promise<string> => {
  const key = await importHmacKey(secret);
  const signature = await getSubtle().sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  return toBase64Url(signature);
};

/**
 * Crée un jeton `exp.signature` (exp = unix seconds).
 */
export const createSharedAuthToken = async (
  secret: string,
  maxAgeSec: number = SHARED_AUTH_MAX_AGE_SEC
): Promise<string> => {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = String(exp);
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
};

/**
 * Vérifie signature HMAC + expiration.
 */
export const verifySharedAuthToken = async (
  token: string | undefined | null,
  secret: string
): Promise<boolean> => {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;

  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  try {
    const key = await importHmacKey(secret);
    const expected = fromBase64Url(signature);
    // Copie dans un ArrayBuffer « propre » (compat TS / SubtleCrypto)
    const sigCopy = new Uint8Array(expected.byteLength);
    sigCopy.set(expected);
    return getSubtle().verify(
      'HMAC',
      key,
      sigCopy,
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
};

/** Comparaison à temps constant (longueur alignée). */
export const timingSafeEqualString = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
};

export const credentialsMatch = (
  inputUser: string,
  inputPassword: string,
  expected: SharedAuthCredentials
): boolean =>
  timingSafeEqualString(inputUser.trim(), expected.user) &&
  timingSafeEqualString(inputPassword, expected.password);

/** Chemins publics même si SHARED_AUTH_ENABLED (login, API auth, SEO, proxies data). */
export const isSharedAuthPublicPath = (pathname: string): boolean => {
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return true;
  }
  if (pathname.startsWith('/api/auth/')) {
    return true;
  }
  // Proxies same-origin (souvent fetch avec credentials:omit) — ne pas renvoyer du HTML login
  if (
    pathname.startsWith('/feuxdeforet') ||
    pathname.startsWith('/aircarto') ||
    pathname.startsWith('/aircrowd-wms')
  ) {
    return true;
  }

  const withoutLocale =
    pathname.replace(/^\/(en|es|it|de|ar)(?=\/|$)/, '') || '/';
  return (
    withoutLocale === '/connexion' ||
    withoutLocale === '/login' ||
    withoutLocale === '/inicio-sesion' ||
    withoutLocale === '/accesso' ||
    withoutLocale === '/anmelden'
  );
};

/** URL de login localisée (prefix as-needed). */
export const sharedAuthLoginPath = (locale: string): string => {
  if (locale === 'fr' || !locale) return '/connexion';
  const localized: Record<string, string> = {
    en: '/en/login',
    es: '/es/inicio-sesion',
    it: '/it/accesso',
    de: '/de/anmelden',
    ar: '/ar/login',
  };
  return localized[locale] ?? `/${locale}/login`;
};

export const detectLocaleFromPathname = (pathname: string): string => {
  const match = pathname.match(/^\/(en|es|it|de|ar)(?=\/|$)/);
  return match?.[1] ?? 'fr';
};
