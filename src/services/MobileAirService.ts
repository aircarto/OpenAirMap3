import { BaseDataService } from "./BaseDataService";
import {
  MeasurementDevice,
  MobileAirSensor,
  MobileAirMetadataResponse,
  MobileAirDataPoint,
  MobileAirDataResponse,
  MobileAirRoute,
  MOBILEAIR_POLLUTANT_MAPPING,
  MOBILEAIR_TIMESTEP_MAPPING,
} from "../types";
import { pollutants } from "../constants/pollutants";

export class MobileAirService extends BaseDataService {
  private readonly baseUrl = this.getApiBaseUrl();
  private sensors: MobileAirSensor[] = [];
  private routes: MobileAirRoute[] = [];
  /** Requête de catalogue en vol, pour dédupliquer les appels concurrents */
  private sensorsPromise: Promise<MobileAirSensor[]> | null = null;

  constructor() {
    super("mobileair");
  }

  private getApiBaseUrl(): string {
    // En développement, utiliser le proxy Vite
    if (import.meta.env.DEV) {
      return "/aircarto/capteurs";
    }
    // En production, utiliser l'URL complète de l'API
    return "https://api.aircarto.fr/capteurs";
  }

  async fetchData(params: {
    pollutant: string;
    timeStep: string;
    sources: string[];
    signalAirPeriod?: { startDate: string; endDate: string };
    mobileAirPeriod?: { startDate: string; endDate: string };
    selectedSensors?: string[];
    signalAirSelectedTypes?: string[];
  }): Promise<MeasurementDevice[]> {
    try {
      // Vérifier si MobileAir est dans les sources sélectionnées
      // Vérifier à la fois "mobileair" et "communautaire.mobileair"
      const isMobileAirSelected =
        params.sources.includes("mobileair") ||
        params.sources.includes("communautaire.mobileair");
      if (!isMobileAirSelected) {
        return [];
      }

      // Vérifier si le polluant est supporté par MobileAir
      const supportedPollutants = Object.values(MOBILEAIR_POLLUTANT_MAPPING);
      if (!supportedPollutants.includes(params.pollutant)) {
        console.warn(`Polluant ${params.pollutant} non supporté par MobileAir`);
        return [];
      }

      // Récupérer la liste des capteurs si pas encore fait
      if (this.sensors.length === 0) {
        await this.fetchSensors();
      }

      // Si des capteurs spécifiques sont sélectionnés, récupérer leurs données
      if (params.selectedSensors && params.selectedSensors.length > 0) {
        return await this.fetchSensorData(params);
      }

      // Sinon, retourner un device factice pour indiquer que MobileAir est sélectionné
      // mais qu'aucune route n'est encore chargée
      return [
        {
          id: "mobileair-placeholder",
          name: "MobileAir - Sélectionnez des capteurs",
          latitude: 43.7102, // Nice
          longitude: 7.262,
          source: this.sourceCode,
          pollutant: params.pollutant,
          value: 0,
          unit: "µg/m³",
          timestamp: new Date().toISOString(),
          status: "active" as const,
          qualityLevel: "default",
        },
      ];
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données MobileAir:",
        error
      );
      throw error;
    }
  }

  private async fetchSensors(): Promise<void> {
    try {
      const url = `${this.baseUrl}/metadata?capteurType=MobileAir&format=JSON`;
      const response = await this.makeRequest(url);

      if (Array.isArray(response)) {
        this.sensors = response;
      } else {
        throw new Error(
          "Format de réponse invalide pour les capteurs MobileAir"
        );
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des capteurs MobileAir:",
        error
      );
      throw error;
    }
  }

  private async fetchSensorData(params: {
    pollutant: string;
    timeStep: string;
    selectedSensors: string[];
    mobileAirPeriod?: { startDate: string; endDate: string };
  }): Promise<MeasurementDevice[]> {
    const devices: MeasurementDevice[] = [];
    // Nettoyer une seule fois avant de reconstruire les routes demandées.
    // Evite de perdre les routes précédemment ajoutées lorsqu'il y a plusieurs capteurs.
    this.clearRoutes();

    for (const sensorId of params.selectedSensors) {
      try {
        const sensor = this.sensors.find((s) => s.sensorId === sensorId);
        if (!sensor) continue;

        // Construire l'URL avec les paramètres de période
        const timeRange = this.buildTimeRange(
          params.mobileAirPeriod,
          params.timeStep
        );
        const url = `${this.baseUrl}/dataMobileAir?capteurID=${sensor.sensorToken}&start=${timeRange.start}&end=${timeRange.end}&GPSnull=false&format=JSON`;

        const response = await this.makeRequest(url);

        if (Array.isArray(response)) {
          const routes = this.processSensorData(
            response,
            sensorId,
            params.pollutant
          );
          this.routes.push(...routes);

          // Créer des devices pour chaque route
          routes.forEach((route) => {
            devices.push(this.createRouteDevice(route, params.pollutant));
          });
        }
      } catch (error) {
        console.error(
          `Erreur lors de la récupération des données pour le capteur ${sensorId}:`,
          error
        );
      }
    }

    return devices;
  }

  private buildTimeRange(
    period?: { startDate: string; endDate: string },
    timeStep?: string
  ): { start: string; end: string } {
    if (period) {
      return {
        start: period.startDate,
        end: period.endDate,
      };
    }

    // Utiliser le mapping par défaut si pas de période spécifiée
    const defaultRange =
      MOBILEAIR_TIMESTEP_MAPPING[timeStep || "instantane"] || "-18d";
    return {
      start: defaultRange,
      end: "now",
    };
  }

  private processSensorData(
    data: MobileAirDataPoint[],
    sensorId: string,
    pollutant: string
  ): MobileAirRoute[] {
    // Grouper les données par sessionId
    const sessions = new Map<number, MobileAirDataPoint[]>();

    data.forEach((point) => {
      if (!sessions.has(point.sessionId)) {
        sessions.set(point.sessionId, []);
      }
      sessions.get(point.sessionId)!.push(point);
    });

    // Créer les routes pour chaque session
    const routes: MobileAirRoute[] = [];

    sessions.forEach((points, sessionId) => {
      if (points.length === 0) return;

      // Trier les points par timestamp
      points.sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );

      // Calculer les statistiques pour le polluant sélectionné
      const pollutantKey = this.getPollutantKey(pollutant);
      const values = points
        .map((p) => p[pollutantKey as keyof MobileAirDataPoint] as number)
        .filter((v) => v != null && !isNaN(v));

      if (values.length === 0) return;

      const averageValue =
        values.reduce((sum, v) => sum + v, 0) / values.length;
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);

      const startTime = points[0].time;
      const endTime = points[points.length - 1].time;
      const duration =
        (new Date(endTime).getTime() - new Date(startTime).getTime()) /
        (1000 * 60);

      routes.push({
        sessionId,
        sensorId,
        points,
        pollutant,
        averageValue,
        maxValue,
        minValue,
        startTime,
        endTime,
        duration,
      });
    });

    return routes;
  }

  private getPollutantKey(pollutant: string): string {
    const mapping: Record<string, string> = {
      pm1: "PM1",
      pm25: "PM25",
      pm10: "PM10",
    };
    return mapping[pollutant] || "PM25";
  }

  private createSensorDevice(
    sensor: MobileAirSensor,
    pollutant: string
  ): MeasurementDevice {
    // Utiliser la dernière valeur disponible pour ce polluant
    const pollutantKey = this.getPollutantKey(pollutant);
    const value = sensor[pollutantKey as keyof MobileAirSensor] as string;
    const numericValue = value ? parseFloat(value) : 0;

    return this.createDevice(
      sensor.sensorId,
      `MobileAir ${sensor.sensorToken}`,
      parseFloat(sensor.latitude) || 0,
      parseFloat(sensor.longitude) || 0,
      pollutant,
      numericValue,
      "µg/m³",
      sensor.time,
      sensor.connected ? "active" : "inactive"
    );
  }

  private createRouteDevice(
    route: MobileAirRoute,
    pollutant: string
  ): MeasurementDevice {
    const pollutantConfig = pollutants[pollutant];
    const qualityLevel = this.getQualityLevel(
      route.averageValue,
      pollutantConfig.thresholds
    );

    return {
      id: `${route.sensorId}-session-${route.sessionId}`,
      name: `Parcours ${route.sensorId} - Session ${route.sessionId}`,
      latitude: route.points[0].lat,
      longitude: route.points[0].lon,
      source: this.sourceCode,
      pollutant,
      value: route.averageValue,
      unit: "µg/m³",
      timestamp: route.startTime,
      status: "active",
      qualityLevel,
      // Propriétés spécifiques à MobileAir
      mobileAirRoute: route,
    } as MeasurementDevice & { mobileAirRoute: MobileAirRoute };
  }

  private getQualityLevel(value: number, thresholds: any): string {
    if (value <= thresholds.bon.max) return "bon";
    if (value <= thresholds.moyen.max) return "moyen";
    if (value <= thresholds.degrade.max) return "degrade";
    if (value <= thresholds.mauvais.max) return "mauvais";
    if (value <= thresholds.tresMauvais.max) return "tresMauvais";
    return "extrMauvais";
  }

  // Méthodes publiques pour accéder aux données
  getSensors(): MobileAirSensor[] {
    return this.sensors;
  }

  /**
   * Garantit que le catalogue de capteurs est chargé, et le renvoie.
   *
   * Distincte de `fetchData()`, qui sort avant de charger le catalogue si le
   * polluant courant n'est pas supporté par MobileAir : l'interface de sélection
   * a besoin de la liste des capteurs même dans ce cas, sinon elle reste vide
   * sans erreur et sans explication.
   *
   * Idempotente, et déduplique les appels concurrents en mémorisant la requête en
   * vol — l'ouverture d'un menu peut en déclencher plusieurs dans le même tick.
   */
  async ensureSensorsLoaded(): Promise<MobileAirSensor[]> {
    if (this.sensors.length > 0) return this.sensors;
    if (this.sensorsPromise) return this.sensorsPromise;

    this.sensorsPromise = this.fetchSensors()
      .then(() => this.sensors)
      .finally(() => {
        this.sensorsPromise = null;
      });

    return this.sensorsPromise;
  }

  getRoutes(): MobileAirRoute[] {
    return this.routes;
  }

  clearRoutes(): void {
    this.routes = [];
  }
}
