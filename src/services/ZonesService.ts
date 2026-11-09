import { ZoneKind } from "../constants/zones";

/**
 * Charge (paresseusement) les fichiers GeoJSON des zones (aéroports, ports,
 * Seveso). Données statiques servies depuis public/data/zones/ : un seul
 * chargement par type et par session (cache mémoire).
 */
export class ZonesService {
  private static cache = new Map<ZoneKind, GeoJSON.FeatureCollection>();

  async load(kind: ZoneKind, url: string): Promise<GeoJSON.FeatureCollection> {
    const cached = ZonesService.cache.get(kind);
    if (cached) {
      return cached;
    }

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Chargement zones ${kind}: HTTP ${response.status}`);
    }

    const data = (await response.json()) as GeoJSON.FeatureCollection;
    if (data?.type !== "FeatureCollection") {
      throw new Error(`Format GeoJSON invalide pour ${kind}`);
    }

    ZonesService.cache.set(kind, data);
    return data;
  }
}
