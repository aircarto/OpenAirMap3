import { BaseDataService } from './BaseDataService';
import {
  DataFetchParams,
  MeasurementDevice,
} from '../types';
import {
  METEO_FRANCE_FETCH_CONCURRENCY,
  METEO_FRANCE_MIN_ZOOM,
  convertMeteoRawValue,
  getMeteoQualityLevel,
  isMeteoVariableCode,
  meteoVariables,
  type MeteoVariable,
  type MeteoVariableCode,
} from '../constants/meteoVariables';

type MapBounds = NonNullable<DataFetchParams['bounds']>;

interface StationMeta {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: 'station' | 'bouee';
}

interface GeoJsonFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  properties?: Record<string, unknown>;
}

const PROXY_BASE = '/api/meteofrance';

const STATIONS_CACHE_MS = 60 * 60 * 1000; // liste stations : maj horaire MF

/**
 * Exécute des tâches async avec une concurrence limitée.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const current = nextIndex;
        nextIndex += 1;
        results[current] = await mapper(items[current]);
      }
    }
  );

  await Promise.all(workers);
  return results;
}

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cols[i] ?? '';
    });
    return row;
  });
};

const pickField = (
  row: Record<string, string>,
  candidates: string[]
): string | undefined => {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find((k) => k.toLowerCase() === candidate.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== '') {
      return row[found];
    }
  }
  return undefined;
};

const inBounds = (lat: number, lon: number, bounds: MapBounds): boolean =>
  lat >= bounds.south &&
  lat <= bounds.north &&
  lon >= bounds.west &&
  lon <= bounds.east;

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export class MeteoFranceService extends BaseDataService {
  private static stationsCache: StationMeta[] | null = null;
  private static boueesCache: StationMeta[] | null = null;
  private static lastStationsFetch = 0;
  private static lastBoueesFetch = 0;
  private static stationsPromise: Promise<StationMeta[]> | null = null;
  private static boueesPromise: Promise<StationMeta[]> | null = null;

  constructor() {
    super('meteoFrance');
  }

  async fetchData(params: DataFetchParams): Promise<MeasurementDevice[]> {
    const variableCode = params.meteoVariable || params.pollutant;
    if (!isMeteoVariableCode(variableCode)) {
      console.warn(`[meteoFrance] Variable météo non supportée: ${variableCode}`);
      return [];
    }

    if (params.timeStep !== 'instantane' && params.timeStep !== 'heure') {
      return [];
    }

    const zoom = params.zoom ?? 0;
    if (zoom < METEO_FRANCE_MIN_ZOOM) {
      return [];
    }

    const bounds = params.bounds;
    if (!bounds) {
      console.warn('[meteoFrance] Bounds manquantes — pas de fetch');
      return [];
    }

    const variable = meteoVariables[variableCode];

    try {
      const [stations, bouees] = await Promise.all([
        this.getStations(),
        this.getBouees(),
      ]);

      const inView = [...stations, ...bouees].filter((s) =>
        inBounds(s.latitude, s.longitude, bounds)
      );

      if (inView.length === 0) {
        return [];
      }

      const terrestrial = inView.filter((s) => s.kind === 'station');
      const buoyIds = inView.filter((s) => s.kind === 'bouee');

      const [stationDevices, buoyDevices] = await Promise.all([
        this.fetchTerrestrialObservations(terrestrial, params.timeStep, variable),
        this.fetchBuoyObservations(buoyIds, variable),
      ]);

      return [...stationDevices, ...buoyDevices];
    } catch (error) {
      console.error('[meteoFrance] Erreur fetchData:', error);
      throw error;
    }
  }

  private authOrHttpError(endpoint: string, status: number): string {
    if (status === 401 || status === 403) {
      return (
        `${endpoint} HTTP ${status} — JWT Météo-France invalide ou expiré. ` +
        'Régénérez un token sur le portail et mettez à jour METEOFRANCE_API_TOKEN dans .env.local, puis redémarrez le serveur.'
      );
    }
    return `${endpoint} HTTP ${status}`;
  }

  private async getStations(): Promise<StationMeta[]> {
    const now = Date.now();
    if (
      MeteoFranceService.stationsCache &&
      now - MeteoFranceService.lastStationsFetch < STATIONS_CACHE_MS
    ) {
      return MeteoFranceService.stationsCache;
    }

    if (MeteoFranceService.stationsPromise) {
      return MeteoFranceService.stationsPromise;
    }

    MeteoFranceService.stationsPromise = this.loadStationsList()
      .then((list) => {
        MeteoFranceService.stationsCache = list;
        MeteoFranceService.lastStationsFetch = Date.now();
        return list;
      })
      .finally(() => {
        MeteoFranceService.stationsPromise = null;
      });

    return MeteoFranceService.stationsPromise;
  }

  private async getBouees(): Promise<StationMeta[]> {
    const now = Date.now();
    if (
      MeteoFranceService.boueesCache &&
      now - MeteoFranceService.lastBoueesFetch < STATIONS_CACHE_MS
    ) {
      return MeteoFranceService.boueesCache;
    }

    if (MeteoFranceService.boueesPromise) {
      return MeteoFranceService.boueesPromise;
    }

    MeteoFranceService.boueesPromise = this.loadBoueesList()
      .then((list) => {
        MeteoFranceService.boueesCache = list;
        MeteoFranceService.lastBoueesFetch = Date.now();
        return list;
      })
      .finally(() => {
        MeteoFranceService.boueesPromise = null;
      });

    return MeteoFranceService.boueesPromise;
  }

  private async loadStationsList(): Promise<StationMeta[]> {
    // CSV par défaut ; geojson si disponible
    const response = await fetch(
      `${PROXY_BASE}/liste-stations?format=geojson`,
      { headers: { Accept: 'application/json,application/geo+json,text/csv,*/*' } }
    );

    if (!response.ok) {
      // Repli CSV sans format
      const csvResponse = await fetch(`${PROXY_BASE}/liste-stations`, {
        headers: { Accept: 'text/csv,*/*' },
      });
      if (!csvResponse.ok) {
        throw new Error(this.authOrHttpError('liste-stations', csvResponse.status));
      }
      const text = await csvResponse.text();
      return this.parseStationsFromCsv(text, 'station');
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return this.parseStationsFromGeoJson(text, 'station');
    }

    return this.parseStationsFromCsv(text, 'station');
  }

  private async loadBoueesList(): Promise<StationMeta[]> {
    const response = await fetch(`${PROXY_BASE}/liste-bouees?format=geojson`, {
      headers: { Accept: 'application/json,application/geo+json,text/csv,*/*' },
    });

    if (!response.ok) {
      const csvResponse = await fetch(`${PROXY_BASE}/liste-bouees`, {
        headers: { Accept: 'text/csv,*/*' },
      });
      if (!csvResponse.ok) {
        console.warn(
          `[meteoFrance] ${this.authOrHttpError('liste-bouees', csvResponse.status)}`
        );
        return [];
      }
      const text = await csvResponse.text();
      return this.parseStationsFromCsv(text, 'bouee');
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return this.parseStationsFromGeoJson(text, 'bouee');
    }

    return this.parseStationsFromCsv(text, 'bouee');
  }

  private parseStationsFromCsv(
    text: string,
    kind: 'station' | 'bouee'
  ): StationMeta[] {
    const rows = parseCsv(text);
    const results: StationMeta[] = [];

    for (const row of rows) {
      const id = pickField(row, [
        'id_station',
        'Id_station',
        'ID_STATION',
        'id_bouee',
        'Id_bouee',
        'id_bouees',
        'geo_id_insee',
      ]);
      const latRaw = pickField(row, [
        'Latitude',
        'latitude',
        'lat',
        'LAT',
        'Latitude_estation',
      ]);
      const lonRaw = pickField(row, [
        'Longitude',
        'longitude',
        'lon',
        'lng',
        'LON',
        'Longitude_estation',
      ]);
      const name =
        pickField(row, [
          'Nom_usuel',
          'nom_usuel',
          'Nom',
          'name',
          'libelle',
          'Libelle',
        ]) || id;

      const latitude = asNumber(latRaw);
      const longitude = asNumber(lonRaw);
      if (!id || latitude === null || longitude === null) continue;

      // Préserver les zéros non significatifs (départements 01–09)
      const paddedId =
        kind === 'station' && /^\d+$/.test(id) && id.length < 8
          ? id.padStart(8, '0')
          : id;

      results.push({
        id: paddedId,
        name: name || paddedId,
        latitude,
        longitude,
        kind,
      });
    }

    return results;
  }

  private parseStationsFromGeoJson(
    text: string,
    kind: 'station' | 'bouee'
  ): StationMeta[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }

    const features: GeoJsonFeature[] = Array.isArray(parsed)
      ? (parsed as GeoJsonFeature[])
      : Array.isArray((parsed as { features?: GeoJsonFeature[] }).features)
        ? (parsed as { features: GeoJsonFeature[] }).features
        : [];

    const results: StationMeta[] = [];

    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      const longitude = Array.isArray(coords) ? asNumber(coords[0]) : null;
      const latitude = Array.isArray(coords) ? asNumber(coords[1]) : null;

      const idRaw =
        props.geo_id_insee ??
        props.id_station ??
        props.id_bouee ??
        props.id_bouees ??
        props.id;
      const id = idRaw != null ? String(idRaw) : '';
      const name = String(
        props.nom_usuel ?? props.Nom_usuel ?? props.name ?? props.libelle ?? id
      );

      if (!id || latitude === null || longitude === null) continue;

      const paddedId =
        kind === 'station' && /^\d+$/.test(id) && id.length < 8
          ? id.padStart(8, '0')
          : id;

      results.push({
        id: paddedId,
        name,
        latitude,
        longitude,
        kind,
      });
    }

    return results;
  }

  private obsEndpoint(timeStep: string): string {
    return timeStep === 'instantane'
      ? 'station/infrahoraire-6m'
      : 'station/horaire';
  }

  private async fetchTerrestrialObservations(
    stations: StationMeta[],
    timeStep: string,
    variable: MeteoVariable
  ): Promise<MeasurementDevice[]> {
    if (stations.length === 0) return [];

    const endpoint = this.obsEndpoint(timeStep);

    const settled = await mapWithConcurrency(
      stations,
      METEO_FRANCE_FETCH_CONCURRENCY,
      async (station) => {
        try {
          const url = `${PROXY_BASE}/${endpoint}?id_station=${encodeURIComponent(station.id)}&format=geojson`;
          const response = await fetch(url, {
            headers: { Accept: 'application/geo+json,application/json,*/*' },
          });
          if (!response.ok) return null;
          const text = await response.text();
          if (!text || text.trim() === '[]' || text.trim() === '{}') return null;
          return this.featureToDevice(text, station, variable);
        } catch (error) {
          console.warn(`[meteoFrance] station ${station.id}:`, error);
          return null;
        }
      }
    );

    return settled.filter((d): d is MeasurementDevice => d !== null);
  }

  private async fetchBuoyObservations(
    bouees: StationMeta[],
    variable: MeteoVariable
  ): Promise<MeasurementDevice[]> {
    if (bouees.length === 0) return [];

    // API bouées : multi-id possible ; découper par paquets pour rester raisonnable
    const chunkSize = 20;
    const devices: MeasurementDevice[] = [];
    const metaById = new Map(bouees.map((b) => [b.id, b]));

    for (let i = 0; i < bouees.length; i += chunkSize) {
      const chunk = bouees.slice(i, i + chunkSize);
      const ids = chunk.map((b) => b.id).join(',');
      try {
        const url = `${PROXY_BASE}/bouees?id_bouees=${encodeURIComponent(ids)}&format=geojson`;
        const response = await fetch(url, {
          headers: { Accept: 'application/geo+json,application/json,*/*' },
        });
        if (!response.ok) continue;
        const text = await response.text();
        const features = this.extractFeatures(text);
        for (const feature of features) {
          const props = feature.properties || {};
          const idRaw =
            props.id_bouee ?? props.id_bouees ?? props.geo_id_insee ?? props.id;
          const id = idRaw != null ? String(idRaw) : '';
          const meta = metaById.get(id) || chunk[0];
          const device = this.propertiesToDevice(props, feature, meta, variable);
          if (device) devices.push(device);
        }
      } catch (error) {
        console.warn('[meteoFrance] bouees chunk:', error);
      }
    }

    return devices;
  }

  private extractFeatures(text: string): GeoJsonFeature[] {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed as GeoJsonFeature[];
      if (parsed?.features && Array.isArray(parsed.features)) {
        return parsed.features as GeoJsonFeature[];
      }
      if (parsed?.type === 'Feature') return [parsed as GeoJsonFeature];
      return [];
    } catch {
      return [];
    }
  }

  private featureToDevice(
    text: string,
    station: StationMeta,
    variable: MeteoVariable
  ): MeasurementDevice | null {
    const features = this.extractFeatures(text);
    if (features.length === 0) return null;
    // Prendre la feature la plus récente si plusieurs
    const feature = features[0];
    return this.propertiesToDevice(
      feature.properties || {},
      feature,
      station,
      variable
    );
  }

  private propertiesToDevice(
    props: Record<string, unknown>,
    feature: GeoJsonFeature,
    meta: StationMeta,
    variable: MeteoVariable
  ): MeasurementDevice | null {
    const raw = asNumber(props[variable.field]);
    if (raw === null) return null;

    const value = convertMeteoRawValue(raw, variable);
    const qualityLevel = getMeteoQualityLevel(value, variable.thresholds);

    const coords = feature.geometry?.coordinates;
    const longitude =
      (Array.isArray(coords) ? asNumber(coords[0]) : null) ?? meta.longitude;
    const latitude =
      (Array.isArray(coords) ? asNumber(coords[1]) : null) ?? meta.latitude;

    const timestamp = String(
      props.validity_time ??
        props.reference_time ??
        props.insert_time ??
        new Date().toISOString()
    );

    const windDirection = variable.directionField
      ? asNumber(props[variable.directionField])
      : null;

    const prefix = meta.kind === 'bouee' ? 'mf-bouee' : 'mf-station';

    return {
      id: `${prefix}-${meta.id}`,
      name: meta.name,
      latitude,
      longitude,
      source: this.sourceCode,
      pollutant: variable.code as MeteoVariableCode,
      value: Math.round(value * 10) / 10,
      unit: variable.unit,
      timestamp,
      status: 'active',
      qualityLevel,
      windDirection,
      isMeteo: true,
    };
  }
}
