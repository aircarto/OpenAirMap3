import { BoatTrack } from "../../../types";

// Un degré de latitude ≈ 111,32 km partout ; la longitude se resserre avec la
// latitude (facteur cos φ). Suffisant pour dessiner une coque de quelques
// dizaines/centaines de mètres — pas besoin de géodésie complète ici.
const METERS_PER_DEG_LAT = 111320;

/**
 * Construit la silhouette d'une coque de navire à la VRAIE ÉCHELLE, exprimée
 * en coordonnées géographiques [lat, lon] (donc elle grossit/rétrécit toute
 * seule avec le zoom Leaflet, exactement comme sur MarineTraffic).
 *
 * Repère local du navire (origine = antenne GPS = position AIS) :
 *   - axe Y = vers la proue (avant),  +A mètres jusqu'à la pointe
 *   - axe X = vers tribord (droite), +D à tribord, -C à bâbord
 * L'antenne n'étant pas au centre, on utilise dim_a/b/c/d pour un ancrage
 * exact ; à défaut on retombe sur length/width centrés sur la position.
 *
 * Forme : un pentagone « proue pointue » (poupe droite, étrave triangulaire).
 *
 * @param orientationDeg cap d'affichage (0 = nord, sens horaire) : heading à
 *   l'arrêt, cap sur le fond en route (calculé en amont).
 * @returns liste de sommets [lat, lon], ou null si les dimensions sont inconnues.
 */
export const buildBoatHull = (
  track: BoatTrack,
  orientationDeg: number
): [number, number][] | null => {
  const { lat, lon } = track.lastPoint;

  // Distances antenne -> extrémités. Si le détail A/B/C/D manque, on centre
  // la coque sur la position à partir de la longueur/largeur globales.
  const a = track.dimA ?? (track.lengthM != null ? track.lengthM / 2 : null); // proue
  const b = track.dimB ?? (track.lengthM != null ? track.lengthM / 2 : null); // poupe
  const c = track.dimC ?? (track.widthM != null ? track.widthM / 2 : null); // bâbord
  const d = track.dimD ?? (track.widthM != null ? track.widthM / 2 : null); // tribord

  if (a == null || b == null || c == null || d == null) return null;

  const length = a + b;
  const width = c + d;
  if (length < 1 || width < 1) return null;

  // Longueur de l'étrave pointue : environ une largeur de coque, plafonnée à la
  // moitié de la longueur pour rester crédible sur les navires courts et larges.
  const noseLength = Math.min(width, length * 0.5);
  const noseStartY = a - noseLength;
  const centerX = (d - c) / 2; // axe longitudinal (antenne latéralement décalée)

  // Sommets dans le repère local (mètres) : x = tribord, y = proue
  const local: [number, number][] = [
    [-c, -b], // poupe bâbord
    [-c, noseStartY], // début d'étrave bâbord
    [centerX, a], // pointe de proue
    [d, noseStartY], // début d'étrave tribord
    [d, -b], // poupe tribord
  ];

  // Rotation du repère local vers Nord/Est selon le cap (φ horaire depuis le nord).
  const theta = (orientationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const mPerDegLon =
    METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180) || METERS_PER_DEG_LAT;

  return local.map(([x, y]) => {
    // Y pointe vers la proue (cap θ), X vers tribord (cap θ+90°)
    const northM = y * cos - x * sin;
    const eastM = y * sin + x * cos;
    return [
      lat + northM / METERS_PER_DEG_LAT,
      lon + eastM / mPerDegLon,
    ] as [number, number];
  });
};
