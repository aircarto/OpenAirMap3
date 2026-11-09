/**
 * Couches « zones » affichées sur la carte : aéroports, ports, sites Seveso.
 *
 * Les contours proviennent de fichiers GeoJSON pré-générés (stables) :
 *   public/data/zones/{airports,ports,seveso}.geojson
 * Régénérables via `scripts/generate-zones.py`
 * (OpenStreetMap pour les aéroports/ports/empreintes d'usines, API Géorisques
 * pour la liste officielle des sites Seveso).
 */

export type ZoneKind = "airport" | "port" | "seveso";

export interface ZoneTypeConfig {
  kind: ZoneKind;
  /** Fichier GeoJSON servi depuis public/ */
  url: string;
  /** Couleur du contour et du remplissage */
  color: string;
}

// Fichiers servis depuis public/
const BASE = "/";

export const ZONE_TYPES: ZoneTypeConfig[] = [
  { kind: "airport", url: `${BASE}data/zones/airports.geojson`, color: "#2563eb" }, // bleu
  { kind: "port", url: `${BASE}data/zones/ports.geojson`, color: "#0891b2" }, // cyan
  { kind: "seveso", url: `${BASE}data/zones/seveso.geojson`, color: "#dc2626" }, // rouge (danger)
];

export const getZoneConfig = (kind: ZoneKind): ZoneTypeConfig =>
  ZONE_TYPES.find((z) => z.kind === kind) as ZoneTypeConfig;

/** Propriétés d'une zone (issues des GeoJSON pré-générés) */
export interface ZoneProperties {
  kind: ZoneKind;
  name?: string;
  // Point représentatif (pour la vue aérienne)
  lat?: number;
  lon?: number;
  // Aéroports
  iata?: string;
  icao?: string;
  subtype?: string;
  // Seveso
  seuil?: string;
  commune?: string;
  regime?: string;
  adresse?: string;
  /** Activités classées ICPE (ce que le site manipule) */
  activites?: string[];
  /** Profil entreprise (API Recherche d'entreprises) */
  naf?: string; // libellé d'activité clair (ex: "Raffinage du pétrole")
  since?: string; // année de création
  nafSection?: string; // lettre de section NAF
  effectif?: string; // code tranche effectif INSEE
  categorie?: string; // PME / ETI / GE
  // Communs (pour la photo/fiche)
  wikidata?: string;
  wikipedia?: string;
  website?: string;
  operator?: string;
}

/**
 * Vue aérienne (ortho-photo IGN, gratuite) centrée sur un point.
 * Utilisée comme illustration quand il n'y a pas de photo Wikipédia
 * (notamment pour les sites Seveso). Construit une URL WMS GetMap directe
 * (pas d'appel réseau ici, juste une URL pour une balise <img>).
 */
export const aerialImageUrl = (lat: number, lon: number): string => {
  const latHalf = 0.005;
  const lonHalf =
    (latHalf * (480 / 300)) / Math.cos((lat * Math.PI) / 180);
  const bbox = [lat - latHalf, lon - lonHalf, lat + latHalf, lon + lonHalf]
    .map((v) => v.toFixed(6))
    .join(",");
  return (
    "https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap" +
    "&LAYERS=HR.ORTHOIMAGERY.ORTHOPHOTOS&STYLES=&CRS=EPSG:4326" +
    `&BBOX=${bbox}&WIDTH=480&HEIGHT=300&FORMAT=image/jpeg`
  );
};

/** Zone sélectionnée (clic) : propriétés + point représentatif */
export interface ZoneSelection {
  props: ZoneProperties;
  lat: number;
  lon: number;
}
