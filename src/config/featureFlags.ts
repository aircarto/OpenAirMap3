import { readEnv } from '../lib/env';

const parseBooleanFlag = (
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

export const featureFlags = {
  maintenanceMode: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_MAINTENANCE_MODE') ?? readEnv('VITE_MAINTENANCE_MODE'),
    false
  ),
  wildfireLayer: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER') ??
      readEnv('VITE_ENABLE_WILDFIRE_LAYER'),
    true
  ),
  solidLineNebuleAir: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_SOLID_LINE_NEBULEAIR') ??
      readEnv('VITE_SOLID_LINE_NEBULEAIR') ??
      readEnv('SOLID_LINE_NEBULEAIR'),
    false
  ),
  markerNebuleAir: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_MARKER_NEBULEAIR') ??
      readEnv('VITE_MARKER_NEBULEAIR'),
    true
  ),
  useAdvertising: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_USE_ADVERTISING') ?? readEnv('VITE_USE_ADVERTISING'),
    false
  ),
  historicalModeLogs: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_HISTORICAL_MODE_LOGS') ??
      readEnv('VITE_HISTORICAL_MODE_LOGS'),
    false
  ),

  /**
   * Sert les microcapteurs AtmoSud depuis la nouvelle API microspot
   * (api-export-prod.uspot.probesys.net/microspot) au lieu de l'ancienne
   * (api.atmosud.org/observations/capteurs).
   *
   * Par défaut false : quelques campagnes ne sont pas encore exposées côté
   * microspot, donc l'ancienne API reste le chemin de repli.
   */
  useMicrospotApi: parseBooleanFlag(
    readEnv('NEXT_PUBLIC_USE_MICROSPOT_API') ??
      readEnv('VITE_USE_MICROSPOT_API'),
    false
  ),

  /**
   * Zoom minimum pour afficher le tooltip des marqueurs.
   * null = pas de restriction (tooltip à tous les niveaux de zoom).
   * number = tooltip uniquement quand zoom >= cette valeur.
   */
  tooltipMinZoom: ((): number | null => {
    const raw =
      readEnv('NEXT_PUBLIC_TOOLTIP_MIN_ZOOM') ??
      readEnv('VITE_TOOLTIP_MIN_ZOOM');
    if (raw === undefined || raw === null || raw === '') return null;
    const normalized = raw.trim().toLowerCase();
    if (['false', '0', 'off', 'no', 'disabled'].includes(normalized))
      return null;
    const num = Number(raw);
    return Number.isInteger(num) && num >= 0 ? num : null;
  })(),
};
