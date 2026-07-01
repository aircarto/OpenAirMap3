/**
 * Métadonnées curées d'un navire (image, propulsion, branchement à quai,
 * articles d'actualité). Écrites en admin (gestion.aircarto.fr), lues ici en
 * public via api.aircarto.fr/boats/get_boat_meta. OpenAirMap reste lecture seule.
 */

export interface BoatNewsArticle {
  title: string;
  url: string;
  source?: string | null;
  published_at?: string | null;
  image_url?: string | null;
}

export interface BoatMeta {
  imo: number | null;
  mmsi: string | null;
  display_name: string | null;
  operator: string | null;
  image_url: string | null;
  propulsion: string | null;
  shore_power: string | null;
  year_built: number | null;
  passengers: number | null;
  vehicles: number | null;
  length_m: number | null;
  news_articles: BoatNewsArticle[];
  extra: Record<string, unknown>;
}

export class BoatMetaService {
  private readonly baseUrl = import.meta.env.DEV
    ? "/aircarto/boats"
    : "https://api.aircarto.fr/boats";

  /** Fiche curée d'un navire (imo prioritaire, mmsi en repli). null si aucune. */
  async getByBoat(
    imo: number | null,
    mmsi: string | null
  ): Promise<BoatMeta | null> {
    const params = new URLSearchParams();
    if (imo != null) params.set("imo", String(imo));
    if (mmsi) params.set("mmsi", mmsi);
    if ([...params.keys()].length === 0) return null;

    const res = await fetch(`${this.baseUrl}/get_boat_meta?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Boat meta API: HTTP ${res.status}`);

    const data = await res.json();
    if (!data) return null;
    return {
      imo: data.imo ?? null,
      mmsi: data.mmsi ?? null,
      display_name: data.display_name ?? null,
      operator: data.operator ?? null,
      image_url: data.image_url ?? null,
      propulsion: data.propulsion ?? null,
      shore_power: data.shore_power ?? null,
      year_built: data.year_built ?? null,
      passengers: data.passengers ?? null,
      vehicles: data.vehicles ?? null,
      length_m: data.length_m ?? null,
      news_articles: Array.isArray(data.news_articles) ? data.news_articles : [],
      extra: data.extra && typeof data.extra === "object" ? data.extra : {},
    };
  }
}
