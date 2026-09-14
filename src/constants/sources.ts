import { Sources } from "../types";

export const sources: Sources = {
  atmoRef: {
    name: "Station de référence AtmoSud",
    code: "atmoRef",
    activated: true,
    supportedTimeSteps: ["instantane", "quartHeure", "heure", "jour"],
  }, // Stations de référence AtmoSud
  atmoMicro: {
    name: "Microcapteurs qualifiés AtmoSud",
    code: "atmoMicro",
    activated: true,
    supportedTimeSteps: ["instantane", "deuxMin", "quartHeure", "heure"],
  }, // Micro-stations AtmoSud
};

/**
 * Sous-sources communautaires hors périmètre actuel (menu sources AtmoSud uniquement).
 * Conservé vide pour ne pas casser les imports / tests existants.
 */
export const EXCLUDED_FROM_GROUP_TOGGLE = [] as const;

/** Codes du groupe communautaire — désactivé (aucune sous-source exposée). */
export const COMMUNAUTAIRE_SOURCE_CODES: string[] = [];

// Fonction pour obtenir les sources activées par défaut
export const getDefaultSources = (): string[] => {
  const defaultSources: string[] = [];

  Object.entries(sources).forEach(([key, source]) => {
    if (source.activated && !source.isGroup) {
      // Source simple activée
      defaultSources.push(key);
    } else if (source.activated && source.isGroup && source.subSources) {
      // Groupe activé, ajouter les sous-sources activées
      Object.entries(source.subSources).forEach(([subKey, subSource]) => {
        if (subSource.activated) {
          defaultSources.push(`${key}.${subKey}`);
        }
      });
    }
  });

  return defaultSources;
};
