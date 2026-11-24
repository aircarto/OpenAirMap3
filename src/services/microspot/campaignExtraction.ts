import type { MicrospotCampaignDevice } from '../../types';
import type { CampaignLocalisation } from './campaignLocalisations';
import {
  MicrospotAuthError,
  MicrospotCampaignClient,
  MicrospotHttpError,
  type MicrospotCampaignClientType,
} from './MicrospotCampaignClient';
import { CampaignDataStore } from './campaignDataStore';

/**
 * Extraction horaire d'une campagne entière, côté navigateur.
 *
 * Aucune agrégation de substitution : on demande de l'horaire, on reçoit de
 * l'horaire, quitte à émettre des centaines de requêtes. Une requête = un
 * capteur × une fenêtre de temps × toutes les variables choisies.
 *
 * Garde-fous de l'API (docs/api-routes.md) : pas de pagination, coupe à ~12 MiB
 * avec `X-Truncated: true`. Une fenêtre tronquée est coupée en deux et relancée,
 * jamais acceptée telle quelle.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * ~15 000 lignes par réponse. Une ligne avec tous les `include` pèse ~380 octets
 * (mesuré le 2026-11-19), soit ~5,7 Mo : la moitié du plafond de 12 MiB.
 */
export const TARGET_ROWS_PER_REQUEST = 15_000;
export const DEFAULT_CONCURRENCY = 6;
export const MAX_ATTEMPTS = 3;
/** En deçà, une fenêtre tronquée n'est plus coupée : elle passe en échec. */
const MIN_WINDOW_MS = HOUR_MS;

export interface ExtractionChunk {
  deviceId: string;
  from: Date;
  to: Date;
}

/** Période d'interrogation d'un capteur (bornes ISO, null = ouverte). */
export interface ExtractionInterval {
  start: string | null;
  end: string | null;
}

/** Un capteur à interroger, sur une ou plusieurs périodes. */
export interface ExtractionTarget {
  deviceId: string;
  intervals: ExtractionInterval[];
}

export interface ExtractionRequest {
  campaignId: number;
  targets: ExtractionTarget[];
  variables: string[]; // codes ISO
  from: Date;
  to: Date;
}

export interface ExtractionFailure {
  chunk: ExtractionChunk;
  message: string;
}

export interface ExtractionProgress {
  done: number;
  total: number;
  rows: number;
  failed: number;
}

export interface ExtractionResult {
  store: CampaignDataStore;
  failures: ExtractionFailure[];
  aborted: boolean;
  requests: number;
}

export interface ExtractionOptions {
  client?: Pick<MicrospotCampaignClientType, 'fetchObservationsChunk'>;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ExtractionProgress) => void;
  /** Reprise : ajoute au store existant (relance des tranches en échec). */
  store?: CampaignDataStore;
  /** Injecté par les tests pour ne pas attendre le backoff. */
  sleep?: (ms: number) => Promise<void>;
}

/** Fenêtre en jours, selon le nombre de variables (24 lignes/jour/variable). */
export const windowDaysFor = (variableCount: number): number =>
  Math.max(1, Math.floor(TARGET_ROWS_PER_REQUEST / (Math.max(1, variableCount) * 24)));

/**
 * Cibles d'extraction à partir des localisations cochées.
 *
 * Capteur dont toutes les localisations sont cochées : sa période sur la
 * campagne, d'un seul tenant (les trous entre déclarations ne perdent rien).
 * Sinon : l'union des présences sur les localisations cochées.
 */
export function buildExtractionTargets(
  devices: MicrospotCampaignDevice[],
  localisations: CampaignLocalisation[],
  selectedKeys: ReadonlySet<string>
): ExtractionTarget[] {
  const targets: ExtractionTarget[] = [];
  for (const device of devices) {
    const all = localisations.filter((l) => l.devices.some((d) => d.deviceId === device.id));
    const selected = all.filter((l) => selectedKeys.has(l.key));
    if (selected.length === 0) continue;
    if (selected.length === all.length) {
      targets.push({
        deviceId: device.id,
        intervals: [{ start: device.start_date, end: device.end_date }],
      });
      continue;
    }
    const intervals = selected.flatMap((l) =>
      l.devices.filter((d) => d.deviceId === device.id).flatMap((d) => d.presences)
    );
    if (intervals.length > 0) targets.push({ deviceId: device.id, intervals });
  }
  return targets;
}

/**
 * Intervalles en ms : intersection avec la période demandée, alignement sur
 * l'heure (début à l'heure inférieure, fin à l'heure supérieure, pour garder
 * le bucket horaire d'une déclaration de quelques minutes), puis fusion.
 */
const resolveIntervals = (
  intervals: ExtractionInterval[],
  reqFrom: number,
  reqTo: number
): [number, number][] => {
  const ranges: [number, number][] = [];
  for (const interval of intervals) {
    const s = interval.start ? Date.parse(interval.start) : NaN;
    const e = interval.end ? Date.parse(interval.end) : NaN;
    const startRaw = Number.isNaN(s) ? reqFrom : Math.max(reqFrom, s);
    const endRaw = Number.isNaN(e) ? reqTo : Math.min(reqTo, e);
    if (endRaw <= startRaw) continue;
    const start = Math.floor(startRaw / HOUR_MS) * HOUR_MS;
    const end = Math.min(Math.ceil(endRaw / HOUR_MS) * HOUR_MS, Math.max(reqTo, start + HOUR_MS));
    ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
};

/**
 * Découpe : pour chaque capteur, ses périodes (intersectées avec la période
 * demandée), puis tranches de `windowDaysFor` jours.
 */
export function planChunks(request: ExtractionRequest): ExtractionChunk[] {
  const windowMs = windowDaysFor(request.variables.length) * DAY_MS;
  const chunks: ExtractionChunk[] = [];
  const reqFrom = request.from.getTime();
  const reqTo = request.to.getTime();

  for (const target of request.targets) {
    for (const [start, end] of resolveIntervals(target.intervals, reqFrom, reqTo)) {
      for (let cursor = start; cursor < end; cursor += windowMs) {
        chunks.push({
          deviceId: target.deviceId,
          from: new Date(cursor),
          to: new Date(Math.min(cursor + windowMs, end)),
        });
      }
    }
  }
  return chunks;
}

/** Coupe une fenêtre en deux à l'heure près. */
export function splitChunk(chunk: ExtractionChunk): [ExtractionChunk, ExtractionChunk] | null {
  const from = chunk.from.getTime();
  const to = chunk.to.getTime();
  if (to - from <= MIN_WINDOW_MS) return null;
  const half = Math.max(HOUR_MS, Math.floor((to - from) / 2 / HOUR_MS) * HOUR_MS);
  const mid = from + half;
  return [
    { deviceId: chunk.deviceId, from: chunk.from, to: new Date(mid) },
    { deviceId: chunk.deviceId, from: new Date(mid), to: chunk.to },
  ];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';

/** Erreur réseau (fetch rejeté) ou HTTP transitoire. */
const isRetryable = (error: unknown): boolean =>
  (error instanceof MicrospotHttpError && error.retryable) ||
  error instanceof TypeError;

export async function runExtraction(
  request: ExtractionRequest,
  chunks: ExtractionChunk[],
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const client = options.client ?? MicrospotCampaignClient;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const sleep = options.sleep ?? defaultSleep;
  const store = options.store ?? new CampaignDataStore();
  const signal = options.signal;

  const queue = [...chunks];
  const failures: ExtractionFailure[] = [];
  let total = queue.length;
  let done = 0;
  let requests = 0;
  let fatal: unknown = null;

  const report = () =>
    options.onProgress?.({ done, total, rows: store.rowCount, failed: failures.length });
  report();

  /** Traite une tranche ; une tranche tronquée est remplacée par ses deux moitiés. */
  const processChunk = async (chunk: ExtractionChunk): Promise<void> => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (signal?.aborted || fatal) return;
      try {
        requests += 1;
        const result = await client.fetchObservationsChunk(
          {
            campaignId: request.campaignId,
            deviceId: chunk.deviceId,
            variables: request.variables,
            from: chunk.from,
            to: chunk.to,
          },
          signal
        );
        if (result.truncated) {
          const halves = splitChunk(chunk);
          if (!halves) {
            failures.push({
              chunk,
              message: 'Réponse tronquée par l’API (fenêtre minimale atteinte)',
            });
            return;
          }
          total += 1; // 1 tranche devient 2
          report();
          await processChunk(halves[0]);
          done += 1;
          report();
          await processChunk(halves[1]);
          return;
        }
        store.addRows(result.rows);
        return;
      } catch (error) {
        if (isAbort(error) || signal?.aborted) return;
        if (error instanceof MicrospotAuthError) {
          fatal = error;
          return;
        }
        if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        failures.push({
          chunk,
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
  };

  const worker = async () => {
    while (queue.length > 0 && !signal?.aborted && !fatal) {
      const chunk = queue.shift()!;
      await processChunk(chunk);
      done += 1;
      report();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  if (fatal) throw fatal;
  return { store, failures, aborted: Boolean(signal?.aborted), requests };
}
