export interface DomainConfig {
  logo: string;
  logo2: string;
  favicon: string;
  mapCenter: [number, number];
  mapZoom: number;
  mapMinZoom?: number;
  mapMaxZoom?: number;
  mapMaxBounds?: [[number, number], [number, number]];
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
    title: "OpenAirMap",
    links: {
      website: "https://atmosud.org",
      contact: "https://atmosud.org/contact",
      about: "https://atmosud.org/a-propos",
    },
    organization: "AtmoSud",
  },
  "aircrowd.atmosud.org": {
    logo: "./logo_atmosud_inspirer_ok_web.png",
    logo2: "./LogoAirCarto.png",
    favicon: "./AtmoFavicon.png",
    mapCenter: [43.494, 5.492],
    mapZoom: 12,
    // Empêche le dézoom sous le niveau initial pour garder la zone cible lisible.
    mapMinZoom: 12,
    mapMaxZoom: 18,
    // Verrouille le déplacement sur le secteur Gardanne/Meyreuil.
    mapMaxBounds: [
      [43.4, 5.38],
      [43.58, 5.62],
    ],
    title: "AirCrowd",
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
