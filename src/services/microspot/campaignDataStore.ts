import type { MicrospotObservation } from '../../types';

/**
 * Store colonnaire des mesures d'une extraction de campagne.
 *
 * Une campagne de 12 mois et plus en horaire, c'est 10⁶ lignes et au-delà.
 * Les garder en objets JSON coûte environ 1 Ko par ligne. Ici, une série
 * (capteur × variable) range ses colonnes dans des tableaux typés, et les
 * métadonnées répétées (site, coordonnées) sont dédupliquées dans une table.
 */

/** Booléen nullable encodé : -1 = null/absent, 0 = false, 1 = true. */
export type TriState = -1 | 0 | 1;

export interface RowLocation {
  locationId: string | null;
  locationName: string | null;
  lat: number | null;
  lon: number | null;
}

export interface SeriesInfo {
  key: string;
  deviceId: string;
  deviceName: string | null;
  brand: string | null;
  model: string | null;
  variableIso: string;
  variableName: string;
  unit: string;
}

export interface FinalizedSeries extends SeriesInfo {
  length: number;
  time: Float64Array; // epoch ms, trié croissant, sans doublon
  valueRef: Float64Array; // NaN = null
  value: Float64Array;
  valueRaw: Float64Array;
  valueN1: Float64Array;
  isN1: Int8Array;
  isN2: Int8Array;
  manuallyValidated: Int8Array;
  statusCode: (string | null)[];
  locationIndex: Uint32Array; // index dans CampaignDataStore.locations
}

const toNum = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : NaN;

const toTri = (v: boolean | null | undefined): TriState =>
  v === true ? 1 : v === false ? 0 : -1;

export const seriesKey = (deviceId: string, variableIso: string): string =>
  `${deviceId}|${variableIso}`;

class SeriesBuilder {
  readonly info: SeriesInfo;
  time: number[] = [];
  valueRef: number[] = [];
  value: number[] = [];
  valueRaw: number[] = [];
  valueN1: number[] = [];
  isN1: TriState[] = [];
  isN2: TriState[] = [];
  manuallyValidated: TriState[] = [];
  statusCode: (string | null)[] = [];
  locationIndex: number[] = [];

  constructor(info: SeriesInfo) {
    this.info = info;
  }

  finalize(): FinalizedSeries {
    const n = this.time.length;
    const order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) =>
        this.time[a]! - this.time[b]! || this.locationIndex[a]! - this.locationIndex[b]!
    );
    // Les fenêtres adjacentes peuvent se recouvrir d'un pas (bornes incluses) :
    // on ne garde qu'une ligne par horodatage ET par site. L'heure d'un
    // déménagement porte deux mesures distinctes, une par site (constaté sur
    // la campagne #134 le 2026-10-16 à 15:00) : elles sont toutes deux gardées.
    const kept: number[] = [];
    let lastTime = NaN;
    let lastLocation = -1;
    for (const i of order) {
      const t = this.time[i]!;
      const loc = this.locationIndex[i]!;
      if (t !== lastTime || loc !== lastLocation) {
        kept.push(i);
        lastTime = t;
        lastLocation = loc;
      }
    }
    const m = kept.length;
    const pickF = (src: number[]) => {
      const out = new Float64Array(m);
      kept.forEach((i, j) => (out[j] = src[i]!));
      return out;
    };
    const pickI8 = (src: TriState[]) => {
      const out = new Int8Array(m);
      kept.forEach((i, j) => (out[j] = src[i]!));
      return out;
    };
    const locationIndex = new Uint32Array(m);
    kept.forEach((i, j) => (locationIndex[j] = this.locationIndex[i]!));
    return {
      ...this.info,
      length: m,
      time: pickF(this.time),
      valueRef: pickF(this.valueRef),
      value: pickF(this.value),
      valueRaw: pickF(this.valueRaw),
      valueN1: pickF(this.valueN1),
      isN1: pickI8(this.isN1),
      isN2: pickI8(this.isN2),
      manuallyValidated: pickI8(this.manuallyValidated),
      statusCode: kept.map((i) => this.statusCode[i]!),
      locationIndex,
    };
  }
}

export class CampaignDataStore {
  readonly locations: RowLocation[] = [];
  private locationIndexByKey = new Map<string, number>();
  private builders = new Map<string, SeriesBuilder>();
  private finalized: Map<string, FinalizedSeries> | null = null;
  private rowsReceived = 0;

  get rowCount(): number {
    return this.rowsReceived;
  }

  private locationIndexFor(row: MicrospotObservation): number {
    const key = `${row.location_id ?? ''}|${row.location_name ?? ''}|${row.lat ?? ''}|${row.lon ?? ''}`;
    let index = this.locationIndexByKey.get(key);
    if (index === undefined) {
      index = this.locations.length;
      this.locations.push({
        locationId: row.location_id ?? null,
        locationName: row.location_name ?? null,
        lat: typeof row.lat === 'number' ? row.lat : null,
        lon: typeof row.lon === 'number' ? row.lon : null,
      });
      this.locationIndexByKey.set(key, index);
    }
    return index;
  }

  addRows(rows: MicrospotObservation[]): void {
    this.finalized = null;
    for (const row of rows) {
      const time = Date.parse(row.time);
      if (Number.isNaN(time)) continue;
      const key = seriesKey(row.id, row.variable_iso_code);
      let builder = this.builders.get(key);
      if (!builder) {
        builder = new SeriesBuilder({
          key,
          deviceId: row.id,
          deviceName: row.name ?? null,
          brand: row.brand ?? null,
          model: row.model ?? null,
          variableIso: row.variable_iso_code,
          variableName: row.variable_name,
          unit: row.unit,
        });
        this.builders.set(key, builder);
      }
      builder.time.push(time);
      builder.valueRef.push(toNum(row.value_ref));
      builder.value.push(toNum(row.value));
      builder.valueRaw.push(toNum(row.value_raw));
      builder.valueN1.push(toNum(row.value_n1));
      builder.isN1.push(toTri(row.is_n1_applied));
      builder.isN2.push(toTri(row.is_n2_applied));
      builder.manuallyValidated.push(toTri(row.manually_validated));
      builder.statusCode.push(row.status_code ?? null);
      builder.locationIndex.push(this.locationIndexFor(row));
      this.rowsReceived += 1;
    }
  }

  /** Séries triées (capteur, variable), prêtes pour le graphique et le CSV. */
  getSeries(): FinalizedSeries[] {
    if (!this.finalized) {
      this.finalized = new Map(
        [...this.builders.entries()].map(([k, b]) => [k, b.finalize()])
      );
    }
    return [...this.finalized.values()].sort(
      (a, b) =>
        a.deviceId.localeCompare(b.deviceId) ||
        a.variableIso.localeCompare(b.variableIso)
    );
  }

  getSeriesByKey(key: string): FinalizedSeries | undefined {
    if (!this.finalized) this.getSeries();
    return this.finalized!.get(key);
  }

  /** Nombre de lignes après dédoublonnage (= lignes du CSV). */
  get finalizedRowCount(): number {
    return this.getSeries().reduce((sum, s) => sum + s.length, 0);
  }

  /** Dernière position connue de chaque capteur (pour la carte). */
  lastPositionByDevice(): Map<string, RowLocation> {
    const out = new Map<string, RowLocation>();
    for (const s of this.getSeries()) {
      if (s.length === 0) continue;
      const loc = this.locations[s.locationIndex[s.length - 1]!];
      if (loc && loc.lat !== null && loc.lon !== null) out.set(s.deviceId, loc);
    }
    return out;
  }
}
