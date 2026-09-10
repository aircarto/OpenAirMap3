/// <reference types="vite/client" />
import { BaseDataService } from "./BaseDataService";
import {
  MeasurementDevice,
  NebuleAirSensor,
  NebuleAirMetadataResponse,
  NEBULEAIR_POLLUTANT_MAPPING,
  NEBULEAIR_TIMESTEP_MAPPING,
  TemporalDataPoint,
} from "../types";
import { getAirQualityLevel } from "../utils";
import { pollutants } from "../constants/pollutants";

export class NebuleAirService extends BaseDataService {
  private readonly BASE_URL = this.getApiBaseUrl();
  // Cache STATIQUE partagé entre toutes les instances pour éviter les requêtes multiples
  // Les métadonnées (capteurs) changent rarement, donc cache long (30 minutes)
  private static sensorsMetadataCache: NebuleAirSensor[] | null = null;
  private static lastMetadataFetch: number = 0;
  private static readonly METADATA_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - métadonnées changent rarement
  // Verrou pour éviter les appels API parallèles simultanés
  private static metadataFetchPromise: Promise<NebuleAirSensor[]> | null = null;

  constructor() {
    super("nebuleair");
  }

  private getApiBaseUrl(): string {
    // En développement, utiliser le proxy Vite
    if (import.meta.env.DEV) {
      return "/aircarto";
    }
    // En production, utiliser l'URL complète de l'API
    return "https://api.aircarto.fr";
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
      // Vérifier si le polluant est supporté par NebuleAir
      const nebuleAirPollutant = this.getNebuleAirPollutantName(
        params.pollutant
      );
      if (!nebuleAirPollutant) {
        console.warn(`Polluant ${params.pollutant} non supporté par NebuleAir`);
        return [];
      }

      // Vérifier si le pas de temps est supporté par NebuleAir
      const timeStepSuffix = this.getNebuleAirTimeStepSuffix(params.timeStep);
      if (timeStepSuffix === null) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par NebuleAir`
        );
        return [];
      }

      const pollutantConfig = pollutants[params.pollutant];

      // OPTIMISATION: Utiliser le cache au lieu de faire un appel API direct
      // Le cache contient déjà toutes les métadonnées des capteurs 
      const sensorsData = await this.getCachedSensorsMetadata();

      // Transformer les données en MeasurementDevice
      const devices: MeasurementDevice[] = [];
      let sensorsWithData = 0;
      let sensorsWithoutData = 0;

      for (const sensor of sensorsData) {
        // Vérifier si le capteur doit être affiché sur la carte
        if (!sensor.displayMap) {
          continue;
        }

        // Vérifier si le capteur a des coordonnées valides
        const lat = parseFloat(sensor.latitude);
        const lon = parseFloat(sensor.longitude);
        if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
          continue;
        }

        // Récupérer la valeur selon le polluant et le pas de temps
        const value = this.extractSensorValue(
          sensor,
          nebuleAirPollutant,
          timeStepSuffix
        );

        // Si le capteur ne mesure pas ce polluant (valeur null ou -1), l'ignorer complètement
        if (value === null || value === -1) {
          continue;
        }

        // Vérifier si la donnée est récente selon le pas de temps
        const isDataRecent = this.isDataRecent(sensor.time, params.timeStep);

        if (value === null || value === -1 || !isDataRecent) {
          // Capteur sans donnée valide ou donnée trop ancienne - utiliser le marqueur par défaut
          sensorsWithoutData++;
          devices.push({
            id: sensor.sensorId,
            name: `NebuleAir ${sensor.sensorId}`,
            latitude: lat,
            longitude: lon,
            source: this.sourceCode,
            pollutant: params.pollutant,
            value: 0,
            unit: pollutantConfig?.unit || "µg/m³",
            timestamp: sensor.time,
            status: "inactive",
            qualityLevel: "default",
          } as MeasurementDevice & { qualityLevel: string });
        } else {
          // Capteur avec donnée valide et récente - considérer comme actif
          sensorsWithData++;
          const pollutant = pollutants[params.pollutant];
          // Utiliser la valeur arrondie pour la cohérence avec l'affichage
          const roundedValue = Math.round(value);
          const qualityLevel =
            pollutant && pollutant.thresholds
              ? getAirQualityLevel(roundedValue, pollutant.thresholds)
              : "default";

          devices.push({
            id: sensor.sensorId,
            name: `NebuleAir ${sensor.sensorId}`,
            latitude: lat,
            longitude: lon,
            source: this.sourceCode,
            pollutant: params.pollutant,
            value: value, // Garder la valeur exacte pour les calculs
            unit: pollutantConfig?.unit || pollutant?.unit || "µg/m³",
            timestamp: sensor.time,
            status: "active", // Toujours actif si on a une valeur valide et récente
            qualityLevel,
          } as MeasurementDevice & { qualityLevel: string });
        }
      }

      return devices;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données NebuleAir:",
        error
      );
      throw error;
    }
  }

  private async fetchSensorsData(): Promise<NebuleAirSensor[]> {
    try {
      const url = `${this.BASE_URL}/capteurs/metadata?capteurType=NebuleAir&format=JSON&gas=true`;

      const response = await this.makeRequest(url);

      // Vérifier si la réponse est valide (pas de HTML)
      if (typeof response === "string" && response.includes("<html")) {
        return this.getMockSensorsData();
      }

      // L'API retourne directement un tableau de capteurs
      if (Array.isArray(response)) {
        // Filtrer les capteurs qui ont displayMap = true
        const displayableSensors = response.filter(
          (sensor) => sensor.displayMap === true
        );
        return displayableSensors;
      }

      // Si la réponse est encapsulée dans un objet
      if (response.sensors && Array.isArray(response.sensors)) {
        const displayableSensors = response.sensors.filter(
          (sensor) => sensor.displayMap === true
        );
        return displayableSensors;
      }

      if (response.data && Array.isArray(response.data)) {
        const displayableSensors = response.data.filter(
          (sensor) => sensor.displayMap === true
        );
        return displayableSensors;
      }

      return this.getMockSensorsData();
    } catch (error) {

      // Données simulées pour le développement - utiliser un capteur qui a des données historiques
      return this.getMockSensorsData();
    }
  }

  private getMockSensorsData(): NebuleAirSensor[] {
    return [
      {
        sensorId: "nebuleair-180", // Capteur qui a des données historiques réelles
        time: "2025-09-02T15:15:00Z",
        timeUTC: "2025-09-02T15:15:00Z",
        COV: "-1",
        NOISE: "56.4",
        PM1: "1.58",
        PM25: "2.33",
        PM10: "4.27",
        NOISE_qh: "55.8",
        PM1_qh: "1.58",
        PM25_qh: "2.33",
        PM10_qh: "4.27",
        NOISE_h: "54.6",
        PM1_h: "1.58",
        PM25_h: "2.33",
        PM10_h: "4.27",
        PM1_d: null,
        PM25_d: null,
        PM10_d: null,
        NOISE_d: null,
        TEMP: "27.37",
        HUM: "35.84",
        latitude: "43.2965",
        longitude: "5.3698",
        wifi_signal: "-80",
        AtmoSud: false,
        last_seen_sec: 1800,
        connected: true,
        displayMap: true,
        check_token: false,
        room: null,
        etage: null,
      },
      {
        sensorId: "nebuleair-pro6",
        time: "2024-11-14 14:18:04",
        timeUTC: "2024-11-14 13:18:04",
        COV: "-1",
        NOISE: "61.2",
        PM1: "2.5",
        PM25: "4.2",
        PM10: "10.8",
        NOISE_qh: "60.7",
        PM1_qh: "2.38",
        PM25_qh: "4.18",
        PM10_qh: "11.73",
        NOISE_h: "59.9",
        PM1_h: "2.15",
        PM25_h: "3.68",
        PM10_h: "7.45",
        PM1_d: null,
        PM25_d: null,
        PM10_d: null,
        NOISE_d: null,
        TEMP: "-1",
        HUM: "-1",
        latitude: "43.2965",
        longitude: "5.3698",
        wifi_signal: "-80",
        AtmoSud: false,
        last_seen_sec: 25299029,
        connected: true,
        displayMap: true,
        check_token: false,
        room: null,
        etage: null,
      },
      {
        sensorId: "nebuleair-182",
        time: "2025-02-07 18:29:43",
        timeUTC: "2025-02-07 17:29:43",
        COV: "-1",
        NOISE: "63.5",
        PM1: "7.50",
        PM25: "9.45",
        PM10: "9.70",
        NOISE_qh: "62.9",
        PM1_qh: "7.33",
        PM25_qh: "8.86",
        PM10_qh: "12.01",
        NOISE_h: "62.0",
        PM1_h: "7.43",
        PM25_h: "9.28",
        PM10_h: "12.46",
        PM1_d: null,
        PM25_d: null,
        PM10_d: null,
        NOISE_d: null,
        TEMP: "27.16",
        HUM: "26.21",
        latitude: "48.79460480",
        longitude: "2.12150390",
        wifi_signal: "-1",
        AtmoSud: false,
        last_seen_sec: 17939930,
        connected: true,
        displayMap: true,
        check_token: false,
        room: null,
        etage: null,
      },
      {
        sensorId: "nebuleair-test1",
        time: "2025-02-07 18:30:00",
        timeUTC: "2025-02-07 17:30:00",
        COV: "-1",
        NOISE: "57.1",
        PM1: "15.2",
        PM25: "18.7",
        PM10: "22.1",
        NOISE_qh: "56.4",
        PM1_qh: "14.8",
        PM25_qh: "18.2",
        PM10_qh: "21.5",
        NOISE_h: "55.7",
        PM1_h: "15.0",
        PM25_h: "18.5",
        PM10_h: "21.8",
        PM1_d: null,
        PM25_d: null,
        PM10_d: null,
        NOISE_d: null,
        TEMP: "20.5",
        HUM: "45.2",
        latitude: "43.7102",
        longitude: "7.262",
        wifi_signal: "-65",
        AtmoSud: false,
        last_seen_sec: 1800,
        connected: true,
        displayMap: true,
        check_token: false,
        room: null,
        etage: null,
      },
    ];
  }

  private getNebuleAirPollutantName(pollutant: string): string | null {
    // Mapping inverse : nos codes vers les codes NebuleAir
    const reverseMapping: Record<string, string> = {};
    Object.entries(NEBULEAIR_POLLUTANT_MAPPING).forEach(
      ([nebuleAir, ourCode]) => {
        reverseMapping[ourCode] = nebuleAir;
      }
    );

    return reverseMapping[pollutant] || null;
  }

  private getNebuleAirTimeStepSuffix(timeStep: string): string | null {
    return NEBULEAIR_TIMESTEP_MAPPING[timeStep] !== undefined
      ? NEBULEAIR_TIMESTEP_MAPPING[timeStep]
      : null;
  }

  private extractSensorValue(
    sensor: NebuleAirSensor,
    pollutant: string,
    timeStepSuffix: string
  ): number | null {
    // Construire le nom de la propriété selon le polluant et le pas de temps
    const propertyName = `${pollutant}${timeStepSuffix}`;

    // Récupérer la valeur depuis l'objet sensor
    let value = (sensor as any)[propertyName];

    // Pour le bruit (NOISE), seules les valeurs instantanées sont disponibles pour le moment
    if (
      (value === null || value === undefined || value === "-1") &&
      pollutant === "NOISE" &&
      timeStepSuffix !== ""
    ) {
      value = (sensor as any)["NOISE"];
    }

    if (value === null || value === undefined || value === "-1") {
      return null;
    }

    const numericValue = parseFloat(value);
    return isNaN(numericValue) ? null : numericValue;
  }

  private isDataRecent(timestamp: string, timeStep: string): boolean {
    try {
      const dataTime = new Date(timestamp);
      const now = new Date();
      const timeDiffMs = now.getTime() - dataTime.getTime();
      const timeDiffMinutes = timeDiffMs / (1000 * 60);

      // Définir les seuils de fraîcheur selon le pas de temps
      const freshnessThresholds: Record<string, number> = {
        instantane: 3 * 60, // 3 minutes pour les données instantanées
        deuxMin: 3, // 3 minutes pour les données 2min
        quartHeure: 16, // 16 minutes pour les données 15min
        heure: 61, // 61 minutes pour les données horaires
        jour: 24 * 60, // 24 heures pour les données journalières
      };

      const threshold = freshnessThresholds[timeStep];
      if (threshold === undefined) {
        console.warn(
          `Pas de temps non reconnu pour la vérification de fraîcheur: ${timeStep}`
        );
        return true; // Par défaut, considérer comme récent
      }

      return timeDiffMinutes <= threshold;
    } catch (error) {
      console.warn(
        `Erreur lors de la vérification de fraîcheur pour ${timestamp}:`,
        error
      );
      return false; // En cas d'erreur, considérer comme non récent
    }
  }

  // Méthode pour récupérer les variables disponibles d'un capteur
  async fetchSiteVariables(
    sensorId: string
  ): Promise<
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  > {
    try {
      // Récupérer les métadonnées du capteur
      const sensorsMetadata = await this.getCachedSensorsMetadata();
      const sensor = sensorsMetadata.find((s) => s.sensorId === sensorId);
      
      // Utiliser la méthode optimisée qui accepte les métadonnées
      return await this.fetchSiteVariablesWithMetadata(sensorId, sensor);
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des variables pour ${sensorId}:`,
        error
      );
      return {};
    }
  }

  // Méthode pour récupérer les métadonnées complètes d'un capteur (variables + last_seen_sec)
  async fetchSiteInfo(sensorId: string): Promise<{
    variables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    >;
    lastSeenSec?: number;
  }> {
    
    try {
      // OPTIMISATION: Récupérer les métadonnées une seule fois et les réutiliser
      // pour éviter deux appels au cache (un dans fetchSiteVariables, un ici)
      const sensorsMetadata = await this.getCachedSensorsMetadata();
      const sensor = sensorsMetadata.find((s) => s.sensorId === sensorId);

      // Récupérer les variables en passant les métadonnées pour éviter un deuxième appel
      const variables = await this.fetchSiteVariablesWithMetadata(sensorId, sensor);

      return {
        variables,
        lastSeenSec: sensor?.last_seen_sec,
      };
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des infos pour ${sensorId}:`,
        error
      );
      // En cas d'erreur, retourner des variables vides plutôt que de réessayer
      // pour éviter les boucles infinies
      return { variables: {} };
    }
  }
  
  // Version optimisée de fetchSiteVariables qui accepte les métadonnées en paramètre
  private async fetchSiteVariablesWithMetadata(
    sensorId: string,
    sensor?: NebuleAirSensor
  ): Promise<
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  > {
    const variables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    > = {};

    // Polluants toujours supportés par NebuleAir
    const alwaysSupportedPollutants = ["PM1", "PM25", "PM10"];

    alwaysSupportedPollutants.forEach((nebuleAirPollutant) => {
      // Convertir le code NebuleAir vers notre code interne
      const ourPollutantCode =
        NEBULEAIR_POLLUTANT_MAPPING[nebuleAirPollutant];
      if (ourPollutantCode) {
        variables[ourPollutantCode] = {
          label: this.getPollutantLabel(nebuleAirPollutant),
          code_iso: this.getPollutantCodeISO(nebuleAirPollutant),
          en_service: true,
        };
      }
    });

    // Vérifier si le capteur mesure vraiment le bruit et/ou NO2
    if (sensor) {
      // Vérifier si NOISE a une valeur valide (pas null, pas "-1")
      const noiseValue = sensor.NOISE;
      const noiseValueStr =
        typeof noiseValue === "string"
          ? noiseValue
          : String(noiseValue || "");
      const hasValidNoise =
        noiseValue !== null &&
        noiseValue !== undefined &&
        noiseValue !== "-1" &&
        noiseValueStr.trim() !== "";

      if (hasValidNoise) {
        const ourPollutantCode = NEBULEAIR_POLLUTANT_MAPPING["NOISE"];
        if (ourPollutantCode) {
          variables[ourPollutantCode] = {
            label: this.getPollutantLabel("NOISE"),
            code_iso: this.getPollutantCodeISO("NOISE"),
            en_service: true,
          };
        }
      }

      // Vérifier si NO2 a une valeur valide (pas null, pas "-1")
      const no2Value = sensor.NO2;
      const no2ValueStr =
        typeof no2Value === "string" ? no2Value : String(no2Value || "");
      const hasValidNo2 =
        no2Value !== null &&
        no2Value !== undefined &&
        no2Value !== "-1" &&
        no2ValueStr.trim() !== "";

      if (hasValidNo2) {
        const ourPollutantCode = NEBULEAIR_POLLUTANT_MAPPING["NO2"];
        if (ourPollutantCode) {
          variables[ourPollutantCode] = {
            label: this.getPollutantLabel("NO2"),
            code_iso: this.getPollutantCodeISO("NO2"),
            en_service: true,
          };
        }
      }
    }

    return variables;
  }

  private getPollutantLabel(pollutant: string): string {
    const labels: Record<string, string> = {
      PM1: "Particules PM₁",
      PM25: "Particules PM₂.₅",
      PM10: "Particules PM₁₀",
      NO2: "Dioxyde d'azote NO₂",
      NOISE: "Bruit",
    };
    return labels[pollutant] || pollutant;
  }

  private getPollutantCodeISO(pollutant: string): string {
    const codes: Record<string, string> = {
      PM1: "PM1",
      PM25: "PM2.5",
      PM10: "PM10",
      NO2: "NO2",
      NOISE: "dB(A)",
    };
    return codes[pollutant] || pollutant;
  }

  // Méthode pour récupérer les données historiques d'un capteur
  async fetchHistoricalData(params: {
    sensorId: string;
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
  }): Promise<Array<{ timestamp: string; value: number; unit: string }>> {
    try {
      // Vérifier si le polluant est supporté
      const nebuleAirPollutant = this.getNebuleAirPollutantName(
        params.pollutant
      );
      if (!nebuleAirPollutant) {
        console.warn(`Polluant ${params.pollutant} non supporté par NebuleAir`);
        return [];
      }

      // Convertir les dates au format attendu par l'API
      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);
      const now = new Date();

      // CORRECTION : Utiliser des dates absolues (ISO) au lieu du format relatif
      // Cela garantit que toutes les sources (AtmoRef, AtmoMicro, NebuleAir) utilisent exactement la même période
      // même si l'utilisateur ajoute des sources à des moments différents
      // L'API NebuleAir accepte les dates ISO en format absolu pour start et stop
      // Format attendu : 2019-09-16T12:00:00Z (sans millisecondes)

      // Formater les dates au format ISO sans millisecondes (format attendu par l'API NebuleAir)
      const start = this.formatDateForNebuleAirAPI(startDate);

      // IMPORTANT : l'API AirCarto attend le paramètre "end" (et NON "stop", qui est
      // ignoré côté serveur et renvoie systématiquement les données jusqu'à maintenant).
      // Utiliser "now" si endDate est très proche de maintenant (dans les 5 minutes)
      // pour récupérer les toutes dernières données ; sinon utiliser la date absolue
      // afin de respecter strictement la période demandée (ex : période personnalisée).
      const timeDiffFromNow = Math.abs(now.getTime() - endDate.getTime());
      const fiveMinutes = 5 * 60 * 1000;

      let end: string;
      if (timeDiffFromNow <= fiveMinutes) {
        end = "now";
      } else {
        end = this.formatDateForNebuleAirAPI(endDate);
      }

      // Convertir le pas de temps au format de l'API
      const freq = this.convertTimeStepToFreq(params.timeStep);

      // Construire l'URL pour les données historiques selon l'exemple fourni
      // Encoder les paramètres start et end pour l'URL
      const url = `${this.BASE_URL}/capteurs/dataNebuleAir?capteurID=${
        params.sensorId
      }&start=${encodeURIComponent(start)}&end=${encodeURIComponent(
        end
      )}&freq=${freq}&gas=true`;

      const response = await this.makeRequest(url);

      // L'API retourne directement un tableau de données
      if (!Array.isArray(response)) {
        console.warn(
          "Format de réponse historique NebuleAir non reconnu:",
          response
        );
        return [];
      }

      // Transformer les données historiques
      const historicalData = response
        .map((dataPoint: any, index: number) => {
          // Extraire la valeur selon le polluant
          const value = this.extractHistoricalValue(
            dataPoint,
            nebuleAirPollutant
          );

          // Extraire le timestamp (l'API NebuleAir utilise "time")
          const timestamp =
            dataPoint.timestamp || dataPoint.time || dataPoint.date;

          if (value === null || value === undefined) {
            return null;
          }

          if (!timestamp) {
            return null;
          }

          return {
            timestamp: timestamp,
            value: value,
            unit: "µg/m³",
          };
        })
        .filter(
          (item): item is { timestamp: string; value: number; unit: string } =>
            item !== null
        );

      // Trier les données par timestamp pour s'assurer qu'elles sont dans l'ordre chronologique
      historicalData.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateA - dateB;
      });

      return historicalData;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données historiques NebuleAir:",
        error
      );
      throw error;
    }
  }

  // Fonction pour formater les dates selon les besoins du mode historique
  private formatDateForHistoricalMode(
    dateString: string,
    isEndDate: boolean = false
  ): string {
    // Vérifier si la chaîne contient une composante horaire
    const hasTimeComponent = /T\d{2}:\d{2}/.test(dateString);

    if (!hasTimeComponent) {
      // Si pas d'heure, traiter comme une date locale (YYYY-MM-DD)
      // Parser la date locale
      const [year, month, day] = dateString.split("-").map(Number);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(
          `Format de date invalide: ${dateString}. Format attendu: YYYY-MM-DD`
        );
      }

      // CORRECTION : Créer une date locale d'abord, puis convertir en UTC
      // Pour la date de début : minuit local = 23h UTC la veille (si UTC+1)
      // Pour la date de fin : minuit local du jour suivant = 23h UTC du jour sélectionné (si UTC+1)
      // Exemple : date de fin "02/12/2025" → minuit local du 3 = 23h UTC du 2 décembre
      // Cela garantit que la date de fin est toujours après la date de début
      if (isEndDate) {
        // Date de fin : créer minuit local du jour suivant pour couvrir toute la journée
        // La conversion en UTC donne 23h UTC du jour sélectionné
        const localNextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
        return localNextDay.toISOString();
      } else {
        // Date de début : créer minuit local, la conversion en UTC donne automatiquement 23h UTC la veille
        const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        return localDate.toISOString();
      }
    }

    // Si la date contient déjà une heure, la préserver telle quelle
    // C'est le cas pour les périodes prédéfinies (3h, 24h, 7d, 30d) qui arrivent avec l'heure exacte
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Date invalide: ${dateString}`);
    }

    // Préserver l'heure existante - ne pas forcer à 00:00:00 ou 23:59:59
    // Cela permet de respecter exactement la période demandée (ex: 24h exactement)
    return date.toISOString();
  }

  // Fonction pour formater une date au format attendu par l'API NebuleAir
  // Format attendu : 2019-09-16T12:00:00Z (sans millisecondes)
  private formatDateForNebuleAirAPI(date: Date): string {
    // toISOString() retourne 2019-09-16T12:00:00.000Z
    // On doit enlever les millisecondes pour avoir 2019-09-16T12:00:00Z
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  // Méthode pour convertir le pas de temps au format de l'API
  private convertTimeStepToFreq(timeStep: string): string {
    const timeStepMapping: Record<string, string> = {
      instantane: "2m", // Scan -> 2 minutes
      deuxMin: "2m", // ≤2min -> 2 minutes
      quartHeure: "15m", // 15 minutes
      heure: "1h", // 1 heure
      jour: "1d", // 1 jour
    };

    return timeStepMapping[timeStep] || "2m"; // Par défaut 2 minutes
  }

  // Méthode pour extraire la valeur d'un point de données historique
  private extractHistoricalValue(
    dataPoint: any,
    pollutant: string
  ): number | null {
    // L'API retourne les valeurs directement par nom de polluant (PM1, PM25, PM10, NO2)
    const value = dataPoint[pollutant];

    if (value === null || value === undefined || value === "-1") {
      return null;
    }

    const numericValue = parseFloat(value);
    return isNaN(numericValue) ? null : numericValue;
  }

  // Méthode pour récupérer les données temporelles pour la visualisation historique
  async fetchTemporalData(params: {
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
    selectedSensors?: string[];
    sensorsMetadata?: NebuleAirSensor[]; // Métadonnées des capteurs (optionnel)
  }): Promise<TemporalDataPoint[]> {
    try {
      // Vérifier si le polluant est supporté par NebuleAir
      const nebuleAirPollutant = this.getNebuleAirPollutantName(
        params.pollutant
      );
      if (!nebuleAirPollutant) {
        console.warn(`Polluant ${params.pollutant} non supporté par NebuleAir`);
        return [];
      }

      // Convertir le pas de temps au format de l'API
      const freq = this.convertTimeStepToFreq(params.timeStep);

      // Formater les dates au format ISO pour l'API
      const startDateFormatted = this.formatDateForHistoricalMode(
        params.startDate,
        false
      );
      const endDateFormatted = this.formatDateForHistoricalMode(
        params.endDate,
        true
      );

      // Convertir en Date puis formater au format attendu par l'API NebuleAir (sans millisecondes)
      const startDate = new Date(startDateFormatted);
      const endDate = new Date(endDateFormatted);
      const start = this.formatDateForNebuleAirAPI(startDate);
      const end = this.formatDateForNebuleAirAPI(endDate);

      // Construire l'URL pour récupérer toutes les données des capteurs
      const url = `${
        this.BASE_URL
      }/capteurs/dataNebuleAirAll?start=${encodeURIComponent(
        start
      )}&end=${encodeURIComponent(end)}&freq=${freq}&format=JSON&gas=true`;

      const response = await this.makeRequest(url);

      // L'API retourne un objet avec les capteurs comme clés
      if (!response || typeof response !== "object") {
        return [];
      }

      // Récupérer les métadonnées des capteurs pour avoir les coordonnées
      // Utiliser les métadonnées fournies en paramètre ou le cache
      let sensorsMetadata: NebuleAirSensor[];
      if (params.sensorsMetadata) {
        sensorsMetadata = params.sensorsMetadata;
      } else {
        sensorsMetadata = await this.getCachedSensorsMetadata();
      }

      const sensorsMap = new Map<string, NebuleAirSensor>();
      sensorsMetadata.forEach((sensor) => {
        sensorsMap.set(sensor.sensorId, sensor);
      });

      // Transformer les données en TemporalDataPoint
      const temporalDataPoints: TemporalDataPoint[] = [];
      const timestampMap = new Map<string, MeasurementDevice[]>();

      // Parcourir tous les capteurs dans la réponse
      for (const [sensorId, sensorData] of Object.entries(response)) {
        // Vérifier si ce capteur doit être inclus
        if (
          params.selectedSensors &&
          !params.selectedSensors.includes(sensorId)
        ) {
          continue;
        }

        // Récupérer les métadonnées du capteur
        const sensorMetadata = sensorsMap.get(sensorId);
        if (!sensorMetadata || !sensorMetadata.displayMap) {
          continue;
        }

        // Vérifier les coordonnées
        const lat = parseFloat(sensorMetadata.latitude);
        const lon = parseFloat(sensorMetadata.longitude);
        if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
          continue;
        }

        // Parcourir les données temporelles du capteur
        if (Array.isArray(sensorData)) {
          sensorData.forEach((dataPoint: any) => {
            const timestamp = dataPoint.time || dataPoint.timestamp;
            if (!timestamp) return;

            // Extraire la valeur selon le polluant
            const value = this.extractHistoricalValue(
              dataPoint,
              nebuleAirPollutant
            );
            // Ne créer le device que si la valeur est valide
            if (
              value === null ||
              value === undefined ||
              value === -1 ||
              isNaN(value) ||
              typeof value !== "number"
            ) {
              return;
            }

            // Créer le device de mesure
            const device: MeasurementDevice = {
              id: sensorId,
              name: `NebuleAir ${sensorId}`,
              latitude: lat,
              longitude: lon,
              source: this.sourceCode,
              pollutant: params.pollutant,
              value: value,
              unit: "µg/m³",
              timestamp: timestamp,
              status: "active",
              qualityLevel: this.getQualityLevel(value, params.pollutant),
            } as MeasurementDevice & { qualityLevel: string };

            // Grouper par timestamp
            if (!timestampMap.has(timestamp)) {
              timestampMap.set(timestamp, []);
            }
            timestampMap.get(timestamp)!.push(device);
          });
        }
      }

      // Convertir en TemporalDataPoint
      for (const [timestamp, devices] of timestampMap.entries()) {
        if (devices.length === 0) continue;

        // Calculer les métadonnées
        const values = devices.map((d) => d.value);
        const averageValue =
          values.reduce((sum, val) => sum + val, 0) / values.length;

        const qualityLevels: Record<string, number> = {};
        devices.forEach((device) => {
          const qualityLevel = (device as any).qualityLevel || "default";
          qualityLevels[qualityLevel] = (qualityLevels[qualityLevel] || 0) + 1;
        });

        temporalDataPoints.push({
          timestamp,
          devices,
          deviceCount: devices.length,
          averageValue,
          qualityLevels,
        });
      }

      // Trier par timestamp
      temporalDataPoints.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return temporalDataPoints;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données temporelles:",
        error
      );
      throw error;
    }
  }

  // Méthode utilitaire pour calculer le niveau de qualité
  private getQualityLevel(value: number, pollutant: string): string {
    const pollutantConfig = pollutants[pollutant];
    if (!pollutantConfig) return "default";

    const thresholds = pollutantConfig.thresholds;
    if (value <= thresholds.bon.max) return "bon";
    if (value <= thresholds.moyen.max) return "moyen";
    if (value <= thresholds.degrade.max) return "degrade";
    if (value <= thresholds.mauvais.max) return "mauvais";
    if (value <= thresholds.tresMauvais.max) return "tresMauvais";
    return "extrMauvais";
  }

  // Méthode pour récupérer les métadonnées avec cache STATIQUE partagé et verrou
  private async getCachedSensorsMetadata(): Promise<NebuleAirSensor[]> {
    const now = Date.now();
    const cacheAge = NebuleAirService.lastMetadataFetch ? 
      Math.round((now - NebuleAirService.lastMetadataFetch) / 1000) : null;
    const cacheValid = NebuleAirService.sensorsMetadataCache &&
      now - NebuleAirService.lastMetadataFetch < NebuleAirService.METADATA_CACHE_DURATION;

    // Vérifier si le cache STATIQUE est valide
    if (cacheValid && NebuleAirService.sensorsMetadataCache) {
      return NebuleAirService.sensorsMetadataCache;
    }

    // Si un fetch est déjà en cours, attendre sa completion au lieu d'en lancer un nouveau
    if (NebuleAirService.metadataFetchPromise) {
      return await NebuleAirService.metadataFetchPromise;
    }

    // Récupérer les métadonnées et mettre à jour le cache STATIQUE
    
    // Créer une promesse partagée pour éviter les appels parallèles
    NebuleAirService.metadataFetchPromise = (async (): Promise<NebuleAirSensor[]> => {
      try {
        const sensors = await this.fetchSensorsData();
        NebuleAirService.sensorsMetadataCache = sensors;
        NebuleAirService.lastMetadataFetch = Date.now();
        return sensors;
      } finally {
        // Libérer le verrou une fois terminé
        NebuleAirService.metadataFetchPromise = null;
      }
    })();

    return await NebuleAirService.metadataFetchPromise;
  }

  // Méthode pour récupérer les coordonnées d'un capteur
  async fetchSensorCoordinates(
    sensorId: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const sensorsMetadata = await this.getCachedSensorsMetadata();
      const sensor = sensorsMetadata.find((s) => s.sensorId === sensorId);

      if (!sensor) {
        console.warn(`Capteur ${sensorId} non trouvé dans les métadonnées`);
        return null;
      }

      const lat = parseFloat(sensor.latitude);
      const lon = parseFloat(sensor.longitude);

      if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
        console.warn(`Coordonnées invalides pour le capteur ${sensorId}`);
        return null;
      }

      return {
        latitude: lat,
        longitude: lon,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des coordonnées du capteur NebuleAir:",
        error
      );
      return null;
    }
  }
}
