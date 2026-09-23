/// <reference types="vite/client" />

import { BaseDataService } from "./BaseDataService";
import { SignalAirReport } from "../types";

// Types spécifiques pour SignalAir
interface SignalAirFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    id: string;
    type: "odeur" | "bruit" | "brulage" | "pollen" | "visuel";
    created_at?: string;
    date?: string;
    "duree-de-la-nuisance"?: string;
    "avez-vous-des-symptomes-"?: string;
    "si-oui-quels-symptomes-"?: string;
    "description-des-eventuels-autres-symptomes"?: string;
    "description-de-lorigine-de-la-nuisance"?: string;
    "remarque-commentaire"?: string;
    "origine-de-la-nuisance"?: string;
    "source-industrielle-potentielle-de-la-nuisance-declaratif-"?: string;
    "niveau-de-gene"?: string;
    city?: string;
    citycode?: string;
    zipcode?: string;
    countrycode?: string;
    address?: string;
    lieu?: string;
    nom_group?: string;
    id_group?: string;
    id_declaration?: string;
    photographie?: string;
    department?: string;
    description?: string;
  };
}

interface SignalAirGeoJSON {
  type: "FeatureCollection";
  features: SignalAirFeature[];
}

const SIGNAL_AIR_MAX_DAYS = 30;

const clampPeriodToMaxDays = (period: {
  startDate: string;
  endDate: string;
}): { startDate: string; endDate: string } => {
  const end = new Date(`${period.endDate}T00:00:00`);
  const start = new Date(`${period.startDate}T00:00:00`);
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
    return period;
  }
  const maxStart = new Date(end);
  maxStart.setDate(maxStart.getDate() - SIGNAL_AIR_MAX_DAYS);
  if (start < maxStart) {
    const y = maxStart.getFullYear();
    const m = String(maxStart.getMonth() + 1).padStart(2, "0");
    const d = String(maxStart.getDate()).padStart(2, "0");
    return { startDate: `${y}-${m}-${d}`, endDate: period.endDate };
  }
  return period;
};

const typesCacheKey = (types: string[]): string =>
  [...types].sort().join(",");

export class SignalAirService extends BaseDataService {
  // URLs pour chaque type de signalement
  private readonly SIGNAL_URLS = {
    odeur: "https://www.signalair.eu/fr/flux/geojson/gq1jrnp9",
    bruit: "https://www.signalair.eu/fr/flux/geojson/yq7b5jal",
    visuel: "https://www.signalair.eu/fr/flux/geojson/28qg73y9",
    brulage: "https://www.signalair.eu/fr/flux/geojson/yib5aa1n",
    // pollen: "https://www.signalair.eu/fr/flux/geojson/pollen", // URL à confirmer
  };

  // Mapping des codes URL vers les types de signalement
  private readonly URL_TO_TYPE_MAPPING: Record<string, string> = {
    gq1jrnp9: "odeur",
    yq7b5jal: "bruit",
    "28qg73y9": "visuel",
    yib5aa1n: "brulage",
  };

  private signalCache: SignalAirReport[] = [];
  private lastPeriod: { startDate: string; endDate: string } | null = null;
  private lastTypesKey = "";

  constructor() {
    super("signalair");
  }

  async fetchData(params: {
    pollutant: string;
    timeStep: string;
    sources: string[];
    signalAirPeriod?: { startDate: string; endDate: string };
    mobileAirPeriod?: { startDate: string; endDate: string };
    selectedSensors?: string[];
    signalAirSelectedTypes?: string[];
  }): Promise<SignalAirReport[]> {
    try {
      const period = clampPeriodToMaxDays(
        params.signalAirPeriod || this.getDefaultPeriod()
      );

      const selectedTypes =
        params.signalAirSelectedTypes && params.signalAirSelectedTypes.length > 0
          ? params.signalAirSelectedTypes.filter(
              (type) => type in this.SIGNAL_URLS
            )
          : Object.keys(this.SIGNAL_URLS);

      const nextTypesKey = typesCacheKey(selectedTypes);

      const periodChanged =
        !this.lastPeriod ||
        this.lastPeriod.startDate !== period.startDate ||
        this.lastPeriod.endDate !== period.endDate;
      const typesChanged = this.lastTypesKey !== nextTypesKey;

      if (
        !periodChanged &&
        !typesChanged &&
        this.signalCache.length > 0
      ) {
        return this.signalCache;
      }

      this.signalCache = [];
      this.lastPeriod = period;
      this.lastTypesKey = nextTypesKey;

      const allReports: SignalAirReport[] = [];

      for (const signalTypeKey of selectedTypes) {
        const baseUrl =
          this.SIGNAL_URLS[signalTypeKey as keyof typeof this.SIGNAL_URLS];
        if (!baseUrl) {
          continue;
        }

        try {
          const response = await this.fetchSignalAirData(
            signalTypeKey,
            period
          );

          if (
            response &&
            response.features &&
            Array.isArray(response.features) &&
            response.features.length > 0
          ) {
            const urlCode = baseUrl.split("/").pop() || "";
            const extractedSignalType =
              this.URL_TO_TYPE_MAPPING[urlCode] || signalTypeKey;

            const reports = this.transformSignalAirData(
              response,
              extractedSignalType
            );
            allReports.push(...reports);
          }
        } catch {
          // Continuer avec les autres types même si un échoue
        }
      }

      this.signalCache = allReports;

      return allReports;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données SignalAir:",
        error
      );
      throw error;
    }
  }

  private getDefaultPeriod(): { startDate: string; endDate: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 1);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }

  private buildReportId(
    signalType: string,
    latitude: number,
    longitude: number,
    createdAt?: string,
    declarationId?: string,
    fallbackId?: string
  ): string {
    if (declarationId) return declarationId;
    if (fallbackId) return fallbackId;
    const timestamp = createdAt || "unknown-date";
    return `signalair-${signalType}-${latitude}-${longitude}-${timestamp}`;
  }

  private transformSignalAirData(
    geoJson: SignalAirGeoJSON,
    signalType: string
  ): SignalAirReport[] {
    const reports: SignalAirReport[] = [];

    const buildName = (properties: SignalAirFeature["properties"]) => {
      if (properties.nom_group) {
        return properties.nom_group.replace(/_/g, " ");
      }

      if (properties.city) {
        return `Signalement ${signalType} · ${properties.city}`;
      }

      return `Signalement ${signalType}`;
    };

    for (const feature of geoJson.features) {
      const { geometry, properties } = feature;

      const [longitude, latitude] = geometry.coordinates;

      reports.push({
        id: this.buildReportId(
          signalType,
          latitude,
          longitude,
          properties.created_at,
          properties.id_declaration,
          properties.id
        ),
        name: buildName(properties),
        latitude,
        longitude,
        source: this.sourceCode,
        signalType,
        timestamp: properties.created_at || new Date().toISOString(),
        status: "active",
        qualityLevel: signalType,
        address: properties.address || properties.lieu || "",
        departmentId: properties.department || "",
        signalCreatedAt: properties.created_at || "",
        signalDate: properties.date || "",
        signalDuration: properties["duree-de-la-nuisance"] || "",
        signalHasSymptoms: properties["avez-vous-des-symptomes-"] || "",
        signalSymptoms: properties["si-oui-quels-symptomes-"] || "",
        signalDescription: properties.description || "",
        symptomsDetails:
          properties["description-des-eventuels-autres-symptomes"] || "",
        nuisanceOrigin: properties["origine-de-la-nuisance"] || "",
        nuisanceOriginDescription:
          properties["description-de-lorigine-de-la-nuisance"] || "",
        nuisanceLevel: properties["niveau-de-gene"] || "",
        industrialSource:
          properties[
            "source-industrielle-potentielle-de-la-nuisance-declaratif-"
          ] || "",
        city: properties.city || "",
        cityCode: properties.citycode || "",
        postalCode: properties.zipcode || "",
        countryCode: properties.countrycode || "",
        locationHint: properties.lieu || "",
        groupName: properties.nom_group || "",
        groupId: properties.id_group || "",
        declarationId: properties.id_declaration || "",
        photoUrl: properties.photographie || "",
        remarks: properties["remarque-commentaire"] || "",
      });
    }

    return reports;
  }

  private async fetchSignalAirData(
    signalType: string,
    period: { startDate: string; endDate: string }
  ): Promise<SignalAirGeoJSON | null> {
    const url = `${this.SIGNAL_URLS[signalType as keyof typeof this.SIGNAL_URLS]}/${period.startDate}/${period.endDate}`;

    try {
      const response = await this.makeRequest(url, {
        method: "GET",
        headers: {
          Accept: "application/geo+json,application/json",
        },
        mode: "cors",
        credentials: "omit",
      });

      if (
        response &&
        typeof response === "object" &&
        response.type === "FeatureCollection"
      ) {
        return response;
      } else {
        return null;
      }
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des données pour ${signalType}:`,
        error
      );
      throw error;
    }
  }
}
