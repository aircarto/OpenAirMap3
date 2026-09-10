import { WildfireReport } from "../types";

interface GeoJsonFeatureProperties {
  id?: string | number;
  statut?: string;
  etat?: string;
  url?: string;
}

interface GeoJsonFeature {
  type: "Feature";
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
  properties?: GeoJsonFeatureProperties;
}

interface WildfireApiResponse {
  data?: {
    type?: "FeatureCollection";
    features?: GeoJsonFeature[];
  };
  meta?: {
    last_update?: string;
    count?: number;
    scope?: string;
  };
}

export class FeuxDeForetService {
  private static getBaseUrl(): string {
    // L'API feuxdeforet.fr bloque les requêtes navigateur (cookies + CORS).
    // On passe par un proxy same-origin (/feuxdeforet) configuré dans Vite (dev)
    // et dans le reverse proxy de production.
    return "/feuxdeforet/fdf/cartographie/geojson?scope=web";
  }

  async fetchTodaySignalements(): Promise<WildfireReport[]> {
    const response = await fetch(FeuxDeForetService.getBaseUrl(), {
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(
        `Erreur API FeuxDeForet: ${response.status} ${response.statusText}`
      );
    }

    const data: WildfireApiResponse = await response.json();

    const features = data.data?.features;

    if (!features || !Array.isArray(features)) {
      return [];
    }

    const referenceDate = this.parseMetaTimestamp(data.meta?.last_update) ?? new Date();
    const freshnessWindowMs = 48 * 60 * 60 * 1000; // 48 heures

    return features
      .map((feature) => this.transformSignalement(feature, data.meta?.last_update))
      .filter((report): report is WildfireReport => report !== null)
      .filter((report) => report.status !== 'cloture')
      .filter((report) => {
        const isRecent = this.isReportRecent(
          report,
          referenceDate,
          freshnessWindowMs
        );

        return isRecent;
      });
  }

  private transformSignalement(
    feature: GeoJsonFeature,
    fallbackDate?: string
  ): WildfireReport | null {
    const coordinates = feature.geometry?.coordinates;
    const rawId = feature.properties?.id;

    if (
      !coordinates ||
      coordinates.length < 2 ||
      typeof coordinates[0] !== "number" ||
      typeof coordinates[1] !== "number"
    ) {
      return null;
    }

    const id =
      typeof rawId === "number"
        ? rawId
        : rawId
          ? Number.parseInt(String(rawId), 10)
          : Number.NaN;

    if (Number.isNaN(id)) {
      return null;
    }

    const parsedDate = this.parseMetaTimestamp(fallbackDate)?.toISOString() ?? null;
    const [longitude, latitude] = coordinates;
    const status = feature.properties?.statut ?? "";
    const fireState = feature.properties?.etat ?? "";
    const url = feature.properties?.url ?? "";
    const title = "Signalement feu de forêt";

    return {
      id,
      title,
      latitude,
      longitude,
      type: "Feu de forêt",
      commune: "Non renseignée",
      dateText: fallbackDate ?? "",
      date: parsedDate,
      url,
      status,
      fireState,
      postStatus: status,
      description: "",
      postModified: fallbackDate ?? "",
    };
  }

  private parseMetaTimestamp(timestamp?: string): Date | null {
    if (!timestamp) {
      return null;
    }

    const normalized = timestamp.replace(" ", "T");
    const parsed = new Date(normalized);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private isReportRecent(
    report: WildfireReport,
    referenceDate: Date,
    freshnessWindowMs: number
  ): boolean {
    const candidates: Array<string | null> = [
      report.date,
      report.postModified ? report.postModified.replace(" ", "T") : null,
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const date = new Date(candidate);

      if (!Number.isNaN(date.getTime())) {
        const diff = referenceDate.getTime() - date.getTime();

        if (diff >= 0 && diff <= freshnessWindowMs) {
          return true;
        }
      }
    }

    return false;
  }
}

