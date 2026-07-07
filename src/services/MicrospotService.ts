import { BaseDataService } from './BaseDataService';
import {
  MeasurementDevice,
  TemporalDataPoint,
} from '../types';
import {
  MicrospotDevice,
  MicrospotLocation,
  MicrospotObservation,
} from '../types/microspot';
import {
  MICROSPOT_BASE_URL,
  MICROSPOT_DEVICES_CACHE_DURATION,
  MICROSPOT_ENV,
  MICROSPOT_HISTORICAL_CHUNK_DAYS,
  MICROSPOT_ISO_TO_POLLUTANT,
  MICROSPOT_OBSERVATIONS_LIMIT,
  MICROSPOT_POLLUTANT_TO_ISO,
  MICROSPOT_SCAN_HISTORICAL_CHUNK_DAYS,
  getMicrospotIsoCode,
  getMicrospotTimeStepConfig,
  MicrospotAggregation,
} from '../constants/microspot';
import { featureFlags } from '../config/featureFlags';
import { getAirQualityLevel } from '../utils';
import { pollutants } from '../constants/pollutants';
import {
  MicrospotMeasuresUnavailableError,
  QualifiedMicroSensorService,
} from './QualifiedMicroSensorService';

export class MicrospotService
  extends BaseDataService
  implements QualifiedMicroSensorService
{
  private lastMeasuresUnavailable = false;
  private static stagingLogEmitted = false;

  private static devicesByVariableCache = new Map<
    string,
    { devices: MicrospotDevice[]; fetchedAt: number }
  >();
  private static devicesByVariableFetchPromises = new Map<
    string,
    Promise<MicrospotDevice[]>
  >();
  private static deviceByIdCache = new Map<string, MicrospotDevice>();
  private static siteVariablesCache = new Map<
    string,
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  >();

  private static locationsCache: Map<string, MicrospotLocation> | null = null;
  private static lastLocationsFetch = 0;
  private static locationsFetchPromise: Promise<Map<string, MicrospotLocation>> | null =
    null;

  constructor() {
    super('atmoMicro');
    this.logStagingEnvironmentOnce();
  }

  private logStagingEnvironmentOnce(): void {
    if (
      !MicrospotService.stagingLogEmitted &&
      featureFlags.useMicrospotApi &&
      import.meta.env.DEV
    ) {
      console.info(
        `[Microspot] API ${MICROSPOT_ENV}/preprod — données non représentatives de la production`
      );
      MicrospotService.stagingLogEmitted = true;
    }
  }

  isMeasuresUnavailableIncident(): boolean {
    return this.lastMeasuresUnavailable;
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
      const isoCode = getMicrospotIsoCode(params.pollutant);
      if (!isoCode) {
        console.warn(`Polluant ${params.pollutant} non supporté par Microspot`);
        return [];
      }

      const timeStepConfig = getMicrospotTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par Microspot`
        );
        return [];
      }

      this.lastMeasuresUnavailable = false;

      const [filteredDevices, locations, measuresResponse] = await Promise.all([
        this.fetchDevicesByVariable(isoCode),
        this.getCachedLocations(),
        this.fetchLatestMeasures(
          isoCode,
          timeStepConfig.aggregation,
          timeStepConfig.delay
        ).catch((error: unknown) => {
          this.lastMeasuresUnavailable = true;
          if (!(error instanceof MicrospotMeasuresUnavailableError)) {
            console.warn(
              '[Microspot] observations/latest indisponible, fallback devices uniquement:',
              error
            );
          }
          return [] as MicrospotObservation[];
        }),
      ]);

      if (!Array.isArray(filteredDevices)) {
        console.warn('Réponse devices Microspot invalide');
        return [];
      }

      const measuresList = Array.isArray(measuresResponse)
        ? measuresResponse
        : [];
      if (!Array.isArray(measuresResponse)) {
        this.lastMeasuresUnavailable = true;
        console.warn(
          '[Microspot] Format observations/latest inattendu, fallback devices uniquement'
        );
      }

      const measuresMap = new Map<string, MicrospotObservation>();
      measuresList.forEach((measure) => {
        measuresMap.set(measure.id, measure);
      });

      const devices: MeasurementDevice[] = [];
      const postFilterExcluded: Array<{
        id: string;
        name: string;
        reason: string;
      }> = [];

      const pollutantConfig = pollutants[params.pollutant];

      for (const device of filteredDevices) {
        const location = device.actual_location_id
          ? locations.get(device.actual_location_id)
          : undefined;
        const measure = measuresMap.get(device.id);

        if (measure && pollutantConfig) {
          const displayValues = this.resolveDisplayValues(
            measure,
            timeStepConfig.aggregation
          );
          const qualityLevel = getAirQualityLevel(
            displayValues.displayValue,
            pollutantConfig.thresholds
          );

          if (!this.isValidCoordinate(measure.lat, measure.lon)) {
            postFilterExcluded.push({
              id: device.id,
              name: device.name,
              reason: `coordonnees invalides dans observations/latest (lat=${measure.lat}, lon=${measure.lon})`,
            });
            continue;
          }

          devices.push(
            this.buildActiveDevice({
              id: device.id,
              name: device.name,
              latitude: measure.lat,
              longitude: measure.lon,
              pollutant: params.pollutant,
              displayValue: displayValues.displayValue,
              unit: measure.unit,
              timestamp: measure.time,
              qualityLevel,
              address: this.buildAddress(device, location),
              correctedValue: displayValues.correctedValue,
              rawValue: displayValues.rawValue,
              hasCorrection: displayValues.hasCorrection,
            })
          );
          continue;
        }

        const lat = location?.lat;
        const lon = location?.lon;

        if (
          lat === undefined ||
          lon === undefined ||
          !this.isValidCoordinate(lat, lon)
        ) {
          postFilterExcluded.push({
            id: device.id,
            name: device.name,
            reason: `coordonnees invalides ou absentes (location_id=${device.actual_location_id})`,
          });
          continue;
        }

        devices.push(
          this.buildInactiveDevice({
            id: device.id,
            name: device.name,
            latitude: lat,
            longitude: lon,
            pollutant: params.pollutant,
            address: this.buildAddress(device, location),
          })
        );
      }

      measuresList.forEach((measure) => {
        if (filteredDevices.some((device) => device.id === measure.id)) return;
        postFilterExcluded.push({
          id: measure.id,
          name: measure.name,
          reason:
            'mesure recue mais device absent du sous-ensemble lists/devices?variable',
        });
      });

      this.logPostFilterExcluded(postFilterExcluded, {
        pollutant: params.pollutant,
        isoCode,
      });

      return devices;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des données Microspot:',
        error
      );
      throw error;
    }
  }

  async fetchSiteVariables(siteId: string): Promise<{
    variables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    >;
    sensorModel?: string;
  }> {
    try {
      const device = await this.fetchDeviceById(siteId);

      if (!device) {
        console.warn(`Device ${siteId} non trouvé`);
        return { variables: {} };
      }

      const cachedVariables = MicrospotService.siteVariablesCache.get(siteId);
      const availableVariables =
        cachedVariables ?? (await this.resolveAvailableVariables(device));

      if (!cachedVariables) {
        MicrospotService.siteVariablesCache.set(siteId, availableVariables);
      }

      const sensorModel =
        device.brand && device.model
          ? `${device.brand} ${device.model}`
          : device.model || device.brand || undefined;

      return { variables: availableVariables, sensorModel };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des variables du device:',
        error
      );
      throw error;
    }
  }

  async fetchSensorTimeStep(
    siteId: string,
    pollutant: string
  ): Promise<number | null> {
    try {
      const isoCode = getMicrospotIsoCode(pollutant);
      if (!isoCode) {
        console.warn(`Polluant ${pollutant} non supporté par Microspot`);
        return null;
      }

      const url = this.buildUrl('/observations/latest', {
        device_id: siteId,
        aggregation: 'scan',
        variable: isoCode,
        include: 'metadata',
        format: 'json',
        decimals: 0,
      });

      const response = await this.makeRequest(url);
      if (!response || !Array.isArray(response) || response.length === 0) {
        return this.parseScanIntervalFromAggregations(siteId, pollutant);
      }

      const first = response[0] as MicrospotObservation;
      const scanInterval =
        first.scan_interval ?? first.metadata?.scan_interval;
      if (typeof scanInterval === 'number') {
        return scanInterval;
      }

      return this.parseScanIntervalFromAggregations(siteId, pollutant);
    } catch (error) {
      console.error(
        'Erreur lors de la récupération du pas de temps du capteur:',
        error
      );
      return null;
    }
  }

  async fetchSiteCoordinates(
    siteId: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const url = this.buildUrl('/observations/latest', {
        device_id: siteId,
        aggregation: 'scan',
        format: 'json',
        decimals: 0,
      });

      const response = await this.makeRequest(url);
      if (response && Array.isArray(response) && response.length > 0) {
        const first = response[0] as MicrospotObservation;
        if (this.isValidCoordinate(first.lat, first.lon)) {
          return { latitude: first.lat, longitude: first.lon };
        }
      }

      const allDevices = await this.fetchDeviceById(siteId);
      const device = allDevices;
      if (!device?.actual_location_id) {
        console.warn(`Device ${siteId} non trouvé`);
        return null;
      }

      const locations = await this.getCachedLocations();
      const location = locations.get(device.actual_location_id);
      if (location && this.isValidCoordinate(location.lat, location.lon)) {
        return { latitude: location.lat, longitude: location.lon };
      }

      return null;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des coordonnées du device:',
        error
      );
      return null;
    }
  }

  async fetchHistoricalData(params: {
    siteId: string;
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
  }): Promise<
    Array<{
      timestamp: string;
      value: number;
      unit: string;
      corrected_value?: number;
      raw_value?: number;
      has_correction?: boolean;
    }>
  > {
    try {
      const isoCode = getMicrospotIsoCode(params.pollutant);
      if (!isoCode) {
        console.warn(`Polluant ${params.pollutant} non supporté par Microspot`);
        return [];
      }

      const timeStepConfig = getMicrospotTimeStepConfig(params.timeStep);
      if (!timeStepConfig) {
        console.warn(
          `Pas de temps ${params.timeStep} non supporté par Microspot`
        );
        return [];
      }

      const observations = await this.fetchObservationsForDevice({
        deviceId: params.siteId,
        isoCode,
        aggregation: timeStepConfig.aggregation,
        startDate: params.startDate,
        endDate: params.endDate,
        decimals: 1,
      });

      if (observations.length === 0) {
        console.warn('Aucune donnée historique reçue de Microspot');
        return [];
      }

      return observations.map((observation) => {
        const displayValues = this.resolveDisplayValues(
          observation,
          timeStepConfig.aggregation
        );
        return {
          timestamp: observation.time,
          value: displayValues.displayValue,
          unit: observation.unit,
          corrected_value: displayValues.correctedValue,
          raw_value: displayValues.rawValue,
          has_correction: displayValues.hasCorrection,
        };
      });
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des données historiques Microspot:',
        error
      );
      throw error;
    }
  }

  async fetchTemporalData(params: {
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
    sites?: string[];
  }): Promise<TemporalDataPoint[]> {
    const isoCode = getMicrospotIsoCode(params.pollutant);
    if (!isoCode) return [];

    const timeStepConfig = getMicrospotTimeStepConfig(params.timeStep);
    if (!timeStepConfig) return [];

    return this.fetchTemporalDataOptimized({
      isoCode,
      aggregation: timeStepConfig.aggregation,
      startDate: params.startDate,
      endDate: params.endDate,
      pollutant: params.pollutant,
      sites: params.sites,
    });
  }

  private async fetchObservationsForDevice(params: {
    deviceId: string;
    isoCode: string;
    aggregation: MicrospotAggregation;
    startDate: string;
    endDate: string;
    decimals: number;
  }): Promise<MicrospotObservation[]> {
    const { deviceId, isoCode, aggregation, startDate, endDate, decimals } =
      params;

    const startDateISO = this.formatDateForHistoricalMode(startDate, false);
    const endDateISO = this.formatDateForHistoricalMode(endDate, true);
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);

    const chunkSizeDays =
      aggregation === 'scan'
        ? MICROSPOT_SCAN_HISTORICAL_CHUNK_DAYS
        : MICROSPOT_HISTORICAL_CHUNK_DAYS;

    const totalDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const chunks = Math.ceil(totalDays / chunkSizeDays);
    const observations: MicrospotObservation[] = [];

    for (let i = 0; i < chunks; i++) {
      const chunkStart = new Date(
        start.getTime() + i * chunkSizeDays * 24 * 60 * 60 * 1000
      );
      const chunkEnd = new Date(
        chunkStart.getTime() + (chunkSizeDays - 1) * 24 * 60 * 60 * 1000
      );
      if (chunkEnd > end) {
        chunkEnd.setTime(end.getTime());
      }

      const isFirstChunk = i === 0;
      const isLastChunk = i === chunks - 1;
      const formattedChunkStart = isFirstChunk
        ? startDateISO
        : chunkStart.toISOString();
      const formattedChunkEnd = isLastChunk
        ? endDateISO
        : chunkEnd.toISOString();

      try {
        const url = this.buildUrl('/observations/', {
          device_id: deviceId,
          from_date_time: formattedChunkStart,
          date_time: formattedChunkEnd,
          variable: isoCode,
          aggregation,
          include: 'raw_value',
          decimals,
          format: 'json',
          limit: MICROSPOT_OBSERVATIONS_LIMIT,
        });

        const response = await this.makeRequest(url);
        if (!response || !Array.isArray(response)) continue;

        observations.push(...(response as MicrospotObservation[]));
      } catch {
        // Continuer avec les autres tranches
      }
    }

    observations.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    return observations;
  }

  private async fetchDevicesByVariable(
    isoCode: string
  ): Promise<MicrospotDevice[]> {
    const now = Date.now();
    const cached = MicrospotService.devicesByVariableCache.get(isoCode);
    if (
      cached &&
      now - cached.fetchedAt < MICROSPOT_DEVICES_CACHE_DURATION
    ) {
      return cached.devices;
    }

    const inFlight = MicrospotService.devicesByVariableFetchPromises.get(isoCode);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = (async () => {
      try {
        const response = await this.makeRequest(
          this.buildUrl('/lists/devices', {
            variable: isoCode,
            format: 'json',
          })
        );
        const devices = Array.isArray(response)
          ? (response as MicrospotDevice[])
          : [];

        MicrospotService.devicesByVariableCache.set(isoCode, {
          devices,
          fetchedAt: Date.now(),
        });
        devices.forEach((device) => {
          MicrospotService.deviceByIdCache.set(device.id, device);
        });

        return devices;
      } finally {
        MicrospotService.devicesByVariableFetchPromises.delete(isoCode);
      }
    })();

    MicrospotService.devicesByVariableFetchPromises.set(isoCode, fetchPromise);
    return fetchPromise;
  }

  private async fetchDeviceById(
    siteId: string
  ): Promise<MicrospotDevice | null> {
    const cached = MicrospotService.deviceByIdCache.get(siteId);
    if (cached) {
      return cached;
    }

    const response = await this.makeRequest(
      this.buildUrl('/lists/devices', {
        id: siteId,
        format: 'json',
      })
    );

    if (!Array.isArray(response) || response.length === 0) {
      return null;
    }

    const device = response[0] as MicrospotDevice;
    MicrospotService.deviceByIdCache.set(siteId, device);
    return device;
  }

  private async fetchLatestMeasures(
    isoCode: string,
    aggregation: MicrospotAggregation,
    delay: number
  ): Promise<MicrospotObservation[]> {
    const url = this.buildUrl('/observations/latest', {
      variable: isoCode,
      aggregation,
      delay,
      include: 'raw_value,metadata',
      decimals: 1,
      format: 'json',
    });

    const response = await this.makeRequest(url);
    if (response === null) {
      throw new MicrospotMeasuresUnavailableError();
    }
    if (!Array.isArray(response)) {
      throw new Error('Format de réponse inattendu pour observations/latest');
    }
    if (response.length === 0) {
      throw new MicrospotMeasuresUnavailableError();
    }

    return response as MicrospotObservation[];
  }

  private async getCachedLocations(): Promise<Map<string, MicrospotLocation>> {
    const now = Date.now();
    const cacheValid =
      MicrospotService.locationsCache &&
      now - MicrospotService.lastLocationsFetch <
        MICROSPOT_DEVICES_CACHE_DURATION;

    if (cacheValid && MicrospotService.locationsCache) {
      return MicrospotService.locationsCache;
    }

    if (MicrospotService.locationsFetchPromise) {
      return MicrospotService.locationsFetchPromise;
    }

    MicrospotService.locationsFetchPromise = (async () => {
      try {
        const url = this.buildUrl('/lists/locations', { format: 'json' });
        const locations = await this.makeRequest(url);
        const map = new Map<string, MicrospotLocation>();
        if (Array.isArray(locations)) {
          (locations as MicrospotLocation[]).forEach((loc) => {
            map.set(loc.id, loc);
          });
        }
        MicrospotService.locationsCache = map;
        MicrospotService.lastLocationsFetch = Date.now();
        return map;
      } finally {
        MicrospotService.locationsFetchPromise = null;
      }
    })();

    return MicrospotService.locationsFetchPromise;
  }

  private async fetchTemporalDataOptimized(params: {
    isoCode: string;
    aggregation: MicrospotAggregation;
    startDate: string;
    endDate: string;
    pollutant: string;
    sites?: string[];
  }): Promise<TemporalDataPoint[]> {
    const { isoCode, aggregation, startDate, endDate, pollutant, sites } =
      params;
    const temporalDataPoints: TemporalDataPoint[] = [];
    const chunkSize = 30;

    const startDateISO = this.formatDateForHistoricalMode(startDate, false);
    const endDateISO = this.formatDateForHistoricalMode(endDate, true);
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);

    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const chunks = Math.ceil(totalDays / chunkSize);

    for (let i = 0; i < chunks; i++) {
      const chunkStart = new Date(
        start.getTime() + i * chunkSize * 24 * 60 * 60 * 1000
      );
      const chunkEnd = new Date(
        chunkStart.getTime() + (chunkSize - 1) * 24 * 60 * 60 * 1000
      );
      if (chunkEnd > end) {
        chunkEnd.setTime(end.getTime());
      }

      try {
        const isFirstChunk = i === 0;
        const isLastChunk = i === chunks - 1;
        const formattedChunkStart = isFirstChunk
          ? startDateISO
          : chunkStart.toISOString();
        const formattedChunkEnd = isLastChunk
          ? endDateISO
          : chunkEnd.toISOString();

        const url = this.buildUrl('/observations/', {
          from_date_time: formattedChunkStart,
          date_time: formattedChunkEnd,
          variable: isoCode,
          aggregation,
          include: 'raw_value',
          decimals: 0,
          format: 'json',
          limit: MICROSPOT_OBSERVATIONS_LIMIT,
        });

        const response = await this.makeRequest(url);
        if (!response || !Array.isArray(response)) continue;

        const filteredResponse = sites
          ? (response as MicrospotObservation[]).filter((obs) =>
              sites.includes(obs.id)
            )
          : (response as MicrospotObservation[]);

        const measuresByTimestamp = new Map<string, MicrospotObservation[]>();
        filteredResponse.forEach((observation) => {
          const timestamp = observation.time;
          if (!measuresByTimestamp.has(timestamp)) {
            measuresByTimestamp.set(timestamp, []);
          }
          measuresByTimestamp.get(timestamp)!.push(observation);
        });

        for (const [timestamp, measures] of measuresByTimestamp) {
          const devices: MeasurementDevice[] = [];
          let totalValue = 0;
          let validValues = 0;
          const qualityLevels: Record<string, number> = {};

          measures.forEach((observation) => {
            const displayValues = this.resolveDisplayValues(
              observation,
              aggregation
            );
            const displayValue = displayValues.displayValue;

            if (
              displayValue === null ||
              displayValue === undefined ||
              isNaN(displayValue) ||
              typeof displayValue !== 'number'
            ) {
              return;
            }

            totalValue += displayValue;
            validValues++;

            const pollutantConfig = pollutants[pollutant];
            if (!pollutantConfig) return;

            const qualityLevel = getAirQualityLevel(
              displayValue,
              pollutantConfig.thresholds
            );
            qualityLevels[qualityLevel] = (qualityLevels[qualityLevel] || 0) + 1;

            devices.push(
              this.buildActiveDevice({
                id: observation.id,
                name: observation.name,
                latitude: observation.lat,
                longitude: observation.lon,
                pollutant,
                displayValue,
                unit: observation.unit,
                timestamp: observation.time,
                qualityLevel,
                address: observation.location_name || observation.name,
                correctedValue: displayValues.correctedValue,
                rawValue: displayValues.rawValue,
                hasCorrection: displayValues.hasCorrection,
              })
            );
          });

          temporalDataPoints.push({
            timestamp,
            devices,
            deviceCount: devices.length,
            averageValue: validValues > 0 ? totalValue / validValues : 0,
            qualityLevels,
          });
        }
      } catch {
        // Continuer avec les autres tranches
      }
    }

    temporalDataPoints.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return temporalDataPoints;
  }

  private resolveDisplayValues(
    observation: MicrospotObservation,
    aggregation: MicrospotAggregation
  ): {
    displayValue: number;
    correctedValue?: number;
    rawValue?: number;
    hasCorrection: boolean;
  } {
    const corrected =
      observation.value !== null && observation.value !== undefined
        ? observation.value
        : undefined;
    const raw =
      observation.value_raw !== null && observation.value_raw !== undefined
        ? observation.value_raw
        : undefined;
    const hasCorrection = corrected !== undefined && raw !== undefined;

    let displayValue: number;
    if (aggregation === 'quarter-hourly') {
      displayValue =
        observation.value_ref ?? raw ?? corrected ?? 0;
    } else {
      displayValue =
        hasCorrection && corrected !== undefined ? corrected : raw ?? corrected ?? 0;
    }

    return {
      displayValue,
      correctedValue: hasCorrection ? corrected : undefined,
      rawValue: raw,
      hasCorrection,
    };
  }

  private buildActiveDevice(params: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    pollutant: string;
    displayValue: number;
    unit: string;
    timestamp: string;
    qualityLevel: string;
    address: string;
    correctedValue?: number;
    rawValue?: number;
    hasCorrection: boolean;
  }): MeasurementDevice & {
    qualityLevel: string;
    address: string;
    departmentId: string;
    corrected_value?: number;
    raw_value?: number;
    has_correction?: boolean;
  } {
    return {
      id: params.id,
      name: params.name,
      latitude: params.latitude,
      longitude: params.longitude,
      source: this.sourceCode,
      pollutant: params.pollutant,
      value: params.displayValue,
      unit: params.unit,
      timestamp: params.timestamp,
      status: 'active',
      qualityLevel: params.qualityLevel,
      address: params.address,
      departmentId: '',
      corrected_value: params.correctedValue,
      raw_value: params.rawValue,
      has_correction: params.hasCorrection,
    };
  }

  private buildInactiveDevice(params: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    pollutant: string;
    address: string;
  }): MeasurementDevice & {
    qualityLevel: string;
    address: string;
    departmentId: string;
  } {
    return {
      id: params.id,
      name: params.name,
      latitude: params.latitude,
      longitude: params.longitude,
      source: this.sourceCode,
      pollutant: params.pollutant,
      value: 0,
      unit: 'µg/m³',
      timestamp: new Date().toISOString(),
      status: 'inactive',
      qualityLevel: 'default',
      address: params.address,
      departmentId: '',
    };
  }

  private buildAddress(
    device: MicrospotDevice,
    location?: MicrospotLocation
  ): string {
    const displayName = device.name || device.id;
    const influence = location?.influence || device.actual_location;
    return influence ? `${displayName}, ${influence}` : displayName;
  }

  private async parseScanIntervalFromAggregations(
    siteId: string,
    pollutant: string
  ): Promise<number | null> {
    const device = await this.fetchDeviceById(siteId);
    if (!device) return null;

    const isoCode = getMicrospotIsoCode(pollutant);
    const pollutantConfig = isoCode ? pollutants[MICROSPOT_ISO_TO_POLLUTANT[isoCode]] : null;
    const label = pollutantConfig?.name;

    for (const entry of device.aggregations ?? []) {
      const [name, intervalStr] = entry.split(':').map((s) => s.trim());
      if (label && name && name.includes(label.replace(/[₀-₉]/g, ''))) {
        const interval = Number(intervalStr);
        if (!isNaN(interval)) return interval;
      }
    }

    return null;
  }

  private parseVariablesFromAggregations(
    device: MicrospotDevice
  ): Record<string, { label: string; code_iso: string; en_service: boolean }> {
    const availableVariables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    > = {};

    for (const entry of device.aggregations ?? []) {
      const pollutantName = entry.split(':')[0]?.trim();
      if (!pollutantName) continue;

      const pollutantCode = this.labelToPollutantCode(pollutantName);
      if (pollutantCode && pollutants[pollutantCode]) {
        const isoCode = getMicrospotIsoCode(pollutantCode);
        availableVariables[pollutantCode] = {
          label: pollutants[pollutantCode].name,
          code_iso: isoCode ?? pollutantName,
          en_service: true,
        };
      }
    }

    return availableVariables;
  }

  private async resolveAvailableVariables(
    device: MicrospotDevice
  ): Promise<
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  > {
    const fromAggregations = this.parseVariablesFromAggregations(device);
    if (Object.keys(fromAggregations).length > 0) {
      return fromAggregations;
    }

    const fromMetadata = await this.fetchVariablesFromLatestMetadata(device.id);
    if (Object.keys(fromMetadata).length > 0) {
      return fromMetadata;
    }

    return this.probeDeviceVariablesByIso(device.id);
  }

  private async fetchVariablesFromLatestMetadata(
    deviceId: string
  ): Promise<
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  > {
    const isoCodes = [...new Set(Object.values(MICROSPOT_POLLUTANT_TO_ISO))];

    for (const iso of isoCodes) {
      try {
        const url = this.buildUrl('/observations/latest', {
          device_id: deviceId,
          aggregation: 'hourly',
          variable: iso,
          include: 'metadata',
          format: 'json',
          decimals: 0,
        });

        const response = await this.makeRequest(url);
        if (!response || !Array.isArray(response) || response.length === 0) {
          continue;
        }

        const first = response[0] as MicrospotObservation;
        const deviceVariables =
          first.device_variables ?? first.metadata?.device_variables;
        if (deviceVariables?.length) {
          return this.mapDeviceVariablesToPollutants(deviceVariables);
        }
      } catch {
        // Essayer une autre variable
      }
    }

    return {};
  }

  private mapDeviceVariablesToPollutants(
    deviceVariables: NonNullable<
      MicrospotObservation['device_variables']
    >
  ): Record<string, { label: string; code_iso: string; en_service: boolean }> {
    const availableVariables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    > = {};

    for (const entry of deviceVariables) {
      const pollutantCode = MICROSPOT_ISO_TO_POLLUTANT[entry.variable_id];
      if (pollutantCode && pollutants[pollutantCode]) {
        availableVariables[pollutantCode] = {
          label: pollutants[pollutantCode].name,
          code_iso: entry.variable_id,
          en_service: true,
        };
      }
    }

    return availableVariables;
  }

  private async probeDeviceVariablesByIso(
    deviceId: string
  ): Promise<
    Record<string, { label: string; code_iso: string; en_service: boolean }>
  > {
    const entries = Object.entries(MICROSPOT_POLLUTANT_TO_ISO);
    const probeResults = await Promise.all(
      entries.map(async ([pollutantCode, iso]) => {
        try {
          const response = await this.makeRequest(
            this.buildUrl('/lists/devices', {
              id: deviceId,
              variable: iso,
              format: 'json',
            })
          );
          if (Array.isArray(response) && response.length > 0) {
            return pollutantCode;
          }
        } catch {
          // Ignorer les erreurs de sonde
        }
        return null;
      })
    );

    const availableVariables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    > = {};

    for (const pollutantCode of probeResults) {
      if (!pollutantCode) continue;
      const isoCode = MICROSPOT_POLLUTANT_TO_ISO[pollutantCode];
      availableVariables[pollutantCode] = {
        label: pollutants[pollutantCode].name,
        code_iso: isoCode,
        en_service: true,
      };
    }

    return availableVariables;
  }

  private labelToPollutantCode(label: string): string | null {
    const normalized = label.toUpperCase().replace(/\s/g, '');
    const mapping: Record<string, string> = {
      'PM2.5': 'pm25',
      PM25: 'pm25',
      PM10: 'pm10',
      PM1: 'pm1',
      NO2: 'no2',
      O3: 'o3',
      SO2: 'so2',
    };
    return mapping[normalized] ?? null;
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | boolean | undefined>
  ): string {
    const base = MICROSPOT_BASE_URL.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
    const query = searchParams.toString();
    return query
      ? `${base}${normalizedPath}?${query}`
      : `${base}${normalizedPath}`;
  }

  private formatDateForHistoricalMode(
    dateString: string,
    isEndDate: boolean = false
  ): string {
    const hasTimeComponent = /T\d{2}:\d{2}/.test(dateString);

    if (!hasTimeComponent) {
      const [year, month, day] = dateString.split('-').map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(
          `Format de date invalide: ${dateString}. Format attendu: YYYY-MM-DD`
        );
      }

      if (isEndDate) {
        const localNextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
        return localNextDay.toISOString();
      }
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      return localDate.toISOString();
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Date invalide: ${dateString}`);
    }
    return date.toISOString();
  }

  private logPostFilterExcluded(
    excluded: Array<{ id: string; name: string; reason: string }>,
    context: { pollutant: string; isoCode: string }
  ): void {
    if (excluded.length === 0) return;
    console.groupCollapsed(
      `[Microspot][DEBUG] ${excluded.length} capteur(s) exclus apres filtrage (non affiches) - polluant=${context.pollutant}, variable=${context.isoCode}`
    );
    excluded.forEach((device) => {
      console.log(
        `[Microspot][POST_FILTER_EXCLUDED] id=${device.id} | nom="${device.name}" | raison=${device.reason}`
      );
    });
    console.groupEnd();
  }
}
