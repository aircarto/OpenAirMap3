import { sources } from "../constants/sources";
import { pasDeTemps } from "../constants/timeSteps";

/**
 * Vérifie si une source est compatible avec le pas de temps actuel
 */
export const isSourceCompatibleWithTimeStep = (
  sourceCode: string,
  timeStep: string
): boolean => {
  // Gérer les sources communautaires (communautaire.nebuleair -> nebuleair)
  let actualSourceCode = sourceCode;
  if (sourceCode.startsWith("communautaire.")) {
    actualSourceCode = sourceCode.split(".")[1];
  }

  const source = sources[actualSourceCode];
  if (!source) {
    // Si c'est une source communautaire, chercher dans le groupe communautaire
    const communautaireSource = sources["communautaire"];
    if (communautaireSource && communautaireSource.subSources) {
      const subSource = communautaireSource.subSources[actualSourceCode];
      if (subSource && subSource.supportedTimeSteps) {
        return subSource.supportedTimeSteps.includes(timeStep);
      }
    }
    return false;
  }

  // Vérifier les pas de temps de la source principale
  if (source.supportedTimeSteps) {
    return source.supportedTimeSteps.includes(timeStep);
  }

  // Si c'est un groupe, vérifier les sous-sources
  if (source.isGroup && source.subSources) {
    // Pour un groupe, on vérifie si au moins une sous-source est compatible
    return Object.values(source.subSources).some(
      (subSource) =>
        subSource.supportedTimeSteps &&
        subSource.supportedTimeSteps.includes(timeStep)
    );
  }

  return true; // Par défaut, considérer comme compatible
};

/**
 * Obtient la clé i18n du nom d'affichage d'une source (à utiliser avec t())
 */
export const getSourceDisplayNameKey = (sourceCode: string): string => {
  if (sourceCode === "atmoRef") return "controls.sourceAtmoRef";
  if (sourceCode === "atmoMicro") return "controls.sourceAtmoMicro";
  if (sourceCode === "communautaire") return "controls.sourceCommunautaire";
  if (sourceCode === "signalair") return "SignalAir"; // nom de marque
  if (sourceCode.startsWith("communautaire.")) {
    const subSource = sourceCode.split(".")[1];
    if (subSource === "nebuleair") return "NebuleAir";
    if (subSource === "sensorCommunity") return "Sensor.Community";
    if (subSource === "purpleair") return "PurpleAir";
    if (subSource === "mobileair") return "MobileAir";
  }
  return sourceCode;
};

/**
 * Obtient le nom d'affichage traduit d'une source
 */
export const getSourceDisplayName = (
  sourceCode: string,
  t: (key: string) => string
): string => {
  const key = getSourceDisplayNameKey(sourceCode);
  return key.startsWith("controls.") ? t(key) : key;
};

/**
 * Obtient les pas de temps supportés par une source
 */
export const getSupportedTimeStepsForSource = (
  sourceCode: string
): string[] => {
  let actualSourceCode = sourceCode;
  if (sourceCode.startsWith("communautaire.")) {
    actualSourceCode = sourceCode.split(".")[1];
  }

  const source = sources[actualSourceCode];
  if (!source) {
    const communautaireSource = sources["communautaire"];
    if (communautaireSource && communautaireSource.subSources) {
      const subSource = communautaireSource.subSources[actualSourceCode];
      if (subSource && subSource.supportedTimeSteps) {
        return subSource.supportedTimeSteps;
      }
    }
    return [];
  }

  if (source.supportedTimeSteps) {
    return source.supportedTimeSteps;
  }

  return [];
};

/**
 * Obtient les noms d'affichage des pas de temps supportés
 */
export const getSupportedTimeStepNames = (sourceCode: string): string[] => {
  const supportedSteps = getSupportedTimeStepsForSource(sourceCode);
  return supportedSteps.map((step) => pasDeTemps[step]?.name || step);
};

/**
 * Obtient le premier pas de temps compatible pour une source
 */
export const getFirstCompatibleTimeStep = (sourceCode: string): string | null => {
  const supportedSteps = getSupportedTimeStepsForSource(sourceCode);
  if (supportedSteps.length > 0) {
    return supportedSteps[0];
  }
  return null;
};



