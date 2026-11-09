import { env } from "../lib/env";
import { PlaneTrack, PlaneTrackPoint } from "../types";

/**
 * Service de récupération des trajectoires d'avions (ADS-B).
 *
 * URL de la route lue dans VITE_PLANE_API_URL. Sans cette variable, la couche
 * reste inactive (aucun appel réseau). Contrat = sortie de
 * openairmap/dataPlanes.php (lecture seule du bucket InfluxDB "Plane").
 */

interface RawPlaneLabel {
  callsign?: string;
  reg?: string;
  type?: string;
  type_desc?: string;
  category?: string;
  track?: number;
  true_heading?: number;
  gs?: number;
  alt_baro?: number;
  baro_rate?: number;
  on_ground?: boolean;
  squawk?: string;
}

interface RawPlaneTrack {
  id: string | number;
  points: [number, number, number][];
  label?: RawPlaneLabel;
}

interface PlanesApiResponse {
  now?: number;
  hours?: number;
  every?: string;
  planes?: RawPlaneTrack[];
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const fin = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export class PlaneTrackingService {
  private static readonly BASE_URL = (
    env.planeApiUrl ?? ""
  ).trim();

  static isConfigured(): boolean {
    return PlaneTrackingService.BASE_URL.length > 0;
  }

  async fetchTracks(hours: number, every?: string): Promise<PlaneTrack[]> {
    if (!PlaneTrackingService.isConfigured()) {
      return [];
    }
    const sep = PlaneTrackingService.BASE_URL.includes("?") ? "&" : "?";
    let url = `${PlaneTrackingService.BASE_URL}${sep}hours=${hours}`;
    if (every) url += `&every=${encodeURIComponent(every)}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok) {
      throw new Error(`Erreur API avions: ${response.status}`);
    }

    const data: PlanesApiResponse | RawPlaneTrack[] = await response.json();
    const raw = Array.isArray(data) ? data : data?.planes;
    if (!raw || !Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((r) => this.transform(r))
      .filter((p): p is PlaneTrack => p !== null)
      .sort((a, b) => b.lastPoint.time - a.lastPoint.time);
  }

  private transform(raw: RawPlaneTrack): PlaneTrack | null {
    if (raw == null || raw.id == null || !Array.isArray(raw.points)) {
      return null;
    }
    const points: PlaneTrackPoint[] = raw.points
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

    const l = raw.label ?? {};
    return {
      id: String(raw.id),
      callsign: str(l.callsign),
      registration: str(l.reg),
      type: str(l.type),
      typeDesc: str(l.type_desc),
      category: str(l.category),
      points,
      lastPoint: points[points.length - 1],
      trackDeg: fin(l.track) ?? fin(l.true_heading),
      speedKnots: fin(l.gs),
      altitudeFt: fin(l.alt_baro),
      verticalRate: fin(l.baro_rate),
      onGround: l.on_ground === true,
      squawk: str(l.squawk),
    };
  }
}
