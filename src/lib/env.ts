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
  get hideAtmoMicroStationQaqc() {
    return process.env.NEXT_PUBLIC_HIDE_ATMOMICRO_STATION_QAQC;
  },
  get historicalModeLogs() {
    return process.env.NEXT_PUBLIC_HISTORICAL_MODE_LOGS;
  },
  get noIndex() {
    return process.env.NOINDEX ?? process.env.NEXT_PUBLIC_NOINDEX;
  },

  /** Auth Keycloak (opt-in) — littéraux NEXT_PUBLIC_* pour le bundle client. */
  get keycloakEnabled() {
    return process.env.NEXT_PUBLIC_KEYCLOAK_ENABLED;
  },
  get keycloakUrl() {
    return process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  },
  get keycloakRealm() {
    return process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
  },
  get keycloakClientId() {
    return process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;
  },
  /**
   * Origine forcée pour redirect_uri / post_logout (ex. http://172.16.13.184:3000).
   * Utile en LAN quand Keycloak n'a que l'IP en Valid redirect URIs.
   */
  get authOrigin() {
    return process.env.NEXT_PUBLIC_AUTH_ORIGIN;
  },
  /** Base API microspot (ex. http://172.16.13.183:3032/microspot). */
  get microspotApiUrl() {
    return process.env.NEXT_PUBLIC_MICROSPOT_API_URL;
  },
};

export const isDevRuntime = (): boolean =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : false;

export const isNoIndexEnabled = (): boolean => parseBooleanEnv(env.noIndex, false);
