import { BaseDataService } from "./BaseDataService";
import {
  MeasurementDevice,
  AtmoRefStationsResponse,
  AtmoRefMeasuresResponse,
  AtmoRefStation,
  AtmoRefMeasure,
  ATMOREF_POLLUTANT_MAPPING,
  TemporalDataPoint,
} from "../types";
import { getAirQualityLevel } from "../utils";
import { pollutants } from "../constants/pollutants";
import { isHttpNotFound } from "../utils/instantSnapshot";

const hasValidCoordinates = (station: AtmoRefStation): boolean =>
  typeof station.latitude === "number" &&
  typeof station.longitude === "number" &&
  !Number.isNaN(station.latitude) &&
  !Number.isNaN(station.longitude);

export class AtmoRefService extends BaseDataService {
  private readonly BASE_URL = "https://api.atmosud.org/observations";
  
  // Cache STATIQUE partagé entre toutes les instances pour éviter les requêtes multiples
  // Les métadonnées (stations) changent rarement, donc cache long (30 minutes)
  private static stationsCache: AtmoRefStation[] | null = null;
  private static lastStationsFetch: number = 0;
  private static readonly STATIONS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - métadonnées changent rarement
  // Verrou pour éviter les appels API parallèles simultanés
  private static stationsFetchPromise: Promise<AtmoRefStation[]> | null = null;

  constructor() {
    super("atmoRef");
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
      // Mapping du polluant vers le nom AtmoSud
      const atmoRefPollutantName = this.getAtmoRefPollutantName(
        params.pollutant
      );
      if (!atmoRefPollutantName) {
        console.warn(`Polluant ${params.pollutant} non supporté par AtmoRef`);
        return [];
      }

      // Vérifier si le pas de temps est supporté par AtmoRef
      const timeStepConfig = this.getAtmoRefTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par AtmoRef`
        );
        return [];
      }

      // Faire les deux appels API en parallèle
      const [stationsResponse, measuresResponse] = await Promise.all([
        this.fetchStations(atmoRefPollutantName),
        this.fetchMeasures(
          atmoRefPollutantName,
          timeStepConfig.temporalite,
          timeStepConfig.delais
        ),
      ]);

      // Vérifier si les réponses sont valides
      if (!stationsResponse.stations || !measuresResponse.mesures) {
        console.warn("Aucune donnée reçue d'AtmoRef");
        return [];
      }

      // Obtenir le code ISO correspondant au polluant pour filtrer les stations
      const pollutantIsoCode = this.getPollutantIsoCode(params.pollutant);
      
      // Filtrer les stations pour ne garder que celles où le polluant est en service
      const filteredStations = stationsResponse.stations.filter((station) => {
        if (!station.variables || !pollutantIsoCode) {
          return false;
        }
        
        // Vérifier si le polluant est présent dans variables avec en_service = true
        const variable = station.variables[pollutantIsoCode];
        return variable && variable.en_service === true;
      });

      // Créer un map des mesures par ID de station pour un accès rapide
      const measuresMap = new Map<string, AtmoRefMeasure>();
      measuresResponse.mesures.forEach((measure) => {
        measuresMap.set(measure.id_station, measure);
      });

      // Transformer les stations en MeasurementDevice
      const devices: MeasurementDevice[] = [];

      for (const station of filteredStations) {
        if (!hasValidCoordinates(station)) {
          continue;
        }

        const measure = measuresMap.get(station.id_station);

        if (measure) {
          // Station avec mesure disponible
          const pollutant = pollutants[params.pollutant];
          const qualityLevel = getAirQualityLevel(
            measure.valeur,
            pollutant.thresholds
          );

          devices.push({
            id: station.id_station,
            name: station.nom_station,
            latitude: station.latitude,
            longitude: station.longitude,
            source: this.sourceCode,
            pollutant: params.pollutant,
            value: measure.valeur,
            unit: measure.unite,
            timestamp: measure.date_debut,
            status: "active",
            // Propriétés supplémentaires pour le marqueur
            qualityLevel,
            address: station.adresse,
            departmentId: station.departement_id,
          } as MeasurementDevice & { qualityLevel: string; address: string; departmentId: string });
        } else {
          // Station sans mesure récente - utiliser le marqueur par défaut
          devices.push({
            id: station.id_station,
            name: station.nom_station,
            latitude: station.latitude,
            longitude: station.longitude,
            source: this.sourceCode,
            pollutant: params.pollutant,
            value: 0,
            unit: "µg/m³",
            timestamp: new Date().toISOString(),
            status: "inactive",
            // Propriétés supplémentaires pour le marqueur
            qualityLevel: "default",
            address: station.adresse,
            departmentId: station.departement_id,
          } as MeasurementDevice & { qualityLevel: string; address: string; departmentId: string });
        }
      }

      return devices;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données AtmoRef:",
        error
      );
      throw error;
    }
  }

  private async fetchStations(
    pollutantName: string
  ): Promise<AtmoRefStationsResponse> {
    // OPTIMISATION: Utiliser le cache au lieu de faire un appel API direct
    // Le cache contient déjà toutes les stations avec métadonnées
    const allStations = await this.getCachedAllStations();
    
    // Obtenir le code ISO correspondant au polluant pour filtrer les stations
    const pollutantIsoCode = this.getPollutantIsoCodeFromName(pollutantName);
    
    // Filtrer les stations pour ne garder que celles où le polluant est en service
    const filteredStations = allStations.filter((station) => {
      if (!station.variables || !pollutantIsoCode) {
        return false;
      }
      
      // Vérifier si le polluant est présent dans variables avec en_service = true
      const variable = station.variables[pollutantIsoCode];
      return variable && variable.en_service === true;
    });
    
    return { stations: filteredStations };
  }
  
  // Méthode helper pour obtenir le code ISO depuis le nom du polluant AtmoSud
  private getPollutantIsoCodeFromName(pollutantName: string): string | null {
    // Mapping des noms AtmoSud vers les codes ISO
    // Ces codes doivent correspondre à ATMOREF_POLLUTANT_MAPPING dans types/index.ts
    const nameToIsoCode: Record<string, string> = {
      "pm2.5": "39", // PM2.5
      "pm10": "24",  // PM10 - CORRECTION: code ISO correct est "24", pas "40"
      "pm1": "68",   // PM1 - CORRECTION: code ISO correct est "68", pas "41"
      "no2": "03",   // NO2
      "o3": "08",    // O3 - CORRECTION: code ISO correct est "08", pas "07"
      "so2": "01",   // SO2
    };
    
    return nameToIsoCode[pollutantName.toLowerCase()] || null;
  }

  private async fetchMeasures(
    pollutantName: string,
    temporalite: string,
    delais: number
  ): Promise<AtmoRefMeasuresResponse> {
    const url = `${this.BASE_URL}/stations/mesures/derniere?format=json&nom_polluant=${pollutantName}&temporalite=${temporalite}&delais=${delais}&download=false`;
    return await this.makeRequest(url);
  }

  private getAtmoRefPollutantName(pollutant: string): string | null {
    // Mapping de nos codes vers les noms AtmoSud
    const pollutantNameMapping: Record<string, string> = {
      pm25: "pm2.5",
      pm10: "pm10",
      pm1: "pm1",
      no2: "no2",
      o3: "o3",
      so2: "so2",
    };

    return pollutantNameMapping[pollutant] || null;
  }

  private getPollutantIsoCode(pollutant: string): string | null {
    // Mapping inverse : de nos codes vers les codes ISO AtmoRef
    // ATMOREF_POLLUTANT_MAPPING : { "01": "so2", "03": "no2", "39": "pm25", ... }
    // On cherche le code ISO qui correspond à notre polluant
    for (const [isoCode, pollutantCode] of Object.entries(ATMOREF_POLLUTANT_MAPPING)) {
      if (pollutantCode === pollutant) {
        return isoCode;
      }
    }
    return null;
  }

  private getAtmoRefTimeStepConfig(
    timeStep: string
  ): { temporalite: string; delais: number } | null {
    // Configuration des pas de temps supportés par AtmoRef
    const timeStepConfigs: Record<
      string,
      { temporalite: string; delais: number }
    > = {
      instantane: { temporalite: "quart-horaire", delais: 181 }, // Scan -> quart-horaire avec délai 181
      quartHeure: { temporalite: "quart-horaire", delais: 19 }, // 15 minutes -> quart-horaire avec délai 19
      heure: { temporalite: "horaire", delais: 64 }, // Heure -> horaire avec délai 64
      jour: { temporalite: "journalière", delais: 1444 }, // Jour -> journalière avec délai 1444
    };

    return timeStepConfigs[timeStep] || null;
  }

  // Méthode pour récupérer les données historiques d'une station
  async fetchHistoricalData(params: {
    stationId: string;
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
  }): Promise<Array<{ timestamp: string; value: number; unit: string }>> {
    try {
      // Mapping du polluant vers le nom AtmoSud
      const atmoRefPollutantName = this.getAtmoRefPollutantName(
        params.pollutant
      );
      if (!atmoRefPollutantName) {
        console.warn(`Polluant ${params.pollutant} non supporté par AtmoRef`);
        return [];
      }

      // Configuration du pas de temps
      const timeStepConfig = this.getAtmoRefTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par AtmoRef`
        );
        return [];
      }

      // Formater les dates pour le mode historique
      const formattedStartDate = this.formatDateForHistoricalMode(
        params.startDate,
        false
      );
      const formattedEndDate = this.formatDateForHistoricalMode(
        params.endDate,
        true
      );

      // Construire l'URL pour les données historiques avec le bon endpoint
      const url = `${this.BASE_URL}/stations/mesures?format=json&station_id=${params.stationId}&nom_polluant=${atmoRefPollutantName}&temporalite=${timeStepConfig.temporalite}&download=false&metadata=true&date_debut=${formattedStartDate}&date_fin=${formattedEndDate}`;

      const response = await this.makeRequest(url);

      if (!response.mesures) {
        console.warn("Aucune donnée historique reçue d'AtmoRef");
        return [];
      }

      // Transformer les données historiques
      const historicalData = response.mesures
      .filter((measure: AtmoRefMeasure) => measure.valeur !== null && measure.valeur !== undefined).map(
        (measure: AtmoRefMeasure) => ({
          timestamp: measure.date_debut,
          value: measure.valeur,
          unit: measure.unite,
        })
      );

      return historicalData;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données historiques AtmoRef:",
        error
      );
      throw error;
    }
  }

  // Méthode pour récupérer toutes les stations avec cache STATIQUE partagé et verrou
  private async getCachedAllStations(): Promise<AtmoRefStation[]> {
    const now = Date.now();
    const cacheAge = AtmoRefService.lastStationsFetch ? 
      Math.round((now - AtmoRefService.lastStationsFetch) / 1000) : null;
    const cacheValid = AtmoRefService.stationsCache &&
      now - AtmoRefService.lastStationsFetch < AtmoRefService.STATIONS_CACHE_DURATION;

    // Vérifier si le cache STATIQUE est valide
    if (cacheValid && AtmoRefService.stationsCache) {
      return AtmoRefService.stationsCache;
    }

    // Si un fetch est déjà en cours, attendre sa completion au lieu d'en lancer un nouveau
    if (AtmoRefService.stationsFetchPromise) {
      return await AtmoRefService.stationsFetchPromise;
    }

    // Récupérer toutes les stations et mettre à jour le cache STATIQUE
    
    // Créer une promesse partagée pour éviter les appels parallèles
    AtmoRefService.stationsFetchPromise = (async (): Promise<AtmoRefStation[]> => {
      try {
        // Récupérer toutes les stations actives (sans filtre de polluant pour avoir toutes les métadonnées)
        const url = `${this.BASE_URL}/stations?format=json&station_en_service=true&polluant_en_service=true&download=false&metadata=true`;
        const response = await this.makeRequest(url);
        const stations = response.stations || [];
        AtmoRefService.stationsCache = stations;
        AtmoRefService.lastStationsFetch = Date.now();
        return stations;
      } finally {
        // Libérer le verrou une fois terminé
        AtmoRefService.stationsFetchPromise = null;
      }
    })();

    return await AtmoRefService.stationsFetchPromise;
  }

  // Méthode pour récupérer les variables disponibles d'une station
  async fetchStationVariables(
    stationId: string
  ): Promise<
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  > {
    try {
      // Utiliser le cache au lieu de faire un appel API par station
      const allStations = await this.getCachedAllStations();
      const station = allStations.find(
        (s: AtmoRefStation) => s.id_station === stationId
      );
      if (!station) {
        console.warn(`Station ${stationId} non trouvée dans le cache`);
        return {};
      }

      return station.variables || {};
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des variables de la station:",
        error
      );
      throw error;
    }
  }

  // Méthode pour récupérer les coordonnées d'une station
  async fetchStationCoordinates(
    stationId: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Utiliser le cache au lieu de faire un appel API par station
      const allStations = await this.getCachedAllStations();
      const station = allStations.find(
        (s: AtmoRefStation) => s.id_station === stationId
      );
      if (!station) {
        console.warn(`Station ${stationId} non trouvée dans le cache`);
        return null;
      }

      return {
        latitude: station.latitude,
        longitude: station.longitude,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des coordonnées de la station:",
        error
      );
      return null;
    }
  }

  // Méthode pour récupérer les données temporelles AtmoRef
  async fetchTemporalData(params: {
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
  }): Promise<TemporalDataPoint[]> {
    try {

      // Mapping du polluant vers le nom AtmoSud
      const atmoRefPollutantName = this.getAtmoRefPollutantName(
        params.pollutant
      );
      if (!atmoRefPollutantName) {
        console.warn(`Polluant ${params.pollutant} non supporté par AtmoRef`);
        return [];
      }

      // Configuration du pas de temps
      const timeStepConfig = this.getAtmoRefTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par AtmoRef`
        );
        return [];
      }

      // Récupérer les stations d'abord pour avoir les coordonnées
      // fetchStations() utilise maintenant le cache et filtre déjà par polluant
      const stationsResponse = await this.fetchStations(atmoRefPollutantName);
      if (!stationsResponse.stations || stationsResponse.stations.length === 0) {
        console.warn("Aucune station trouvée pour AtmoRef");
        return [];
      }

      // Les stations sont déjà filtrées par polluant dans fetchStations()
      const filteredStations = stationsResponse.stations;

      // Créer un map des stations par ID pour un accès rapide
      const stationsMap = new Map<string, AtmoRefStation>();
      filteredStations.forEach((station) => {
        stationsMap.set(station.id_station, station);
      });

      // Diviser la période en chunks de 30 jours pour éviter les timeouts
      const chunkSize = 30; // 30 jours
      
      // CORRECTION : Convertir les dates locales en UTC correctement
      // Les dates arrivent en format YYYY-MM-DD et doivent être interprétées comme locales
      const startDateISO = this.formatDateForHistoricalMode(params.startDate, false);
      const endDateISO = this.formatDateForHistoricalMode(params.endDate, true);
      
      // Parser les dates ISO pour calculer les chunks
      const start = new Date(startDateISO);
      const end = new Date(endDateISO);
      
      const temporalData: TemporalDataPoint[] = [];

      // Calculer le nombre de chunks
      const totalDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const chunks = Math.ceil(totalDays / chunkSize);

      // Traiter chaque chunk
      for (let i = 0; i < chunks; i++) {
        // CORRECTION : Utiliser UTC pour éviter les décalages de fuseau horaire
        const chunkStart = new Date(start.getTime() + i * chunkSize * 24 * 60 * 60 * 1000);
        
        const chunkEnd = new Date(chunkStart.getTime() + (chunkSize - 1) * 24 * 60 * 60 * 1000);

        // S'assurer qu'on ne dépasse pas la date de fin
        if (chunkEnd > end) {
          chunkEnd.setTime(end.getTime());
        }

        try {
          // Utiliser les dates formatées pour le premier et dernier chunk
          const isFirstChunk = i === 0;
          const isLastChunk = i === chunks - 1;
          
          const chunkStartISO = isFirstChunk 
            ? startDateISO // Utiliser la date de début formatée initialement
            : chunkStart.toISOString();
            
          const chunkEndISO = isLastChunk
            ? endDateISO // Utiliser la date de fin formatée initialement
            : chunkEnd.toISOString();
          
          const chunkData = await this.fetchTemporalDataChunk(
            atmoRefPollutantName,
            timeStepConfig.temporalite,
            chunkStartISO,
            chunkEndISO,
            stationsMap,
            params.pollutant
          );
          temporalData.push(...chunkData);
        } catch (error) {
          // 404 AtmoSud = créneau sans mesures → série vide, pas une panne
          if (isHttpNotFound(error)) {
            continue;
          }
          console.warn(
            `Erreur lors de la récupération des données pour la période ${chunkStart.toISOString()} - ${chunkEnd.toISOString()}:`,
            error
          );
          // Continuer avec les autres chunks même si un échoue
        }
      }

      // Trier les données par timestamp
      temporalData.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return temporalData;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données temporelles AtmoRef:",
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
      const [year, month, day] = dateString.split('-').map(Number);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(`Format de date invalide: ${dateString}. Format attendu: YYYY-MM-DD`);
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

  private async fetchTemporalDataChunk(
    pollutantName: string,
    temporalite: string,
    startDate: string,
    endDate: string,
    stationsMap: Map<string, AtmoRefStation>,
    pollutant: string
  ): Promise<TemporalDataPoint[]> {
    // Les dates sont déjà formatées correctement par fetchTemporalData
    // On les utilise directement pour éviter un double formatage qui annulerait la conversion locale
    const formattedStartDate = startDate;
    const formattedEndDate = endDate;

    const url = `${
      this.BASE_URL
    }/stations/mesures?nom_polluant=${pollutantName}&date_debut=${encodeURIComponent(
      formattedStartDate
    )}&date_fin=${encodeURIComponent(
      formattedEndDate
    )}&temporalite=${temporalite}&metadata=false&only_validate_values=true&format=json&download=false`;

    try {
      // 404 = aucune mesure pour la fenêtre (créneau pas encore publié)
      const response = await this.makeRequest(url, {
        emptyOnHttpStatuses: [404],
      });

      // L'API AtmoRef retourne un objet avec une propriété 'mesures'
      if (!response || !response.mesures || !Array.isArray(response.mesures)) {
        return [];
      }

      const measures = response.mesures;

      // Grouper les mesures par timestamp
      const measuresByTimestamp = new Map<string, any[]>();

      measures.forEach((measure: any) => {
        const timestamp = measure.date_debut;
        if (!measuresByTimestamp.has(timestamp)) {
          measuresByTimestamp.set(timestamp, []);
        }
        measuresByTimestamp.get(timestamp)!.push(measure);
      });

      // Créer les TemporalDataPoint
      const temporalDataPoints: TemporalDataPoint[] = [];

      for (const [timestamp, measures] of measuresByTimestamp) {
        const devices: MeasurementDevice[] = [];
        let totalValue = 0;
        let validMeasureCount = 0;
        const qualityLevels: Record<string, number> = {};

        measures.forEach((measure: any) => {
          const station = stationsMap.get(measure.id_station);
          if (!station) {
            console.warn(
              `Station ${measure.id_station} non trouvée dans la map des stations`
            );
            return;
          }

          if (!hasValidCoordinates(station)) {
            return;
          }

          // Ne créer le device que si la valeur est valide
          if (
            measure.valeur !== null &&
            measure.valeur !== undefined &&
            !isNaN(measure.valeur) &&
            typeof measure.valeur === "number"
          ) {
            const pollutantConfig = pollutants[pollutant];
            if (pollutantConfig) {
              const qualityLevel = getAirQualityLevel(
                measure.valeur,
                pollutantConfig.thresholds
              );
              qualityLevels[qualityLevel] =
                (qualityLevels[qualityLevel] || 0) + 1;
              totalValue += measure.valeur;
              validMeasureCount++;

              devices.push({
                id: measure.id_station,
                name: measure.nom_station || station.nom_station,
                latitude: station.latitude,
                longitude: station.longitude,
                source: this.sourceCode,
                pollutant: pollutant,
                value: measure.valeur,
                unit: measure.unite,
                timestamp: measure.date_debut,
                status: measure.validation === "validée" ? "active" : "inactive",
                qualityLevel,
                address: station.adresse,
                departmentId: station.departement_id,
              } as MeasurementDevice & { qualityLevel: string; address: string; departmentId: string });
            }
          }
        });

        if (devices.length > 0) {
          temporalDataPoints.push({
            timestamp,
            devices,
            deviceCount: devices.length,
            averageValue:
              validMeasureCount > 0 ? totalValue / validMeasureCount : 0,
            qualityLevels,
          });
        }
      }

      return temporalDataPoints;
    } catch (error) {
      if (isHttpNotFound(error)) {
        return [];
      }
      console.error(
        "Erreur lors de la récupération des données temporelles:",
        error
      );
      throw error;
    }
  }

  private getPollutantFromAtmoRefName(labelPolluant: string): string {
    // Mapping inverse des labels AtmoSud vers nos codes
    const labelToCodeMapping: Record<string, string> = {
      "Particules en suspension <2.5 µm (masses) (PM2.5)": "pm25",
      "Particules en suspension <10 µm (masses) (PM10)": "pm10",
      "Particules en suspension <1 µm (masses) (PM1)": "pm1",
      "Dioxyde d'azote (NO2)": "no2",
      "Ozone (O3)": "o3",
      "Dioxyde de soufre (SO2)": "so2",
    };

    return labelToCodeMapping[labelPolluant] || "pm25"; // Par défaut PM2.5
  }
}
