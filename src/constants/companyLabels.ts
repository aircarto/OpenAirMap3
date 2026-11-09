/**
 * Libellés des codes officiels français utilisés dans les fiches Seveso
 * (secteur d'activité NAF, tranche d'effectif INSEE, catégorie d'entreprise).
 * Données réglementaires françaises : libellés conservés en français.
 */

// Sections NAF (INSEE) : lettre -> secteur
const NAF_SECTIONS: Record<string, string> = {
  A: "Agriculture, sylviculture et pêche",
  B: "Industries extractives",
  C: "Industrie manufacturière",
  D: "Production et distribution d'électricité, de gaz",
  E: "Production/distribution d'eau, assainissement, déchets",
  F: "Construction",
  G: "Commerce, réparation d'automobiles",
  H: "Transports et entreposage",
  I: "Hébergement et restauration",
  J: "Information et communication",
  K: "Activités financières et d'assurance",
  L: "Activités immobilières",
  M: "Activités spécialisées, scientifiques et techniques",
  N: "Activités de services administratifs et de soutien",
  O: "Administration publique",
  P: "Enseignement",
  Q: "Santé humaine et action sociale",
  R: "Arts, spectacles et activités récréatives",
  S: "Autres activités de services",
  T: "Activités des ménages employeurs",
  U: "Activités extra-territoriales",
};

// Tranches d'effectif salarié (INSEE)
const EFFECTIFS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1 à 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

const CATEGORIES: Record<string, string> = {
  PME: "PME (petite ou moyenne entreprise)",
  ETI: "ETI (entreprise de taille intermédiaire)",
  GE: "Grande entreprise",
};

export const getSectorLabel = (section?: string): string | null =>
  (section && NAF_SECTIONS[section]) || null;

export const getEffectifLabel = (code?: string): string | null =>
  (code && EFFECTIFS[code]) || null;

export const getCategorieLabel = (cat?: string): string | null =>
  (cat && CATEGORIES[cat]) || null;
