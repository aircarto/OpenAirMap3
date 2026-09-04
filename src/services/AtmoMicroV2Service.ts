import { BaseDataService } from "./BaseDataService";
import {
  AtmoMicroLikeService,
  MeasurementDevice,
  MicrospotDevice,
  MicrospotLocation,
  MicrospotObservation,
  StationVariable,
  TemporalDataPoint,
} from "../types";
import { getAirQualityLevel } from "../utils";
import { pollutants } from "../constants/pollutants";

/**
 * Service microcapteurs AtmoSud adossé à la nouvelle API « microspot ».
 *
 * Remplace AtmoMicroService (api.atmosud.org/observations/capteurs), qui passait
 * par une base intermédiaire. Deux différences de fond, pas un simple renommage :
 *
 * 1. Le modèle est le CAPTEUR, pas le site. Un marqueur = un capteur (`device.id`).
 *    Les sites de co-location de calibration portent donc plusieurs marqueurs,
 *    ce qui est voulu : la dispersion entre capteurs y est l'information utile.
 * 2. Les identifiants n'ont aucune correspondance avec les anciens `id_site`,
 *    qui n'étaient qu'un auto-incrément de la base intermédiaire. Aucune
 *    jointure entre les deux APIs n'est possible.
 *
 * Voir docs/ATMOMICRO_DONNEES_ET_METADONNEES.md pour le contrat de données.
 */

/** Codes ISO des variables attendus par l'API, par code polluant interne. */
const VARIABLE_ISO_CODES: Record<string, string> = {
  pm25: "39",
  pm10: "24",
  pm1: "68",
  no2: "03",
  o3: "08",
  so2: "01",
};

/** Code polluant interne, par code ISO de variable. Inverse de VARIABLE_ISO_CODES. */
const POLLUTANT_BY_ISO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(VARIABLE_ISO_CODES).map(([pollutant, iso]) => [
    iso,
    pollutant,
  ])
);

interface TimeStepConfig {
  /** Libellé d'agrégation attendu par l'API (anglais). */
  aggregation: "scan" | "quarter-hourly" | "hourly" | "daily";
  /** Fenêtre de fraîcheur en minutes, pour /observations/latest. */
  delay: number;
}

/**
 * Pas de temps de l'application vers l'agrégation de l'API.
 *
 * `daily` existe désormais côté API mais n'est pas exposé ici : ajouter `jour`
 * aux pas de temps supportés touche sources.ts, HISTORICAL_MODE_ALLOWED_TIME_STEPS
 * et le sélecteur, et sort du périmètre de la migration.
 */
const TIME_STEP_CONFIGS: Record<string, TimeStepConfig> = {
  instantane: { aggregation: "scan", delay: 181 },
  deuxMin: { aggregation: "scan", delay: 3 },
  quartHeure: { aggregation: "quarter-hourly", delay: 19 },
  heure: { aggregation: "hourly", delay: 64 },
};

/** Plafond dur de l'API. Toujours le demander : le défaut est 500 et tronque en silence. */
const MAX_LIMIT = 500000;

/**
 * Taille de tranche temporelle, en jours, par agrégation.
 *
 * Ce n'est PLUS le plafond de `limit` qui dimensionne ces tranches — il est passé
 * à 500 000, bien au-delà de ce qu'une tranche produit. La contrainte est
 * désormais la taille de réponse : au-delà d'une vingtaine de mégaoctets, le
 * serveur coupe le flux HTTP/2 en cours de route tout en répondant 200, et le
 * corps JSON reçu est invalide (voir warnIfTruncated).
 *
 * Mesuré le 2026-09-04 (PM2.5, tout le parc, `limit=500000`) :
 *   hourly 12 j          -> 33 597 lignes,  11 Mo, 34 s, 3/3 réponses valides
 *   quarter-hourly 3 j   -> 34 542 lignes,  11 Mo, 32 s, 3/3 valides
 *   scan 0,5 j           -> 43 900 lignes,  14 Mo, 49 s, 2/2 valides
 *   hourly 30 j          -> 84 742 annoncées, coupée entre 17 et 25 Mo, 0/4 valides
 *
 * Les élargir échangerait donc un gain de requêtes contre un risque de corruption
 * et des temps de réponse déjà à la limite de l'acceptable côté navigateur.
 */
const CHUNK_DAYS_BY_AGGREGATION: Record<TimeStepConfig["aggregation"], number> =
  {
    scan: 0.5,
    "quarter-hourly": 3,
    hourly: 12,
    daily: 365,
  };

/** Préfixe du placeholder interne que l'API laisse fuiter dans `location_name`. */
const AUTO_CREATED_LOCATION_PREFIX = "auto created for device";

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 min : les métadonnées changent rarement

export class AtmoMicroV2Service
  extends BaseDataService
  implements AtmoMicroLikeService
{
  private readonly BASE_URL =
    "https://api-export-prod.uspot.probesys.net/microspot";

  private lastMeasuresUnavailable = false;

  // Caches STATIQUES partagés entre instances, pour éviter les requêtes
  // redondantes : plusieurs composants instancient le service.
  private static devicesCache: MicrospotDevice[] | null = null;
  private static devicesFetchedAt = 0;
  private static devicesFetchPromise: Promise<MicrospotDevice[]> | null = null;

  private static locationsCache: Map<string, MicrospotLocation> | null = null;
  private static locationsFetchedAt = 0;
  private static locationsFetchPromise: Promise<
    Map<string, MicrospotLocation>
  > | null = null;

  constructor() {
    super("atmoMicro");
  }

  /**
   * Vide les caches statiques. Destiné aux tests, qui n'ont ainsi plus besoin
   * de percer les champs privés via `as any`.
   */
  static resetCaches(): void {
    AtmoMicroV2Service.devicesCache = null;
    AtmoMicroV2Service.devicesFetchedAt = 0;
    AtmoMicroV2Service.devicesFetchPromise = null;
    AtmoMicroV2Service.locationsCache = null;
    AtmoMicroV2Service.locationsFetchedAt = 0;
    AtmoMicroV2Service.locationsFetchPromise = null;
  }

  /**
   * Expose l'état incident pour permettre à l'UI d'afficher un bandeau.
   *
   * Contrairement à l'ancien service, un résultat vide (204) n'est PAS un
   * incident : c'est une réponse valide signifiant « aucune donnée ne correspond
   * aux filtres ». Seule une panne réelle (réseau, HTTP >= 400) lève le drapeau.
   */
  isMeasuresUnavailableIncident(): boolean {
    return this.lastMeasuresUnavailable;
  }

  // ---------------------------------------------------------------------------
  // Correspondances
  // ---------------------------------------------------------------------------

  private getVariableIsoCode(pollutant: string): string | null {
    return VARIABLE_ISO_CODES[pollutant] ?? null;
  }

  private getTimeStepConfig(timeStep: string): TimeStepConfig | null {
    return TIME_STEP_CONFIGS[timeStep] ?? null;
  }

  /**
   * Nom affichable d'un capteur.
   *
   * Ni `name` ni `location_name` ne suffit seul : sur les capteurs sans site
   * nommé, `location_name` vaut "auto created for device <id>" (placeholder
   * interne de l'API) alors que `name` est propre ; sur les capteurs installés
   * sur un site nommé, c'est l'inverse et `name` est null.
   */
  private buildDisplayName(source: {
    id: string;
    name?: string | null;
    locationName?: string | null;
  }): string {
    const { id, name, locationName } = source;

    if (locationName && !locationName.startsWith(AUTO_CREATED_LOCATION_PREFIX)) {
      return locationName;
    }

    return name || locationName || id;
  }

  /** Compose le champ `address` attendu par l'UI : "<nom>, <influence>" si connue. */
  private buildAddress(
    displayName: string,
    locationId: string | null | undefined,
    locations: Map<string, MicrospotLocation>
  ): string {
    const influence = locationId
      ? locations.get(locationId)?.influence
      : undefined;

    return influence ? `${displayName}, ${influence}` : displayName;
  }

  private isValidCoordinate(
    lat: number | null | undefined,
    lon: number | null | undefined
  ): boolean {
    return (
      typeof lat === "number" &&
      typeof lon === "number" &&
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }

  // ---------------------------------------------------------------------------
  // Journalisation des capteurs écartés
  //
  // Conservée à l'identique de l'ancien service : le runbook
  // docs/flow-atmomicro-marqueurs.md s'appuie sur ces préfixes de log.
  // ---------------------------------------------------------------------------

  private logExcludedDevices(
    excluded: Array<{ id: string; name: string; reason: string }>,
    context: { pollutant: string; variableIsoCode: string }
  ): void {
    if (excluded.length === 0) return;

    console.groupCollapsed(
      `[AtmoMicro][DEBUG] ${excluded.length} capteur(s) exclus de l'affichage (source lists/devices) - polluant=${context.pollutant}, variable=${context.variableIsoCode}`
    );
    excluded.forEach((device) => {
      console.log(
        `[AtmoMicro][EXCLUDED] id=${device.id} | nom="${device.name}" | raison=${device.reason}`
      );
    });
    console.groupEnd();
  }

  private logPostFilterExcludedDevices(
    excluded: Array<{ id: string; name: string; reason: string }>,
    context: { pollutant: string; variableIsoCode: string }
  ): void {
    if (excluded.length === 0) return;

    console.groupCollapsed(
      `[AtmoMicro][DEBUG] ${excluded.length} capteur(s) exclus apres filtrage (non affiches sur carte) - polluant=${context.pollutant}, variable=${context.variableIsoCode}`
    );
    excluded.forEach((device) => {
      console.log(
        `[AtmoMicro][POST_FILTER_EXCLUDED] id=${device.id} | nom="${device.name}" | raison=${device.reason}`
      );
    });
    console.groupEnd();
  }

  // ---------------------------------------------------------------------------
  // Caches de référentiels
  // ---------------------------------------------------------------------------

  /** Parc de capteurs, avec leurs variables, marque/modèle et localisation courante. */
  private async getCachedDevices(): Promise<MicrospotDevice[]> {
    const now = Date.now();
    const cacheValid =
      AtmoMicroV2Service.devicesCache &&
      now - AtmoMicroV2Service.devicesFetchedAt < CACHE_DURATION_MS;

    if (cacheValid && AtmoMicroV2Service.devicesCache) {
      return AtmoMicroV2Service.devicesCache;
    }

    // Verrou : si un fetch est déjà en cours, attendre sa complétion plutôt que
    // d'en lancer un second.
    if (AtmoMicroV2Service.devicesFetchPromise) {
      return await AtmoMicroV2Service.devicesFetchPromise;
    }

    AtmoMicroV2Service.devicesFetchPromise = (async () => {
      try {
        const url = `${this.BASE_URL}/lists/devices?active=2880`;
        const response = await this.makeRequest(url);
        const devices: MicrospotDevice[] = Array.isArray(response)
          ? response
          : [];

        AtmoMicroV2Service.devicesCache = devices;
        AtmoMicroV2Service.devicesFetchedAt = Date.now();
        return devices;
      } finally {
        AtmoMicroV2Service.devicesFetchPromise = null;
      }
    })();

    return await AtmoMicroV2Service.devicesFetchPromise;
  }

  /**
   * Sites de mesure, indexés par identifiant.
   *
   * Sert uniquement à retrouver `influence` (et `typology`), absents des
   * observations. La route ne couvre qu'une partie des `location_id` référencés
   * par /lists/devices — c'est une limite de l'API, l'absence est donc un cas
   * normal et non une erreur.
   */
  private async getCachedLocations(): Promise<Map<string, MicrospotLocation>> {
    const now = Date.now();
    const cacheValid =
      AtmoMicroV2Service.locationsCache &&
      now - AtmoMicroV2Service.locationsFetchedAt < CACHE_DURATION_MS;

    if (cacheValid && AtmoMicroV2Service.locationsCache) {
      return AtmoMicroV2Service.locationsCache;
    }

    if (AtmoMicroV2Service.locationsFetchPromise) {
      return await AtmoMicroV2Service.locationsFetchPromise;
    }

    AtmoMicroV2Service.locationsFetchPromise = (async () => {
      try {
        const url = `${this.BASE_URL}/lists/locations`;
        const response = await this.makeRequest(url);
        const locations: MicrospotLocation[] = Array.isArray(response)
          ? response
          : [];

        const byId = new Map<string, MicrospotLocation>(
          locations.map((location) => [location.id, location])
        );

        AtmoMicroV2Service.locationsCache = byId;
        AtmoMicroV2Service.locationsFetchedAt = Date.now();
        return byId;
      } finally {
        AtmoMicroV2Service.locationsFetchPromise = null;
      }
    })();

    return await AtmoMicroV2Service.locationsFetchPromise;
  }

  // ---------------------------------------------------------------------------
  // Marqueurs de la carte
  // ---------------------------------------------------------------------------

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
      const variableIsoCode = this.getVariableIsoCode(params.pollutant);
      if (!variableIsoCode) {
        console.warn(`Polluant ${params.pollutant} non supporté par AtmoMicro`);
        return [];
      }

      const timeStepConfig = this.getTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par AtmoMicro`
        );
        return [];
      }

      this.lastMeasuresUnavailable = false;

      // Trois appels en parallèle. Contrairement à l'ancien service, les
      // observations portent déjà les métadonnées utiles (marque, modèle) :
      // /lists/devices ne sert plus qu'aux capteurs sans mesure récente, et
      // /lists/locations qu'à retrouver `influence`.
      const [observations, devices, locations] = await Promise.all([
        this.fetchLatestObservations(
          variableIsoCode,
          timeStepConfig.aggregation,
          timeStepConfig.delay
        ).catch((error: unknown) => {
          // Panne réelle : on garde les capteurs grisés issus de /lists/devices.
          this.lastMeasuresUnavailable = true;
          console.warn(
            "[AtmoMicro] observations/latest indisponible, fallback capteurs uniquement:",
            error
          );
          return [] as MicrospotObservation[];
        }),
        this.getCachedDevices().catch((error: unknown) => {
          console.warn("[AtmoMicro] lists/devices indisponible:", error);
          return [] as MicrospotDevice[];
        }),
        this.getCachedLocations().catch((error: unknown) => {
          // `influence` est un enrichissement : son absence ne doit pas priver
          // la carte de ses marqueurs.
          console.warn("[AtmoMicro] lists/locations indisponible:", error);
          return new Map<string, MicrospotLocation>();
        }),
      ]);

      const { eligibleDevices, excludedDevices } = this.filterDevicesByVariable(
        devices,
        variableIsoCode
      );

      this.logExcludedDevices(excludedDevices, {
        pollutant: params.pollutant,
        variableIsoCode,
      });

      const pollutantConfig = pollutants[params.pollutant];
      if (!pollutantConfig) {
        console.warn(`Polluant ${params.pollutant} non configuré`);
        return [];
      }

      const measurementDevices: MeasurementDevice[] = [];
      const postFilterExcluded: Array<{
        id: string;
        name: string;
        reason: string;
      }> = [];
      const seenDeviceIds = new Set<string>();

      // 1. Les capteurs ayant une mesure récente : coordonnées et métadonnées
      //    proviennent de l'observation, donc à jour.
      for (const observation of observations) {
        const displayName = this.buildDisplayName({
          id: observation.id,
          name: observation.name,
          locationName: observation.location_name,
        });

        if (!this.isValidCoordinate(observation.lat, observation.lon)) {
          postFilterExcluded.push({
            id: observation.id,
            name: displayName,
            reason: `coordonnees invalides dans observations/latest (lat=${observation.lat}, lon=${observation.lon})`,
          });
          // Marqué comme vu pour qu'il ne réapparaisse pas en marqueur gris à
          // l'étape 2 : le capteur mesure bel et bien, l'afficher « inactif »
          // affirmerait le contraire. Sans position exploitable, on l'écarte.
          seenDeviceIds.add(observation.id);
          continue;
        }

        // `value_ref` est la meilleure valeur disponible (corrigée sinon brute)
        // et n'est jamais nulle quand une mesure existe : plus besoin de la
        // cascade ni du cas particulier quart-horaire de l'ancien service.
        const displayValue = observation.value_ref ?? 0;

        // Détection de correction : `value_raw` est renseigné sur 100 % des
        // lignes dès lors qu'on demande include=raw_value, donc `value` non nul
        // suffit. C'est ce qui élimine le faux positif de l'ancien service,
        // où `valeur_brute` absent rendait la comparaison toujours vraie.
        const hasCorrection = observation.value !== null;

        measurementDevices.push({
          id: observation.id,
          name: displayName,
          latitude: observation.lat,
          longitude: observation.lon,
          source: this.sourceCode,
          pollutant: params.pollutant,
          value: displayValue,
          unit: observation.unit,
          timestamp: observation.time,
          status: "active",
          qualityLevel: getAirQualityLevel(
            displayValue,
            pollutantConfig.thresholds
          ),
          address: this.buildAddress(
            displayName,
            observation.location_id,
            locations
          ),
          // `code_station_commun` n'a pas d'équivalent dans microspot : le champ
          // a été abandonné pour cette source.
          departmentId: "",
          corrected_value: hasCorrection ? observation.value ?? undefined : undefined,
          raw_value: observation.value_raw ?? undefined,
          has_correction: hasCorrection,
        });

        seenDeviceIds.add(observation.id);
      }

      // 2. Les capteurs sans mesure récente, en gris. Coordonnées issues de
      //    /lists/devices, donc potentiellement moins fraîches.
      for (const device of eligibleDevices) {
        if (seenDeviceIds.has(device.id)) continue;

        const displayName = this.buildDisplayName({
          id: device.id,
          name: device.name,
          locationName: device.actual_location,
        });

        // Un capteur sans site n'est pas plaçable sur une carte. C'est un cas
        // attendu, et voulu côté API : un capteur passé sur une campagne non
        // diffusable reste listé ici, mais sans localisation, puisque sa position
        // courante appartient à cette campagne. Sa donnée reste accessible sur
        // /observations pour la période où il était sur une campagne diffusable —
        // le mode temporel la reprendra donc naturellement, les observations
        // portant alors leurs propres coordonnées.
        if (!device.location_id) {
          postFilterExcluded.push({
            id: device.id,
            name: displayName,
            reason:
              "capteur sans location_id (campagne courante non diffusable) — non placable en temps reel",
          });
          continue;
        }

        if (!this.isValidCoordinate(device.lat, device.lon)) {
          postFilterExcluded.push({
            id: device.id,
            name: displayName,
            reason: `coordonnees invalides dans lists/devices (lat=${device.lat}, lon=${device.lon})`,
          });
          continue;
        }

        measurementDevices.push({
          id: device.id,
          name: displayName,
          latitude: device.lat as number,
          longitude: device.lon as number,
          source: this.sourceCode,
          pollutant: params.pollutant,
          value: 0,
          unit: "µg/m³",
          timestamp: new Date().toISOString(),
          status: "inactive",
          qualityLevel: "default",
          address: this.buildAddress(
            displayName,
            device.location_id,
            locations
          ),
          departmentId: "",
        });
      }

      this.logPostFilterExcludedDevices(postFilterExcluded, {
        pollutant: params.pollutant,
        variableIsoCode,
      });

      return measurementDevices;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données AtmoMicro:",
        error
      );
      throw error;
    }
  }

  /**
   * Ne garde que les capteurs mesurant la variable demandée.
   *
   * `variables` est un tableau d'objets côté microspot, là où l'ancienne API
   * exposait une chaîne séparée par des virgules.
   */
  private filterDevicesByVariable(
    devices: MicrospotDevice[],
    variableIsoCode: string
  ): {
    eligibleDevices: MicrospotDevice[];
    excludedDevices: Array<{ id: string; name: string; reason: string }>;
  } {
    const eligibleDevices: MicrospotDevice[] = [];
    const excludedDevices: Array<{
      id: string;
      name: string;
      reason: string;
    }> = [];

    for (const device of devices) {
      const displayName = this.buildDisplayName({
        id: device.id,
        name: device.name,
        locationName: device.actual_location,
      });

      if (!Array.isArray(device.variables) || device.variables.length === 0) {
        excludedDevices.push({
          id: device.id,
          name: displayName,
          reason: "variables absentes ou vides dans lists/devices",
        });
        continue;
      }

      const measuresVariable = device.variables.some(
        (variable) => variable.variable_iso_code === variableIsoCode
      );

      if (!measuresVariable) {
        const declared = device.variables
          .map((variable) => variable.variable_iso_code)
          .join(", ");
        excludedDevices.push({
          id: device.id,
          name: displayName,
          reason: `variable demandee absente (${variableIsoCode}) ; variables capteur=[${declared}]`,
        });
        continue;
      }

      eligibleDevices.push(device);
    }

    return { eligibleDevices, excludedDevices };
  }

  /**
   * Dernière mesure de chaque capteur pour une variable.
   *
   * Un 204 (aucune donnée) remonte un tableau vide, pas une erreur : c'est une
   * réponse valide de l'API.
   */
  private async fetchLatestObservations(
    variableIsoCode: string,
    aggregation: string,
    delay: number
  ): Promise<MicrospotObservation[]> {
    const url =
      `${this.BASE_URL}/observations/latest` +
      `?aggregation=${aggregation}` +
      `&variable=${variableIsoCode}` +
      `&delay=${delay}` +
      // 1 décimale : le rendu carte arrondit ensuite à l'entier dans createCustomIcon,
      // mais une troncature entière côté API fausserait les seuils de qualité.
      `&decimals=1` +
      `&include=raw_value,device_model` +
      `&limit=${MAX_LIMIT}`;

    const response = await this.makeRequest(url);

    // 204 ou corps vide : BaseDataService renvoie null.
    if (response === null) {
      return [];
    }

    if (!Array.isArray(response)) {
      throw new Error("Format de réponse inattendu pour observations/latest");
    }

    this.warnIfTruncated(response.length, MAX_LIMIT, "observations/latest");

    return response;
  }

  /**
   * Avertit quand une réponse a probablement été tronquée par `limit`.
   *
   * L'API signale la troncature par les en-têtes X-Truncated / X-Result-Count,
   * mais elle ne les expose pas via Access-Control-Expose-Headers : ils sont
   * illisibles depuis le navigateur. On se rabat donc sur le nombre de lignes,
   * ce qui est fiable puisque c'est ce service qui fixe `limit`.
   *
   * Depuis le passage du plafond à 500 000, ce garde-fou ne devrait plus jamais
   * se déclencher aux tailles de tranche retenues : s'il parle, c'est que la
   * volumétrie a explosé et que le découpage est à revoir. L'autre mode de perte
   * de données — la coupure du flux au-delà d'une vingtaine de mégaoctets — ne
   * passe pas par ici : elle fait échouer le parsing JSON, donc lever une erreur.
   */
  private warnIfTruncated(
    rowCount: number,
    limit: number,
    context: string
  ): boolean {
    if (rowCount < limit) return false;

    console.warn(
      `[AtmoMicro] ${context}: ${rowCount} lignes reçues pour une limite de ${limit} — ` +
        `réponse probablement tronquée, des données manquent. ` +
        `Resserrer les filtres ou réduire la fenêtre temporelle.`
    );
    return true;
  }

  // ---------------------------------------------------------------------------
  // Métadonnées d'un capteur
  // ---------------------------------------------------------------------------

  /**
   * Variables mesurées et modèle d'un capteur. Lit le cache, sans appel réseau
   * supplémentaire — comme l'ancien service.
   *
   * Note : microspot n'expose que les 6 polluants diffusés. Les variables
   * annexes de l'ancienne API (Air Temp., Air Hum., Air Pres., CO, CO2, H2S,
   * NO, NOx, PM4, *_Nombre, Batterie) disparaissent, mais le mapping les
   * ignorait déjà.
   */
  async fetchSiteVariables(siteId: string): Promise<{
    variables: Record<string, StationVariable>;
    sensorModel?: string;
  }> {
    try {
      const devices = await this.getCachedDevices();
      const device = devices.find((candidate) => candidate.id === siteId);

      if (!device) {
        console.warn(`Capteur ${siteId} non trouvé dans le cache`);
        return { variables: {} };
      }

      const variables: Record<string, StationVariable> = {};

      for (const variable of device.variables ?? []) {
        const pollutantCode = POLLUTANT_BY_ISO_CODE[variable.variable_iso_code];
        if (pollutantCode && pollutants[pollutantCode]) {
          variables[pollutantCode] = {
            label: pollutants[pollutantCode].name,
            code_iso: variable.variable_iso_code,
            // /lists/devices ne liste que les variables effectivement mesurées :
            // une variable présente est en service.
            en_service: true,
          };
        }
      }

      return {
        variables,
        sensorModel: device.model || undefined,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des variables du capteur:",
        error
      );
      throw error;
    }
  }

  /**
   * Cadence de mesure du capteur, en secondes.
   *
   * Lue sur `include=metadata` des observations (cadence CAPTEUR, renseignée
   * partout) et non sur le `scan_interval` de /lists/devices (cadence par
   * variable, renseignée sur une poignée de couples seulement).
   */
  async fetchSensorTimeStep(
    siteId: string,
    pollutant: string
  ): Promise<number | null> {
    try {
      const variableIsoCode = this.getVariableIsoCode(pollutant);
      if (!variableIsoCode) {
        console.warn(`Polluant ${pollutant} non supporté par AtmoMicro`);
        return null;
      }

      const url =
        `${this.BASE_URL}/observations/latest` +
        `?aggregation=scan` +
        `&device_id=${encodeURIComponent(siteId)}` +
        `&variable=${variableIsoCode}` +
        `&decimals=0` +
        `&include=metadata` +
        `&limit=1`;

      const response = await this.makeRequest(url);

      if (!response || !Array.isArray(response) || response.length === 0) {
        console.warn(`Aucune mesure trouvée pour le capteur ${siteId}`);
        return null;
      }

      const scanInterval = (response[0] as MicrospotObservation).scan_interval;
      return typeof scanInterval === "number" ? scanInterval : null;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération du pas de temps du capteur:",
        error
      );
      return null;
    }
  }

  /** Coordonnées à jour d'un capteur, avec repli sur le référentiel. */
  async fetchSiteCoordinates(
    siteId: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const url =
        `${this.BASE_URL}/observations/latest` +
        `?aggregation=scan` +
        `&device_id=${encodeURIComponent(siteId)}` +
        `&decimals=0` +
        `&limit=1`;

      const response = await this.makeRequest(url);

      if (Array.isArray(response) && response.length > 0) {
        const observation = response[0] as MicrospotObservation;
        if (this.isValidCoordinate(observation.lat, observation.lon)) {
          return { latitude: observation.lat, longitude: observation.lon };
        }
      }

      // Pas de mesure récente : se rabattre sur la position du référentiel.
      const devices = await this.getCachedDevices();
      const device = devices.find((candidate) => candidate.id === siteId);

      if (device && this.isValidCoordinate(device.lat, device.lon)) {
        return {
          latitude: device.lat as number,
          longitude: device.lon as number,
        };
      }

      console.warn(`Capteur ${siteId} non trouvé`);
      return null;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des coordonnées du capteur:",
        error
      );
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Séries historiques
  // ---------------------------------------------------------------------------

  /** Série temporelle d'un capteur, pour le graphique du panneau de détail. */
  async fetchHistoricalData(params: {
    siteId: string;
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
  }): Promise<Array<{ timestamp: string; value: number; unit: string }>> {
    try {
      const variableIsoCode = this.getVariableIsoCode(params.pollutant);
      if (!variableIsoCode) {
        console.warn(`Polluant ${params.pollutant} non supporté par AtmoMicro`);
        return [];
      }

      const timeStepConfig = this.getTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par AtmoMicro`
        );
        return [];
      }

      const from = this.formatDateForHistoricalMode(params.startDate, false);
      const to = this.formatDateForHistoricalMode(params.endDate, true);

      const url =
        `${this.BASE_URL}/observations` +
        `?aggregation=${timeStepConfig.aggregation}` +
        `&device_id=${encodeURIComponent(params.siteId)}` +
        `&variable=${variableIsoCode}` +
        `&from_date_time=${from}` +
        `&date_time=${to}` +
        `&decimals=1` +
        `&include=raw_value` +
        // gapfill : renvoie tous les pas de temps de la période, pour que le
        // graphique montre les trous au lieu de relier deux points distants.
        `&gapfill=true` +
        `&limit=${MAX_LIMIT}`;

      const response = await this.makeRequest(url);

      if (!response || !Array.isArray(response)) {
        console.warn("Aucune donnée historique reçue d'AtmoMicro");
        return [];
      }

      this.warnIfTruncated(
        response.length,
        MAX_LIMIT,
        `observations (capteur ${params.siteId})`
      );

      return (response as MicrospotObservation[]).map((observation) => {
        const hasCorrection = observation.value !== null;

        return {
          timestamp: observation.time,
          value: observation.value_ref ?? 0,
          unit: observation.unit,
          corrected_value: hasCorrection
            ? observation.value ?? undefined
            : undefined,
          raw_value: observation.value_raw ?? undefined,
          has_correction: hasCorrection,
        };
      });
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données historiques AtmoMicro:",
        error
      );
      throw error;
    }
  }

  /**
   * Convertit une date de l'UI en ISO 8601 UTC.
   *
   * Reprise à l'identique de l'ancien service : l'API microspot accepte le même
   * format, et cette logique est alignée sur src/utils/historicalTimeRange.ts.
   */
  private formatDateForHistoricalMode(
    dateString: string,
    isEndDate: boolean = false
  ): string {
    const hasTimeComponent = /T\d{2}:\d{2}/.test(dateString);

    if (!hasTimeComponent) {
      const [year, month, day] = dateString.split("-").map(Number);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(
          `Format de date invalide: ${dateString}. Format attendu: YYYY-MM-DD`
        );
      }

      // Date de fin : minuit local du jour suivant, pour couvrir la journée
      // entière une fois converti en UTC.
      if (isEndDate) {
        return new Date(year, month - 1, day + 1, 0, 0, 0, 0).toISOString();
      }

      return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
    }

    // Heure déjà présente (périodes prédéfinies 3h/24h/7d/30d) : la préserver
    // telle quelle pour respecter exactement la période demandée.
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Date invalide: ${dateString}`);
    }

    return date.toISOString();
  }

  // ---------------------------------------------------------------------------
  // Mode temporel
  // ---------------------------------------------------------------------------

  /** Série de tous les capteurs sur une période, pour l'animation temporelle. */
  async fetchTemporalData(params: {
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
    sites?: string[];
  }): Promise<TemporalDataPoint[]> {
    const variableIsoCode = this.getVariableIsoCode(params.pollutant);
    if (!variableIsoCode) return [];

    const timeStepConfig = this.getTimeStepConfig(params.timeStep);
    if (!timeStepConfig) return [];

    const pollutantConfig = pollutants[params.pollutant];
    if (!pollutantConfig) {
      console.warn(`Polluant ${params.pollutant} non configuré`);
      return [];
    }

    const startISO = this.formatDateForHistoricalMode(params.startDate, false);
    const endISO = this.formatDateForHistoricalMode(params.endDate, true);

    const start = new Date(startISO);
    const end = new Date(endISO);

    // La taille de tranche dépend de l'agrégation : l'API plafonne à 50 000
    // lignes, et une tranche fixe de 30 jours dépasse ce plafond dès l'horaire.
    const chunkDays = CHUNK_DAYS_BY_AGGREGATION[timeStepConfig.aggregation];
    const chunkMs = chunkDays * 24 * 60 * 60 * 1000;

    const observationsByTimestamp = new Map<string, MicrospotObservation[]>();
    const siteFilter = params.sites ? new Set(params.sites) : null;

    for (
      let chunkStart = start.getTime();
      chunkStart < end.getTime();
      chunkStart += chunkMs
    ) {
      const chunkEnd = Math.min(chunkStart + chunkMs, end.getTime());

      try {
        const url =
          `${this.BASE_URL}/observations` +
          `?aggregation=${timeStepConfig.aggregation}` +
          `&variable=${variableIsoCode}` +
          `&from_date_time=${new Date(chunkStart).toISOString()}` +
          `&date_time=${new Date(chunkEnd).toISOString()}` +
          `&decimals=1` +
          // include=raw_value même en mode temporel : sans lui, `value_raw` est
          // absent et la détection de correction devient impossible. C'est
          // précisément ce qui manquait à l'ancien service.
          `&include=raw_value` +
          `&limit=${MAX_LIMIT}`;

        const response = await this.makeRequest(url);

        if (!response || !Array.isArray(response)) {
          console.warn(
            `[AtmoMicro] Aucune donnée pour la tranche ${new Date(
              chunkStart
            ).toISOString()} -> ${new Date(chunkEnd).toISOString()}`
          );
          continue;
        }

        this.warnIfTruncated(
          response.length,
          MAX_LIMIT,
          `observations (tranche ${new Date(chunkStart).toISOString()})`
        );

        for (const observation of response as MicrospotObservation[]) {
          if (siteFilter && !siteFilter.has(observation.id)) continue;

          const existing = observationsByTimestamp.get(observation.time);
          if (existing) {
            existing.push(observation);
          } else {
            observationsByTimestamp.set(observation.time, [observation]);
          }
        }
      } catch (error) {
        // Une tranche en échec ne doit pas condamner toute la période, mais
        // elle doit être visible : l'ancien service avalait l'erreur en silence.
        // Une erreur de parsing JSON signale ici une réponse coupée en cours de
        // transfert (le serveur répond 200 puis interrompt le flux au-delà d'une
        // vingtaine de mégaoctets) : c'est un trou dans le graphique, pas une panne.
        console.warn(
          `[AtmoMicro] Échec de la tranche ${new Date(
            chunkStart
          ).toISOString()} -> ${new Date(chunkEnd).toISOString()} ` +
            `— ces pas de temps manqueront au graphique:`,
          error
        );
      }
    }

    const temporalDataPoints: TemporalDataPoint[] = [];

    for (const [timestamp, observations] of observationsByTimestamp) {
      const devices: MeasurementDevice[] = [];
      const qualityLevels: Record<string, number> = {};
      let totalValue = 0;
      let validValues = 0;

      for (const observation of observations) {
        const displayValue = observation.value_ref;

        if (
          displayValue === null ||
          displayValue === undefined ||
          typeof displayValue !== "number" ||
          isNaN(displayValue)
        ) {
          continue;
        }

        totalValue += displayValue;
        validValues++;

        const qualityLevel = getAirQualityLevel(
          displayValue,
          pollutantConfig.thresholds
        );
        qualityLevels[qualityLevel] = (qualityLevels[qualityLevel] || 0) + 1;

        const hasCorrection = observation.value !== null;
        const displayName = this.buildDisplayName({
          id: observation.id,
          name: observation.name,
          locationName: observation.location_name,
        });

        devices.push({
          id: observation.id,
          name: displayName,
          latitude: observation.lat,
          longitude: observation.lon,
          source: this.sourceCode,
          pollutant: params.pollutant,
          value: displayValue,
          unit: observation.unit,
          timestamp: observation.time,
          status: "active",
          qualityLevel,
          address: displayName,
          // `influence` n'est pas joint ici : le mode temporel n'affiche pas
          // l'adresse, et le cache locations n'est pas garanti chargé.
          departmentId: "",
          corrected_value: hasCorrection
            ? observation.value ?? undefined
            : undefined,
          raw_value: observation.value_raw ?? undefined,
          has_correction: hasCorrection,
        });
      }

      temporalDataPoints.push({
        timestamp,
        devices,
        deviceCount: devices.length,
        averageValue: validValues > 0 ? totalValue / validValues : 0,
        qualityLevels,
      });
    }

    temporalDataPoints.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return temporalDataPoints;
  }
}
