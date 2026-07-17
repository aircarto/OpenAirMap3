export interface DomainConfig {
  logo: string;
  logo2: string;
  favicon: string;
  mapCenter: [number, number];
  mapZoom: number;
  /** Emprise [sud, ouest] / [nord, est] pour limiter les overlays WMS (région Sud) */
  mapBounds: [[number, number], [number, number]];
  title: string;
  links: {
    website: string;
    contact: string;
    about?: string;
  };
  organization: string;
}

export const DOMAIN_CONFIG: Record<string, DomainConfig> = {
  default: {
    logo: "./logo_atmosud_inspirer_ok_web.png",
    logo2: "./LogoAirCarto.png",
    favicon: "./AtmoFavicon.png",
    mapCenter: [43.7102, 7.262], // Nice
    mapZoom: 9,
    // PACA (04, 05, 06, 13, 83, 84) avec marge
    mapBounds: [
      [42.85, 4.0],
      [45.25, 7.95],
    ],
    title: "OpenAirMap",
    links: {
      website: "https://atmosud.org",
      contact: "https://atmosud.org/contact",
      about: "https://atmosud.org/a-propos",
    },
    organization: "AtmoSud",
  },
};

export const getConfigForDomain = (domain: string): DomainConfig => {
  return DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.default;
};
