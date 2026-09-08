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
        activated: true,
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

/**
 * Sous-sources communautaires que la case « tout cocher » du groupe NE pilote
 * pas.
 *
 * MobileAir est déclaré ici comme les autres, mais il n'entre jamais dans
 * `selectedSources` : son activation passe par un booléen propre, parce qu'elle
 * n'affiche rien tant qu'un capteur et une période n'ont pas été choisis puis
 * chargés. Le tout-cocher l'allumerait donc sans rien montrer, et le compte
 * « n/total » mentirait.
 *
 * Ne pas « corriger » cette exclusion en ajoutant `mobileair` au périmètre : la
 * régression serait silencieuse, d'où le test e2e dédié.
 */
export const EXCLUDED_FROM_GROUP_TOGGLE = ["mobileair"] as const;

/**
 * Codes pilotés par la case « tout cocher » du groupe communautaire, dérivés du
 * référentiel ci-dessus.
 *
 * Dérivés et non listés à la main : la liste était auparavant écrite deux fois
 * dans `SourceDropdown` — un tuple en tête de fichier et un littéral inline
 * dans le rendu — qui pouvaient diverger sans que rien ne le signale.
 */
export const COMMUNAUTAIRE_SOURCE_CODES: string[] = Object.keys(
  sources.communautaire.subSources ?? {}
)
  .filter(
    (key) => !(EXCLUDED_FROM_GROUP_TOGGLE as readonly string[]).includes(key)
  )
  .map((key) => `communautaire.${key}`);

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
