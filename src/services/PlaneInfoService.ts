/**
 * Enrichissement des fiches avion via adsbdb.com (gratuit, sans clé, CORS *).
 *
 *  - aircraft/{hex} : photo + constructeur + type + propriétaire
 *  - callsign/{vol} : compagnie + aéroport d'origine + de destination (coords)
 *
 * Best-effort : renvoie null/champs vides si l'info n'existe pas.
 */

export interface Airport {
  name: string;
  iata: string | null;
  icao: string | null;
  country: string | null;
  countryIso: string | null;
  municipality: string | null;
  lat: number | null;
  lon: number | null;
}

export interface PlaneExternalInfo {
  photoUrl: string | null;
  photoThumbUrl: string | null;
  manufacturer: string | null;
  typeFull: string | null;
  owner: string | null;
  ownerCountry: string | null;
  airline: string | null;
  airlineCountry: string | null;
  origin: Airport | null;
  destination: Airport | null;
}

const BASE = "https://api.adsbdb.com/v0";

const toAirport = (a: unknown): Airport | null => {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  if (!o.name) return null;
  return {
    name: String(o.name),
    iata: (o.iata_code as string) || null,
    icao: (o.icao_code as string) || null,
    country: (o.country_name as string) || null,
    countryIso: (o.country_iso_name as string) || null,
    municipality: (o.municipality as string) || null,
    lat: typeof o.latitude === "number" ? o.latitude : null,
    lon: typeof o.longitude === "number" ? o.longitude : null,
  };
};

export class PlaneInfoService {
  private static aircraftCache = new Map<string, Partial<PlaneExternalInfo>>();
  private static routeCache = new Map<string, Partial<PlaneExternalInfo>>();

  /** Récupère photo + détails + route (combinés) pour un avion */
  async fetch(
    hex: string,
    callsign: string | null
  ): Promise<PlaneExternalInfo> {
    const [aircraft, route] = await Promise.all([
      this.getAircraft(hex),
      callsign ? this.getRoute(callsign) : Promise.resolve({}),
    ]);
    return {
      photoUrl: null,
      photoThumbUrl: null,
      manufacturer: null,
      typeFull: null,
      owner: null,
      ownerCountry: null,
      airline: null,
      airlineCountry: null,
      origin: null,
      destination: null,
      ...aircraft,
      ...route,
    };
  }

  /** Route seule (origine/destination) — utilisée aussi pour tracer la ligne */
  async getRoute(callsign: string): Promise<Partial<PlaneExternalInfo>> {
    const key = callsign.trim().toUpperCase();
    if (!key) return {};
    if (PlaneInfoService.routeCache.has(key)) {
      return PlaneInfoService.routeCache.get(key)!;
    }
    let result: Partial<PlaneExternalInfo> = {};
    try {
      const r = await fetch(`${BASE}/callsign/${encodeURIComponent(key)}`, {
        headers: { Accept: "application/json" },
        mode: "cors",
        credentials: "omit",
      });
      if (r.ok) {
        const d = await r.json();
        const fr = d?.response?.flightroute;
        if (fr) {
          result = {
            airline: fr.airline?.name ?? null,
            airlineCountry: fr.airline?.country ?? null,
            origin: toAirport(fr.origin),
            destination: toAirport(fr.destination),
          };
        }
      }
    } catch (e) {
      console.debug("[PlaneInfo] route indispo", key, e);
    }
    PlaneInfoService.routeCache.set(key, result);
    return result;
  }

  private async getAircraft(hex: string): Promise<Partial<PlaneExternalInfo>> {
    const key = hex.trim().toLowerCase();
    if (PlaneInfoService.aircraftCache.has(key)) {
      return PlaneInfoService.aircraftCache.get(key)!;
    }
    let result: Partial<PlaneExternalInfo> = {};
    try {
      const r = await fetch(`${BASE}/aircraft/${encodeURIComponent(key)}`, {
        headers: { Accept: "application/json" },
        mode: "cors",
        credentials: "omit",
      });
      if (r.ok) {
        const d = await r.json();
        const ac = d?.response?.aircraft;
        if (ac) {
          result = {
            photoUrl: ac.url_photo ?? null,
            photoThumbUrl: ac.url_photo_thumbnail ?? ac.url_photo ?? null,
            manufacturer: ac.manufacturer ?? null,
            typeFull: ac.type ?? null,
            owner: ac.registered_owner ?? null,
            ownerCountry: ac.registered_owner_country_name ?? null,
          };
        }
      }
    } catch (e) {
      console.debug("[PlaneInfo] aircraft indispo", key, e);
    }
    PlaneInfoService.aircraftCache.set(key, result);
    return result;
  }
}
