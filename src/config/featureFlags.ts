const parseBooleanFlag = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
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

export const featureFlags = {
  maintenanceMode: parseBooleanFlag(
    import.meta.env.VITE_MAINTENANCE_MODE as string | undefined,
    false
  ),
  wildfireLayer: parseBooleanFlag(
    import.meta.env.VITE_ENABLE_WILDFIRE_LAYER as string | undefined,
    true
  ),
  solidLineNebuleAir: parseBooleanFlag(
    ((import.meta.env as unknown as Record<string, string | undefined>)
      .SOLID_LINE_NEBULEAIR ??
      (import.meta.env.VITE_SOLID_LINE_NEBULEAIR as string | undefined)) ??
      undefined,
    false
  ),
  markerNebuleAir: parseBooleanFlag(
    import.meta.env.VITE_MARKER_NEBULEAIR as string | undefined,
    true // Par défaut, nebuleair a son propre marqueur (comportement d'origine)
  ),
  displayClusteringToggle: parseBooleanFlag(
    import.meta.env.VITE_DISPLAY_CLUSTERING_TOGGLE as string | undefined,
    true // Par défaut, le toggle est affiché
  ),

  /**
   * Zoom minimum pour afficher le tooltip des marqueurs.
   * null = pas de restriction (tooltip à tous les niveaux de zoom).
   * number = tooltip uniquement quand zoom >= cette valeur.
   */
  tooltipMinZoom: ((): number | null => {
    const raw = import.meta.env.VITE_TOOLTIP_MIN_ZOOM as string | undefined;
    if (raw === undefined || raw === null || raw === "") return null;
    const normalized = raw.trim().toLowerCase();
    if (["false", "0", "off", "no", "disabled"].includes(normalized)) return null;
    const num = Number(raw);
    return Number.isInteger(num) && num >= 0 ? num : null;
  })(),
};


