import { BaseDataService } from "./BaseDataService";
import {
  MeasurementDevice,
  MobileAirSensor,
  MobileAirDataPoint,
  MobileAirRoute,
  MobileAirLiveSensor,
  MobileAirContextRaw,
  MobileAirMovingMode,
  MOBILEAIR_POLLUTANT_MAPPING,
  MOBILEAIR_TIMESTEP_MAPPING,
} from "../types";
import { pollutants } from "../constants/pollutants";
import { resolveSessionMoving } from "../constants/mobileAirMoving";
import { MOBILEAIR_LIVE_SOURCE } from "../constants/mobileAir";
import { isDevRuntime } from "../lib/env";

export class MobileAirService extends BaseDataService {
  private readonly baseUrl = this.getApiBaseUrl();
  private readonly contextBaseUrl = this.getContextBaseUrl();
  private sensors: MobileAirSensor[] = [];
  private routes: MobileAirRoute[] = [];
  /** Requête de catalogue en vol, pour dédupliquer les appels concurrents */
  private sensorsPromise: Promise<MobileAirSensor[]> | null = null;

  constructor() {
    super("mobileair");
  }

  private getRootUrl(): string {
    // Dev : rewrite Next `/aircarto` → api.aircarto.fr (voir next.config.ts).
    if (isDevRuntime()) {
      return "/aircarto";
    }
    return "https://api.aircarto.fr";
  }

  private getApiBaseUrl(): string {
    return `${this.getRootUrl()}/capteurs`;
  }

  private getContextBaseUrl(): string {
    return `${this.getRootUrl()}/context`;
  }

  async fetchData(params: {
    pollutant: string;
    timeStep: string;
    sources: string[];
    signalAirPeriod?: { startDate: string; endDate: string };
    mobileAirPeriod?: { startDate: string; endDate: string };
    mobileAirPeriods?: Record<string, { startDate: string; endDate: string }>;
    mobileAirPartialReplace?: boolean;
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
        return await this.fetchSensorData({
          pollutant: params.pollutant,
          timeStep: params.timeStep,
          selectedSensors: params.selectedSensors,
          mobileAirPeriod: params.mobileAirPeriod,
          mobileAirPeriods: params.mobileAirPeriods,
          mobileAirPartialReplace: params.mobileAirPartialReplace,
        });
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
    mobileAirPeriods?: Record<string, { startDate: string; endDate: string }>;
    mobileAirPartialReplace?: boolean;
  }): Promise<MeasurementDevice[]> {
    // Refetch partiel : ne retirer que les capteurs demandés, pour ne pas
    // effacer les parcours des autres capteurs déjà chargés.
    if (params.mobileAirPartialReplace) {
      this.removeRoutesForSensors(params.selectedSensors);
    } else {
      this.clearRoutes();
    }

    const results = await Promise.all(
      params.selectedSensors.map(async (sensorId) => {
        const sensor = this.sensors.find((s) => s.sensorId === sensorId);
        if (!sensor) {
          return {
            sensorId,
            routes: [] as MobileAirRoute[],
            error: false as const,
          };
        }

        try {
          const period =
            params.mobileAirPeriods?.[sensorId] ?? params.mobileAirPeriod;
          const timeRange = this.buildTimeRange(period, params.timeStep);
          const url = `${this.baseUrl}/dataMobileAir?capteurID=${sensor.sensorToken}&start=${timeRange.start}&end=${timeRange.end}&GPSnull=false&format=JSON`;

          const response = await this.makeRequest(url);

          if (!Array.isArray(response)) {
            return {
              sensorId,
              routes: [] as MobileAirRoute[],
              error: false as const,
            };
          }

          return {
            sensorId,
            routes: this.processSensorData(
              response,
              sensorId,
              params.pollutant
            ),
            error: false as const,
          };
        } catch (error) {
          console.error(
            `Erreur lors de la récupération des données pour le capteur ${sensorId}:`,
            error
          );
          return {
            sensorId,
            routes: [] as MobileAirRoute[],
            error: true as const,
          };
        }
      })
    );

    // Merge séquentiel après Promise.all pour éviter les courses sur this.routes.
    const devices: MeasurementDevice[] = [];
    for (const result of results) {
      this.routes.push(...result.routes);
      for (const route of result.routes) {
        devices.push(this.createRouteDevice(route, params.pollutant));
      }
    }

    return devices;
  }

  /** Retire les routes (et uniquement celles) des capteurs indiqués. */
  removeRoutesForSensors(sensorIds: string[]): void {
    const toRemove = new Set(sensorIds);
    this.routes = this.routes.filter((route) => !toRemove.has(route.sensorId));
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

      const moving = resolveSessionMoving(points);

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
        moving,
      });
    });

    return routes;
  }

  /**
   * Dernières mesures des MobileAir actifs (`liveMobileAir`).
   * Filtre les capteurs sans GPS (`fixed === null` / `points` vides).
   */
  async fetchLiveSensors(since: string = "5m"): Promise<MobileAirLiveSensor[]> {
    const url = `${this.baseUrl}/liveMobileAir?since=${encodeURIComponent(since)}`;
    const response = await this.makeRequest(url);
    if (!Array.isArray(response)) {
      return [];
    }
    return response
      .map((row) => this.normalizeLiveSensor(row))
      .filter((sensor): sensor is MobileAirLiveSensor => sensor !== null);
  }

  /**
   * Convertit les capteurs live en devices carte (`source: mobileair-live`).
   * Un CircleMarker = dernier point géolocalisé.
   */
  createLiveDevices(
    liveSensors: MobileAirLiveSensor[],
    pollutant: string
  ): MeasurementDevice[] {
    const pollutantKey = this.getPollutantKey(pollutant);
    const devices: MeasurementDevice[] = [];

    for (const sensor of liveSensors) {
      const lastPoint = sensor.points[sensor.points.length - 1];
      if (!lastPoint) continue;
      if (
        typeof lastPoint.lat !== "number" ||
        typeof lastPoint.lon !== "number" ||
        Number.isNaN(lastPoint.lat) ||
        Number.isNaN(lastPoint.lon)
      ) {
        continue;
      }

      const rawValue = lastPoint[
        pollutantKey as keyof MobileAirDataPoint
      ] as number;
      const value =
        typeof rawValue === "number" && !Number.isNaN(rawValue) ? rawValue : 0;
      const pollutantConfig = pollutants[pollutant];
      const qualityLevel = pollutantConfig
        ? this.getQualityLevel(value, pollutantConfig.thresholds)
        : "default";

      devices.push({
        id: `mobileair-live-${sensor.sensorId}`,
        name: `MobileAir live ${sensor.sensorId}`,
        latitude: lastPoint.lat,
        longitude: lastPoint.lon,
        source: MOBILEAIR_LIVE_SOURCE,
        pollutant,
        value,
        unit: "µg/m³",
        timestamp: lastPoint.time || sensor.lastSeen,
        status: "active",
        qualityLevel,
        mobileAirLive: sensor,
      } as MeasurementDevice & { mobileAirLive: MobileAirLiveSensor });
    }

    return devices;
  }

  /**
   * Format attendu par `get_context` : ISO sans millisecondes.
   * `toISOString()` → `…T00:00:00.000Z` est rejeté (400 Invalid start/end date format).
   */
  private formatContextApiDate(value: string): string {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return value;
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  /**
   * Signalements d’un capteur (`get_context`).
   * `sensorId` = nom (ex. mobileair-012), pas le token.
   */
  async fetchContext(
    sensorId: string,
    period?: { startDate: string; endDate: string }
  ): Promise<MobileAirContextRaw[]> {
    const params = new URLSearchParams({
      capteur_id: sensorId,
    });
    if (period?.startDate) {
      params.set("start", this.formatContextApiDate(period.startDate));
    }
    if (period?.endDate) {
      params.set("end", this.formatContextApiDate(period.endDate));
    }

    const url = `${this.contextBaseUrl}/get_context?${params.toString()}`;
    const response = await this.makeRequest(url);
    if (!Array.isArray(response)) {
      return [];
    }
    return response as MobileAirContextRaw[];
  }

  private normalizeLiveSensor(row: unknown): MobileAirLiveSensor | null {
    if (!row || typeof row !== "object") return null;
    const raw = row as Record<string, unknown>;
    const sensorId = String(raw.sensorId ?? "");
    const sensorToken = String(raw.sensorToken ?? "");
    if (!sensorId || !sensorToken) return null;

    const fixed =
      raw.fixed === true ? true : raw.fixed === false ? false : null;
    const points = Array.isArray(raw.points)
      ? (raw.points as MobileAirDataPoint[])
      : [];

    // Sans GPS : non plaçable
    if (fixed === null || points.length === 0) {
      return null;
    }

    const moving = this.normalizeMoving(raw.moving);

    return {
      id: Number(raw.id) || 0,
      sensorId,
      sensorToken,
      lastSeen: String(raw.lastSeen ?? ""),
      lastSeenSec: Number(raw.lastSeenSec) || 0,
      fixed,
      sessionId: Number(raw.sessionId) || 0,
      moving,
      points,
    };
  }

  private normalizeMoving(
    value: unknown
  ): MobileAirMovingMode | null {
    if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4) {
      return value;
    }
    if (typeof value === "string" && /^[0-4]$/.test(value)) {
      return Number(value) as MobileAirMovingMode;
    }
    return null;
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
