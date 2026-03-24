/// <reference types="vite/client" />

import { BaseDataService } from "./BaseDataService";
import {
  MeasurementDevice,
  SignalAirProperties,
  SignalAirReport,
} from "../types";

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


  // Cache pour les signalements
  private signalCache: SignalAirReport[] = [];
  private lastPeriod: { startDate: string; endDate: string } | null = null;

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
      // Utiliser la période par défaut si non fournie (2 derniers jours)
      const period = params.signalAirPeriod || this.getDefaultPeriod();

      // Vérifier si la période a changé
      const periodChanged =
        !this.lastPeriod ||
        this.lastPeriod.startDate !== period.startDate ||
        this.lastPeriod.endDate !== period.endDate;

      // Si la période n'a pas changé et qu'on a des données en cache, les retourner
      if (!periodChanged && this.signalCache.length > 0) {
        return this.signalCache;
      }

      // Si la période a changé, vider le cache et récupérer les nouvelles données
      if (periodChanged) {
        this.signalCache = [];
        this.lastPeriod = period;
      }

      // Récupérer tous les types de signalements
      const allReports: SignalAirReport[] = [];

      const selectedTypes =
        params.signalAirSelectedTypes && params.signalAirSelectedTypes.length > 0
          ? params.signalAirSelectedTypes
          : Object.keys(this.SIGNAL_URLS);

      for (const signalTypeKey of selectedTypes) {
        const baseUrl = this.SIGNAL_URLS[signalTypeKey as keyof typeof this.SIGNAL_URLS];
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
            // Extraire le type de signalement depuis l'URL
            const urlCode = baseUrl.split("/").pop() || "";
            const extractedSignalType =
              this.URL_TO_TYPE_MAPPING[urlCode] || signalTypeKey;

            const reports = this.transformSignalAirData(
              response,
              extractedSignalType
            );
            allReports.push(...reports);
          }
        } catch (error) {
          // Erreur silencieuse pour ce type, continuer avec les autres
          // Continuer avec les autres types même si un échoue
        }
      }

      // Mettre à jour le cache
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
    start.setDate(start.getDate() - 2); // 2 derniers jours par défaut

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

      // Extraire les coordonnées (GeoJSON utilise [longitude, latitude])
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
        // Propriétés supplémentaires pour le marqueur
        qualityLevel: signalType, // Utiliser le type de signalement pour le marqueur
        address: properties.address || properties.lieu || "",
        departmentId: properties.department || "",
        // Propriétés spécifiques à SignalAir
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
    const url = `${this.SIGNAL_URLS[signalType]}/${period.startDate}/${period.endDate}`;

    try {
      const response = await this.makeRequest(url, {
        method: "GET",
        headers: {
          Accept: "application/geo+json,application/json",
        },
        mode: "cors",
        credentials: "omit",
      });

      // Vérifier que la réponse est bien du JSON
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
