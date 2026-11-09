import { env } from "../lib/env";
import { BoatTrack, BoatTrackPoint } from "../types";
import { BOAT_MAX_PLAUSIBLE_SPEED_KNOTS } from "../constants/boats";

/**
 * Service de récupération des trajectoires de bateaux (AIS).
 *
 * ── Point de branchement de l'API ────────────────────────────────────────────
 * L'URL de la route est lue dans VITE_BOAT_API_URL (fichier .env). Tant que la
 * variable n'est pas renseignée, la couche bateaux reste inactive — aucun appel
 * réseau n'est fait. Le jour où la route existe, il suffit de poser :
 *
 *   VITE_BOAT_API_URL=https://api.aircarto.fr/bateaux/tracks
 *
 * Contrat attendu (même format que GET /api/tracks du projet
 * boat-airplane-detection, qui lit InfluxDB bucket "Boat") :
 *
 *   GET {VITE_BOAT_API_URL}?hours=2
 *   → {
 *       "now": 1718123456789,
 *       "hours": 2,
 *       "boats": [
 *         {
 *           "id": "244110290",                       // MMSI
 *           "points": [[ts_ms, lat, lon], ...],      // ordre chronologique
 *           "label": { "name": "...", "ship_type": 70 }  // optionnel
 *         }
 *       ]
 *     }
 *
 * Le service tolère aussi une réponse réduite à un simple tableau de bateaux
 * (sans enveloppe {now, hours, boats}).
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface RawBoatLabel {
  name?: string;
  ship_type?: number;
  // Fiche d'identité AIS (issue de boat_static / boat_position)
  class?: string;
  nav_status?: number;
  callsign?: string;
  destination?: string;
  imo?: number;
  draught?: number;
  length?: number;
  width?: number;
  // Distances antenne GPS -> proue/poupe/bâbord/tribord (m) pour la coque
  dim_a?: number;
  dim_b?: number;
  dim_c?: number;
  dim_d?: number;
  // Champs que la route pourra fournir plus tard ; utilisés en priorité
  // s'ils existent, sinon cap/vitesse sont calculés depuis les positions.
  cog?: number;
  sog?: number;
  // Heading AIS (orientation de la coque). 511 = "non disponible" côté AIS.
  // Plusieurs noms possibles selon la route ; le premier fini < 360 gagne.
  heading?: number;
  true_heading?: number;
  hdg?: number;
}

const asPositiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

/**
 * Angle AIS valide (cap sur le fond ou heading) : un entier fini dans [0, 360[.
 * L'AIS utilise 360 pour le COG et 511 pour le heading quand la donnée n'est
 * pas disponible ; ces sentinelles sont rejetées.
 */
const asAisAngle = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 360
    ? value
    : null;

// En deçà de cette distance entre deux positions, on considère que le navire
// n'a pas réellement bougé (dérive/jitter GPS d'un bateau à quai) : le cap
// calculé serait du bruit, on le laisse donc à null.
const MIN_TRAVEL_M = 15;

interface RawBoatTrack {
  id: string | number;
  points: [number, number, number][];
  label?: RawBoatLabel;
}

interface BoatTracksApiResponse {
  now?: number;
  hours?: number;
  boats?: RawBoatTrack[];
}

const KNOTS_PER_METER_PER_SECOND = 1.94384;
const EARTH_RADIUS_M = 6371000;

export class BoatTrackingService {
  private static readonly BASE_URL = (
    env.boatApiUrl ?? ""
  ).trim();

  /** La couche ne peut fonctionner que si l'URL de la route est configurée */
  static isConfigured(): boolean {
    return BoatTrackingService.BASE_URL.length > 0;
  }

  /**
   * @param hours profondeur du trajet (paramètre `hours` de la route)
   * @param every finesse des points (paramètre `every`), ex: "30s". Optionnel :
   *              la route choisit automatiquement si on ne le passe pas.
   */
  async fetchTracks(hours: number, every?: string): Promise<BoatTrack[]> {
    if (!BoatTrackingService.isConfigured()) {
      return [];
    }

    const separator = BoatTrackingService.BASE_URL.includes("?") ? "&" : "?";
    let url = `${BoatTrackingService.BASE_URL}${separator}hours=${hours}`;
    if (every) {
      url += `&every=${encodeURIComponent(every)}`;
    }

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(
        `Erreur API bateaux: ${response.status} ${response.statusText}`
      );
    }

    const data: BoatTracksApiResponse | RawBoatTrack[] = await response.json();
    const rawBoats = Array.isArray(data) ? data : data?.boats;

    if (!rawBoats || !Array.isArray(rawBoats)) {
      return [];
    }

    return rawBoats
      .map((raw) => this.transformTrack(raw))
      .filter((track): track is BoatTrack => track !== null)
      .sort((a, b) => b.lastPoint.time - a.lastPoint.time);
  }

  private transformTrack(raw: RawBoatTrack): BoatTrack | null {
    if (raw == null || raw.id == null || !Array.isArray(raw.points)) {
      return null;
    }

    const points: BoatTrackPoint[] = raw.points
      .filter(
        (p): p is [number, number, number] =>
          Array.isArray(p) &&
          p.length >= 3 &&
          p.every((v) => typeof v === "number" && Number.isFinite(v)) &&
          Math.abs(p[1]) <= 90 &&
          Math.abs(p[2]) <= 180
      )
      .map(([time, lat, lon]) => ({ time, lat, lon }))
      .sort((a, b) => a.time - b.time);

    if (points.length === 0) {
      return null;
    }

    const lastPoint = points[points.length - 1];
    const derived = this.deriveCourseAndSpeed(points);

    const label = raw.label ?? {};

    return {
      id: String(raw.id),
      name: label.name?.trim() || null,
      shipType: typeof label.ship_type === "number" ? label.ship_type : null,
      aisClass: label.class === "A" || label.class === "B" ? label.class : null,
      navStatus:
        typeof label.nav_status === "number" && label.nav_status >= 0
          ? label.nav_status
          : null,
      callsign: label.callsign?.trim() || null,
      destination: label.destination?.trim() || null,
      imo: asPositiveNumber(label.imo),
      draughtM: asPositiveNumber(label.draught),
      lengthM: asPositiveNumber(label.length),
      widthM: asPositiveNumber(label.width),
      dimA: asPositiveNumber(label.dim_a),
      dimB: asPositiveNumber(label.dim_b),
      dimC: asPositiveNumber(label.dim_c),
      dimD: asPositiveNumber(label.dim_d),
      points,
      lastPoint,
      courseDeg: asAisAngle(label.cog) ?? derived.courseDeg,
      headingDeg:
        asAisAngle(label.heading) ??
        asAisAngle(label.true_heading) ??
        asAisAngle(label.hdg),
      speedKnots:
        typeof label.sog === "number" &&
        label.sog < BOAT_MAX_PLAUSIBLE_SPEED_KNOTS
          ? label.sog
          : derived.speedKnots,
    };
  }

  /**
   * Cap et vitesse estimés à partir des deux dernières positions distinctes.
   * Fallback quand la route ne fournit pas cog/sog dans le label.
   */
  private deriveCourseAndSpeed(points: BoatTrackPoint[]): {
    courseDeg: number | null;
    speedKnots: number | null;
  } {
    const last = points[points.length - 1];

    // Remonter jusqu'à un point réellement distinct (un navire à quai émet
    // plusieurs fois la même position : cap incalculable dessus)
    let previous: BoatTrackPoint | null = null;
    for (let i = points.length - 2; i >= 0; i--) {
      if (points[i].lat !== last.lat || points[i].lon !== last.lon) {
        previous = points[i];
        break;
      }
    }

    if (!previous || previous.time >= last.time) {
      return { courseDeg: null, speedKnots: null };
    }

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const lat1 = toRad(previous.lat);
    const lat2 = toRad(last.lat);
    const deltaLon = toRad(last.lon - previous.lon);

    // Distance haversine → vitesse moyenne sur le dernier segment
    const deltaLat = lat2 - lat1;
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const distanceM =
      2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const elapsedS = (last.time - previous.time) / 1000;
    const speedKnots = (distanceM / elapsedS) * KNOTS_PER_METER_PER_SECOND;

    // Déplacement sous le seuil de jitter : le cap serait du bruit (navire à
    // quai). On renvoie un cap nul mais on garde la vitesse (quasi nulle).
    const courseDeg =
      distanceM < MIN_TRAVEL_M
        ? null
        : (() => {
            // Cap initial (formule du bearing orthodromique)
            const y = Math.sin(deltaLon) * Math.cos(lat2);
            const x =
              Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
            return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
          })();

    return {
      courseDeg,
      speedKnots:
        speedKnots < BOAT_MAX_PLAUSIBLE_SPEED_KNOTS ? speedKnots : null,
    };
  }
}
