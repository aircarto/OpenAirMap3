/**
 * Variables d'environnement Next.
 *
 * Les flags client (`NEXT_PUBLIC_*`) doivent être lus via un accès littéral
 * `process.env.NEXT_PUBLIC_FOO`. Un accès dynamique `process.env[key]` est
 * `undefined` dans le bundle navigateur, et le flag retombe alors sur son défaut.
 *
 * Getters : lecture au moment de l'appel (tests `vi.stubEnv`) tout en conservant
 * le littéral que Next inline côté client.
 */

export const parseBooleanEnv = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) {
    return false;
  }

  if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) {
    return true;
  }

  return defaultValue;
};

export const env = {
  get maintenanceMode() {
    return process.env.NEXT_PUBLIC_MAINTENANCE_MODE;
  },
  get forceDomainConfig() {
    return process.env.NEXT_PUBLIC_FORCE_DOMAIN_CONFIG;
  },
  get wildfireLayer() {
    return process.env.NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER;
  },
  get solidLineNebuleAir() {
    return process.env.NEXT_PUBLIC_SOLID_LINE_NEBULEAIR;
  },
  get markerNebuleAir() {
    return process.env.NEXT_PUBLIC_MARKER_NEBULEAIR;
  },
  get tooltipMinZoom() {
    return process.env.NEXT_PUBLIC_TOOLTIP_MIN_ZOOM;
  },
  get useAdvertising() {
    return process.env.NEXT_PUBLIC_USE_ADVERTISING;
  },
  get sensorShopUrl() {
    return process.env.NEXT_PUBLIC_SENSOR_SHOP_URL;
  },
  get matomoEnabled() {
    return process.env.NEXT_PUBLIC_MATOMO_ENABLED;
  },
  get matomoDebug() {
    return process.env.NEXT_PUBLIC_MATOMO_DEBUG;
  },
  get matomoSend() {
    return process.env.NEXT_PUBLIC_MATOMO_SEND;
  },
  get matomoStripQueryParams() {
    return process.env.NEXT_PUBLIC_MATOMO_STRIP_QUERY_PARAMS;
  },
  get matomoUrl() {
    return process.env.NEXT_PUBLIC_MATOMO_URL;
  },
  get matomoSiteId() {
    return process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  },
  get useMicrospotApi() {
    return process.env.NEXT_PUBLIC_USE_MICROSPOT_API;
  },
  get historicalModeLogs() {
    return process.env.NEXT_PUBLIC_HISTORICAL_MODE_LOGS;
  },
  get noIndex() {
    return process.env.NOINDEX ?? process.env.NEXT_PUBLIC_NOINDEX;
  },
};

export const isDevRuntime = (): boolean =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : false;

export const isNoIndexEnabled = (): boolean => parseBooleanEnv(env.noIndex, false);
