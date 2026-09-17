/**
 * Lecture d'environnement compatible Vite (tests) et Next.
 * Les flags client utilisent NEXT_PUBLIC_* ; NOINDEX reste serveur.
 *
 * Important (Next) : les `NEXT_PUBLIC_*` ne sont injectées dans le bundle
 * client que via un accès **littéral** `process.env.NEXT_PUBLIC_FOO`.
 * Un accès dynamique `process.env[key]` renvoie `undefined` côté navigateur,
 * ce qui faisait retomber les flags sur leur défaut (ex. wildfireLayer → true).
 */
const publicEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_MAINTENANCE_MODE: process.env.NEXT_PUBLIC_MAINTENANCE_MODE,
  NEXT_PUBLIC_FORCE_DOMAIN_CONFIG: process.env.NEXT_PUBLIC_FORCE_DOMAIN_CONFIG,
  NEXT_PUBLIC_NOINDEX: process.env.NEXT_PUBLIC_NOINDEX,
  NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER: process.env.NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER,
  NEXT_PUBLIC_SOLID_LINE_NEBULEAIR: process.env.NEXT_PUBLIC_SOLID_LINE_NEBULEAIR,
  NEXT_PUBLIC_MARKER_NEBULEAIR: process.env.NEXT_PUBLIC_MARKER_NEBULEAIR,
  NEXT_PUBLIC_TOOLTIP_MIN_ZOOM: process.env.NEXT_PUBLIC_TOOLTIP_MIN_ZOOM,
  NEXT_PUBLIC_USE_ADVERTISING: process.env.NEXT_PUBLIC_USE_ADVERTISING,
  NEXT_PUBLIC_SENSOR_SHOP_URL: process.env.NEXT_PUBLIC_SENSOR_SHOP_URL,
  NEXT_PUBLIC_MATOMO_ENABLED: process.env.NEXT_PUBLIC_MATOMO_ENABLED,
  NEXT_PUBLIC_MATOMO_DEBUG: process.env.NEXT_PUBLIC_MATOMO_DEBUG,
  NEXT_PUBLIC_MATOMO_SEND: process.env.NEXT_PUBLIC_MATOMO_SEND,
  NEXT_PUBLIC_MATOMO_STRIP_QUERY_PARAMS:
    process.env.NEXT_PUBLIC_MATOMO_STRIP_QUERY_PARAMS,
  NEXT_PUBLIC_MATOMO_URL: process.env.NEXT_PUBLIC_MATOMO_URL,
  NEXT_PUBLIC_MATOMO_SITE_ID: process.env.NEXT_PUBLIC_MATOMO_SITE_ID,
  NEXT_PUBLIC_USE_MICROSPOT_API: process.env.NEXT_PUBLIC_USE_MICROSPOT_API,
  NEXT_PUBLIC_HISTORICAL_MODE_LOGS: process.env.NEXT_PUBLIC_HISTORICAL_MODE_LOGS,
  NEXT_PUBLIC_AIRCROWD_WMS_URL: process.env.NEXT_PUBLIC_AIRCROWD_WMS_URL,
  // Alias Vite (tests / migrations) — littéraux pour le même motif d'injection
  VITE_MAINTENANCE_MODE: process.env.VITE_MAINTENANCE_MODE,
  VITE_AIRCROWD_WMS_URL: process.env.VITE_AIRCROWD_WMS_URL,
  VITE_FORCE_DOMAIN_CONFIG: process.env.VITE_FORCE_DOMAIN_CONFIG,
  VITE_ENABLE_WILDFIRE_LAYER: process.env.VITE_ENABLE_WILDFIRE_LAYER,
  VITE_SOLID_LINE_NEBULEAIR: process.env.VITE_SOLID_LINE_NEBULEAIR,
  VITE_MARKER_NEBULEAIR: process.env.VITE_MARKER_NEBULEAIR,
  VITE_TOOLTIP_MIN_ZOOM: process.env.VITE_TOOLTIP_MIN_ZOOM,
  VITE_USE_ADVERTISING: process.env.VITE_USE_ADVERTISING,
  VITE_SENSOR_SHOP_URL: process.env.VITE_SENSOR_SHOP_URL,
  VITE_MATOMO_ENABLED: process.env.VITE_MATOMO_ENABLED,
  VITE_MATOMO_DEBUG: process.env.VITE_MATOMO_DEBUG,
  VITE_MATOMO_SEND: process.env.VITE_MATOMO_SEND,
  VITE_MATOMO_STRIP_QUERY_PARAMS: process.env.VITE_MATOMO_STRIP_QUERY_PARAMS,
  VITE_MATOMO_URL: process.env.VITE_MATOMO_URL,
  VITE_MATOMO_SITE_ID: process.env.VITE_MATOMO_SITE_ID,
  VITE_USE_MICROSPOT_API: process.env.VITE_USE_MICROSPOT_API,
  VITE_HISTORICAL_MODE_LOGS: process.env.VITE_HISTORICAL_MODE_LOGS,
};

export const readEnv = (key: string): string | undefined => {
  const viteKey = key.startsWith('NEXT_PUBLIC_')
    ? `VITE_${key.slice('NEXT_PUBLIC_'.length)}`
    : key.startsWith('VITE_')
      ? key
      : undefined;
  const nextPublicFromVite = key.startsWith('VITE_')
    ? `NEXT_PUBLIC_${key.slice('VITE_'.length)}`
    : undefined;

  const fromPublicMap =
    publicEnv[key] ??
    (nextPublicFromVite ? publicEnv[nextPublicFromVite] : undefined) ??
    (viteKey ? publicEnv[viteKey] : undefined);

  if (fromPublicMap !== undefined && fromPublicMap !== null) {
    return fromPublicMap;
  }

  // Variables serveur (SHARED_AUTH_*, NOINDEX, …) : OK en dynamique (Node only)
  if (typeof process !== 'undefined' && process.env) {
    const fromProcess =
      process.env[key] ??
      (nextPublicFromVite ? process.env[nextPublicFromVite] : undefined) ??
      (viteKey ? process.env[viteKey] : undefined);
    if (fromProcess !== undefined && fromProcess !== null) {
      return fromProcess;
    }
  }

  return undefined;
};

export const isDevRuntime = (): boolean =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : false;

export const isNoIndexEnabled = (): boolean => {
  const raw = readEnv('NOINDEX') ?? readEnv('NEXT_PUBLIC_NOINDEX');
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return ['true', '1', 'on', 'yes', 'enabled'].includes(normalized);
};
