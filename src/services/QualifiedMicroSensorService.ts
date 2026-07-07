import {
  DataService,
  HistoricalDataPoint,
  TemporalDataPoint,
} from '../types';

export class MicrospotMeasuresUnavailableError extends Error {
  constructor(message: string = 'MICROSPOT_MEASURES_UNAVAILABLE') {
    super(message);
    this.name = 'MicrospotMeasuresUnavailableError';
  }
}

export interface QualifiedMicroSensorService extends DataService {
  isMeasuresUnavailableIncident(): boolean;
  fetchSiteVariables(siteId: string): Promise<{
    variables: Record<
      string,
      { label: string; code_iso: string; en_service: boolean }
    >;
    sensorModel?: string;
  }>;
  fetchSensorTimeStep(
    siteId: string,
    pollutant: string
  ): Promise<number | null>;
  fetchSiteCoordinates(
    siteId: string
  ): Promise<{ latitude: number; longitude: number } | null>;
  fetchHistoricalData(params: {
    siteId: string;
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
  }): Promise<HistoricalDataPoint[]>;
  fetchTemporalData(params: {
    pollutant: string;
    timeStep: string;
    startDate: string;
    endDate: string;
    sites?: string[];
  }): Promise<TemporalDataPoint[]>;
}

export const isQualifiedMicroMeasuresUnavailableError = (
  error: unknown
): boolean =>
  error instanceof Error &&
  (error.name === 'AtmoMicroMeasuresUnavailableError' ||
    error.name === 'MicrospotMeasuresUnavailableError');
