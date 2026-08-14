export interface DomainHostingInfo {
  name: string;
  legalForm: string;
  rcs: string;
  siret: string;
  shareCapital: string;
  address: string;
  vatNumber: string;
  legalRepresentative: string;
  phone: string;
  email: string;
  website: string;
}

export interface DomainLegalInfo {
  siret: string;
  legalForm: string;
  address: string;
  legalRepresentative: string;
  publicationDirector: string;
  /** Résumé court pour le texte d'intro hébergeur */
  hosting: string;
  hostingProvider?: DomainHostingInfo;
  dpo: string;
  vatNumber?: string;
  privacyPolicyUrl?: string;
}

export interface DomainConfig {
  logo: string;
  logo2: string;
  favicon: string;
  /**
   * Variante carrée ou empilée de la marque, pour le rail de contrôles.
   *
   * `logo` et `logo2` sont horizontaux (respectivement 2,5:1 et 4:1) et ne sont
   * pas lisibles dans une colonne de 60 px — ne jamais les y mettre à l'échelle.
   * Le logo horizontal complet reste utilisé là où il y a de la place : panneau
   * « À propos » et en-tête de la modale d'informations.
   */
  markSquare?: string;
  mapCenter: [number, number];
  mapZoom: number;
  /** Emprise [sud, ouest] / [nord, est] pour limiter les overlays WMS (région Sud) */
  mapBounds: [[number, number], [number, number]];
  title: string;
  /** Titre long utilisé uniquement pour <title>/document.title. Si absent, `title` sert de repli (voir useDocumentTitle). */
  seoTitle?: string;
  /** Utilisée pour <meta name="description"> — garder ~150-160 caractères pour un bon rendu dans les résultats de recherche */
  description: string;
  /** Date (YYYY-MM-DD) de la première mesure exploitable du réseau propre à cette instance, pour temporalCoverage (JSON-LD). Ne pas renseigner si inconnue pour l'instance. */
  earliestMeasurementDate?: string;
  links: {
    website: string;
    contact: string;
    about?: string;
  };
  organization: string;
  legal?: DomainLegalInfo;
}

const defaultConfig: DomainConfig = {
  logo: './logo_atmosud_inspirer_ok_web.png',
  logo2: './LogoAirCarto.png',
  favicon: './AtmoFavicon.png',
  markSquare: './logo-atmosud-atmofrance.png',
  mapCenter: [46.6, 2.5], // Centre approximatif de la France métropolitaine
  mapZoom: 6,
  // France métropolitaine avec marge (hors DROM-COM)
  mapBounds: [
    [41.3, -5.2],
    [51.1, 9.6],
  ],
  title: 'OpenAirMap',
  seoTitle: "OpenAirMap – Qualité de l'air en temps réel | AtmoSud",
  description:
    "OpenAirMap est un projet open source qui affiche en temps réel les mesures de qualité de l'air des stations et microcapteurs.",
  legal: {
    siret: '',
    legalForm: '',
    address:
      '',
    legalRepresentative: '',
    publicationDirector: '',
    hosting: '',
    hostingProvider: {
      name: '',
      legalForm: '',
      rcs: '',
      siret: '',
      shareCapital: '',
      address: '',
      vatNumber: '',
      legalRepresentative: '',
      phone: '',
      email: '',
      website: '',
    },
    dpo: '',
    vatNumber: '',
    privacyPolicyUrl: '',
  },
  links: {
    website: 'https://atmosud.org',
    contact: 'https://atmosud.org/contact',
    about: 'https://atmosud.org/a-propos',
  },
  organization: 'AtmoSud et AirCarto',
};

// Contenu distinct du "default" pour que Google cesse de traiter cette instance
// comme un doublon d'openairmap.fr (même titre/description = même config avant ce fix).
// Le bloc `legal` (mentions légales AtmoSud) vit uniquement ici : les autres domaines
// (openairmap.fr, etc.) ne sont pas opérés par AtmoSud et ne doivent pas l'afficher.
// mapCenter/mapZoom/mapBounds et organization sont explicitement redéfinis (pas hérités
// de defaultConfig, désormais recentré sur la France) : cf. src/App.tsx (résolution par
// hostname) et src/services/EffisLayerService.ts (REGION_SUD_BOUNDS) qui en dépendent.
const atmosudConfig: DomainConfig = {
  ...defaultConfig,
  mapCenter: [43.7102, 7.262], // Nice
  mapZoom: 9,
  // PACA (04, 05, 06, 13, 83, 84) avec marge
  mapBounds: [
    [42.85, 4.0],
    [45.25, 7.95],
  ],
  title: "OpenAirMap",
  seoTitle: "OpenAirMap – Qualité de l'air en temps réel en région Sud | AtmoSud",
  description:
    "Carte interactive de la qualité de l'air en région Provence-Alpes-Côte d'Azur : stations de mesure officielles et microcapteurs citoyens NebuleAir, données en temps réel proposées par AtmoSud.",
  organization: 'AtmoSud',
  // Première mesure exploitable du réseau AtmoSud (station de référence la plus ancienne).
  earliestMeasurementDate: '2007-05-22',
  legal: {
    siret: '10795525400019',
    legalForm: 'Association loi 1901',
    address:
      'Bâtiment « Le Noilly Paradis », 146 rue Paradis, 13294 MARSEILLE Cedex 06',
    legalRepresentative: 'Pierre-Charles MARIA, Président',
    publicationDirector: 'Dominique ROBIN, Directeur général',
    hosting: 'AtmoSud sur le Cloud XPR de Free Pro',
    hostingProvider: {
      name: 'Free Pro',
      legalForm: 'SAS',
      rcs: 'Marseille',
      siret: '43909965600142',
      shareCapital: '10 880 000 €',
      address: '3 rue Paul Brutus – CS 70676 – 13344 Marseille CEDEX 15',
      vatNumber: 'FR83439099656',
      legalRepresentative: 'Denis PLANAT, directeur général',
      phone: '+33 (0)4 22 90 99 98',
      email: 'rgpd@freepro.com',
      website: 'https://xpr.freepro.com/',
    },
    dpo: 'mesdroitsrgpd@atmosud.org',
    vatNumber: 'FR40107955254',
    privacyPolicyUrl: 'https://www.atmosud.org/article/politique-de-confidentialite',
  },
};

export const DOMAIN_CONFIG: Record<string, DomainConfig> = {
  default: defaultConfig,
  atmosud: atmosudConfig,
};

const isAtmoSudHost = (hostname: string) => hostname.endsWith('.atmosud.org');

export const getConfigForDomain = (domain: string): DomainConfig => {
  if (DOMAIN_CONFIG[domain]) return DOMAIN_CONFIG[domain];
  if (isAtmoSudHost(domain)) return DOMAIN_CONFIG.atmosud;
  return DOMAIN_CONFIG.default;
};
