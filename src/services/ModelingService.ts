import { HistoricalDataPoint } from "../types";

/**
 * Service pour récupérer les données de modélisation depuis l'API Atmosud
 * Modèle AZUR Heure - Extraction des valeurs en un point
 */
export class ModelingService {
  private readonly BASE_URL = "https://api.atmosud.org/prevision/cartes/horaires/point";

  /**
   * Valeur aberrante renvoyée par l'API pour indiquer une donnée invalide ou manquante.
   * Elle est convertie en null pour afficher un gap sur le graphique.
   */
  private readonly ABERRANT_CONCENTRATION = -9999;

  /**
   * Mapping des polluants de l'application vers les codes de l'API de modélisation
   */
  private readonly POLLUTANT_MAPPING: Record<string, string> = {
    pm25: "pm2.5",
    pm10: "pm10",
    pm1: "pm1", // À vérifier si supporté
    no2: "no2",
    o3: "o3",
    so2: "so2",
  };

  /**
   * Récupère les données de modélisation pour un point géographique donné
   * @param params Paramètres de la requête
   * @returns Tableau de points de données historiques
   */
  async fetchModelingData(params: {
    longitude: number;
    latitude: number;
    pollutant: string;
    datetimeEcheance: string; // Format ISO 8601 (ex: 2025-12-29T10:00:00Z)
    withList?: boolean; // Si true, retourne toutes les échéances
  }): Promise<HistoricalDataPoint[]> {
    try {
      // Mapper le polluant vers le code de l'API
      const apiPollutant = this.POLLUTANT_MAPPING[params.pollutant];
      if (!apiPollutant) {
        console.warn(
          `Polluant ${params.pollutant} non supporté par l'API de modélisation`
        );
        return [];
      }

      // Construire l'URL avec les paramètres
      const url = new URL(this.BASE_URL);
      url.searchParams.append("x", params.longitude.toString());
      url.searchParams.append("y", params.latitude.toString());
      url.searchParams.append("datetime_echeance", params.datetimeEcheance);
      url.searchParams.append(
        "with_list",
        params.withList !== false ? "true" : "false"
      );
      url.searchParams.append("polluant", apiPollutant);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();

      // Transformer les données de l'API vers le format HistoricalDataPoint
      return this.transformModelingData(data, params.pollutant);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données de modélisation:",
        error
      );
      throw error;
    }
  }

  /**
   * Transforme les données de l'API de modélisation vers le format HistoricalDataPoint
   */
  private transformModelingData(
    apiData: any,
    pollutant: string
  ): HistoricalDataPoint[] {
    if (!apiData.variables || !Array.isArray(apiData.variables)) {
      return [];
    }

    const dataPoints: HistoricalDataPoint[] = [];

    // Parcourir les variables (généralement une seule variable par polluant)
    for (const variable of apiData.variables) {
      if (!variable.horaires || !Array.isArray(variable.horaires)) {
        continue;
      }

      // Parcourir les horaires
      // L'API renvoie datetime_echeance en UTC comme heure de début de la plage
      // (ex: 9h pour la modélisation 9h-10h). On ajoute 1h pour afficher
      // l'heure de fin sur le graphique (ex: 10h pour la plage 9h-10h).
      const ONE_HOUR_MS = 60 * 60 * 1000;
      for (const horaire of variable.horaires) {
        if (!horaire.datetime_echeance) continue;

        const startDate = new Date(horaire.datetime_echeance);
        const endTimestamp = new Date(
          startDate.getTime() + ONE_HOUR_MS
        ).toISOString();

        // Convertir les valeurs aberrantes (-9999) en null pour créer un gap sur le graphique
        const concentration = horaire.concentration;
        const isInvalid =
          concentration === this.ABERRANT_CONCENTRATION ||
          concentration === null ||
          concentration === undefined;
        const value = isInvalid ? null : concentration;

        dataPoints.push({
          timestamp: endTimestamp,
          value,
          unit: "µg/m³", // L'API de modélisation utilise toujours µg/m³
        });
      }
    }

    // Trier par timestamp pour garantir l'ordre chronologique
    dataPoints.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return dataPoints;
  }

  /**
   * Vérifie si un polluant est supporté par l'API de modélisation
   */
  isPollutantSupported(pollutant: string): boolean {
    return pollutant in this.POLLUTANT_MAPPING;
  }

  /**
   * Obtient le code de polluant pour l'API de modélisation
   */
  getApiPollutantCode(pollutant: string): string | null {
    return this.POLLUTANT_MAPPING[pollutant] || null;
  }
}

