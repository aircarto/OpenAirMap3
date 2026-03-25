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
  communautaire: {
    name: "Autres capteurs communautaires",
    code: "communautaire",
    activated: true,
    isGroup: true,
    supportedTimeSteps: [
      "instantane",
      "deuxMin",
      "quartHeure",
      "heure",
      "jour",
    ],
    subSources: {
      nebuleair: {
        name: "NebuleAir",
        code: "nebuleair",
        activated: false,
        supportedTimeSteps: [
          "instantane",
          "deuxMin",
          "quartHeure",
          "heure",
          "jour",
        ],
      },
      sensorCommunity: {
        name: "Sensor.Community",
        code: "sensorCommunity",
        activated: false,
        supportedTimeSteps: ["instantane", "deuxMin"],
      },
      purpleair: {
        name: "PurpleAir",
        code: "purpleair",
        activated: false,
        supportedTimeSteps: ["instantane", "deuxMin"],
      },
      mobileair: {
        name: "MobileAir",
        code: "mobileair",
        activated: false,
        supportedTimeSteps: [
          "instantane",
          "deuxMin",
          "quartHeure",
          "heure",
          "jour",
        ],
      },
    },
  },
  signalair: {
    name: "SignalAir",
    code: "signalair",
    activated: false,
    supportedTimeSteps: [
      "instantane",
      "deuxMin",
      "quartHeure",
      "heure",
      "jour",
    ],
  }, // Capteurs SignalAir
};

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
