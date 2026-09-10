declare global {
  interface Window {
    _paq?: Array<unknown[]>;
  }
}

type MatomoEventValue = string | number | boolean | null | undefined;

interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  sendToMatomo: boolean;
  stripQueryParams: boolean;
  baseUrl: string;
  siteId: string;
}

const parseBooleanFlag = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["false", "0", "off", "no", "disabled"].includes(normalized)) {
    return false;
  }
  if (["true", "1", "on", "yes", "enabled"].includes(normalized)) {
    return true;
  }
  return defaultValue;
};

const getAnalyticsConfig = (): AnalyticsConfig => {
  const rawBaseUrl = (import.meta.env.VITE_MATOMO_URL as string | undefined)?.trim() ?? "";

  return {
    enabled: parseBooleanFlag(import.meta.env.VITE_MATOMO_ENABLED as string | undefined, false),
    debug: parseBooleanFlag(import.meta.env.VITE_MATOMO_DEBUG as string | undefined, false),
    sendToMatomo: parseBooleanFlag(
      import.meta.env.VITE_MATOMO_SEND as string | undefined,
      false
    ),
    stripQueryParams: parseBooleanFlag(
      import.meta.env.VITE_MATOMO_STRIP_QUERY_PARAMS as string | undefined,
      true
    ),
    baseUrl: rawBaseUrl.endsWith("/") ? rawBaseUrl : `${rawBaseUrl}/`,
    siteId: (import.meta.env.VITE_MATOMO_SITE_ID as string | undefined)?.trim() ?? "",
  };
};

const config = getAnalyticsConfig();
let isInitialized = false;

const logDebug = (message: string, payload?: Record<string, unknown>): void => {
  if (!config.debug) {
    return;
  }

  if (payload) {
    console.info(`[Analytics] ${message}`, payload);
    return;
  }

  console.info(`[Analytics] ${message}`);
};

const isConfigured = (): boolean => {
  return Boolean(config.enabled && config.baseUrl && config.siteId);
};

const ensurePaq = (): Array<unknown[]> => {
  if (!window._paq) {
    window._paq = [];
  }
  return window._paq;
};

const pushCommand = (command: unknown[]): void => {
  if (!isConfigured()) {
    return;
  }

  const commandSnapshot = [...command];

  if (!config.sendToMatomo) {
    logDebug("Commande Matomo simulee (non envoyee)", { command: commandSnapshot });
    return;
  }

  ensurePaq().push(commandSnapshot);
  logDebug("Commande Matomo envoyee", { command: commandSnapshot });
};

export const initAnalytics = (): void => {
  if (!isConfigured()) {
    logDebug("Matomo desactive ou mal configure", {
      enabled: config.enabled,
      hasBaseUrl: Boolean(config.baseUrl),
      hasSiteId: Boolean(config.siteId),
    });
    return;
  }

  if (isInitialized) {
    return;
  }

  if (!config.sendToMatomo) {
    isInitialized = true;
    logDebug("Matomo en mode log only (aucun envoi reseau)", {
      siteId: config.siteId,
      trackerUrl: `${config.baseUrl}matomo.php`,
      cnilMode: true,
    });
    return;
  }

  const trackerUrl = `${config.baseUrl}matomo.php`;
  const scriptUrl = `${config.baseUrl}matomo.js`;
  const paq = ensurePaq();

  paq.push(["setTrackerUrl", trackerUrl]);
  paq.push(["setSiteId", config.siteId]);
  // Mode CNIL toujours actif.
  paq.push(["disableCookies"]);
  paq.push(["setDoNotTrack", true]);
  paq.push(["enableLinkTracking"]);

  const script = document.createElement("script");
  script.async = true;
  script.src = scriptUrl;
  script.onerror = () => {
    logDebug("Echec du chargement de matomo.js", { scriptUrl });
  };

  const firstScriptTag = document.getElementsByTagName("script")[0];
  if (firstScriptTag?.parentNode) {
    firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
  } else {
    document.head.appendChild(script);
  }

  isInitialized = true;
  logDebug("Matomo initialise", { trackerUrl, siteId: config.siteId });
};

export const trackPageView = (title?: string): void => {
  if (!isConfigured()) {
    return;
  }

  if (config.stripQueryParams) {
    pushCommand(["setCustomUrl", window.location.pathname]);
  }
  if (title) {
    pushCommand(["setDocumentTitle", title]);
  }
  pushCommand(["trackPageView"]);
};

export const trackEvent = (
  category: string,
  action: string,
  name?: string,
  value?: number
): void => {
  if (!isConfigured()) {
    return;
  }

  const eventPayload: unknown[] = ["trackEvent", category, action];

  if (name !== undefined) {
    eventPayload.push(name);
  }
  if (value !== undefined) {
    eventPayload.push(value);
  }

  pushCommand(eventPayload);
};

export const trackFeatureUsage = (
  feature: string,
  metadata?: Record<string, MatomoEventValue>
): void => {
  const metadataString =
    metadata && Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined;
  trackEvent("feature", "use", feature, undefined);

  if (metadataString) {
    trackEvent("feature_metadata", feature, metadataString);
  }
};
