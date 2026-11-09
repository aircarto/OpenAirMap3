import { env, parseBooleanEnv } from '../lib/env';

export const featureFlags = {
  maintenanceMode: parseBooleanEnv(env.maintenanceMode, false),
  wildfireLayer: parseBooleanEnv(env.wildfireLayer, true),
  solidLineNebuleAir: parseBooleanEnv(env.solidLineNebuleAir, false),
  markerNebuleAir: parseBooleanEnv(env.markerNebuleAir, true),
  useAdvertising: parseBooleanEnv(env.useAdvertising, false),
  historicalModeLogs: parseBooleanEnv(env.historicalModeLogs, false),

  /**
   * Fonctionnalités optionnelles, propres à certains déploiements.
   * Désactivées par défaut : sans variable, aucune trace à l'écran et aucun
   * appel réseau. Voir docs/FEATURE_FLAGS.md.
   */
  // Bateaux (AIS) ; nécessite aussi NEXT_PUBLIC_BOAT_API_URL
  boatLayer: parseBooleanEnv(env.boatLayer, false),
  // Avions (ADS-B) ; nécessite aussi NEXT_PUBLIC_PLANE_API_URL
  planeLayer: parseBooleanEnv(env.planeLayer, false),
  // Zones : aéroports, ports, sites Seveso
  zonesLayer: parseBooleanEnv(env.zonesLayer, false),
  // Commentaires sur les capteurs/bateaux/zones et signalements GPS
  contextComments: parseBooleanEnv(env.contextComments, false),

  /**
   * Sert les microcapteurs AtmoSud depuis la nouvelle API microspot
   * (api-export-prod.uspot.probesys.net/microspot) au lieu de l'ancienne
   * (api.atmosud.org/observations/capteurs).
   *
   * Par défaut false : quelques campagnes ne sont pas encore exposées côté
   * microspot, donc l'ancienne API reste le chemin de repli.
   */
  useMicrospotApi: parseBooleanEnv(env.useMicrospotApi, false),

  /**
   * Masque les microcapteurs AtmoMicro en co-location sur une station de
   * référence (phase QAQC / calibration). Getter : lu à chaque accès pour
   * permettre les tests `vi.stubEnv`.
   *
   * Par défaut true : ces capteurs ne sont pas destinés à la diffusion carte.
   */
  get hideAtmoMicroStationQaqc() {
    return parseBooleanEnv(env.hideAtmoMicroStationQaqc, true);
  },

  /**
   * Zoom minimum pour afficher le tooltip des marqueurs.
   * null = pas de restriction (tooltip à tous les niveaux de zoom).
   * number = tooltip uniquement quand zoom >= cette valeur.
   */
  tooltipMinZoom: ((): number | null => {
    const raw = env.tooltipMinZoom;
    if (raw === undefined || raw === null || raw === '') return null;
    const normalized = raw.trim().toLowerCase();
    if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) {
      return null;
    }
    const num = Number(raw);
    return Number.isInteger(num) && num >= 0 ? num : null;
  })(),
};
