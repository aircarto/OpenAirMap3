import type { CampaignDataStore, TriState } from './campaignDataStore';

/**
 * Export CSV « long » d'une extraction de campagne : une ligne par
 * capteur × variable × heure. Pas d'en-tête de métadonnées, pour rester lisible
 * tel quel par R / Python ; le contexte est dans les colonnes et le nom du fichier.
 *
 * Séparateur `,`, point décimal, BOM UTF-8 — comme exportDataAsCSV, et le défaut
 * de read_csv (R, pandas).
 */

export const CSV_SEPARATOR = ',';
const BOM = '﻿';
const LOCAL_TIME_ZONE = 'Europe/Paris';
/** Lignes par part de Blob, avant de rendre la main à l'UI. */
const ROWS_PER_PART = 20_000;

export const CAMPAIGN_CSV_COLUMNS = [
  'time_utc',
  'time_local',
  'study_id',
  'study_name',
  'campaign_id',
  'campaign_name',
  'device_id',
  'device_name',
  'brand',
  'model',
  'location_id',
  'location_name',
  'lat',
  'lon',
  'site_key',
  'site_label',
  'variable_iso_code',
  'variable_name',
  'unit',
  'value_ref',
  'value',
  'value_raw',
  'value_n1',
  'is_n1_applied',
  'is_n2_applied',
  'manually_validated',
  'status_code',
  'status_label',
] as const;

export interface CampaignCsvContext {
  studyId: number | null;
  studyName: string | null;
  campaignId: number;
  campaignName: string;
  /** Libellés des codes d'état, par code. */
  statusLabels?: Map<string, string>;
  /** Nom des capteurs connu par ailleurs (devices_history), si l'API n'en donne pas. */
  deviceNames?: Map<string, string>;
  /**
   * Localisation de chaque ligne (entrée « par site » de la page) : clé de la
   * localisation fusionnée et libellé affiché. location_id / location_name
   * restent les valeurs brutes de l'API.
   */
  siteFor?: (seriesKey: string, rowIndex: number) => { key: string; label: string } | null;
}

export const escapeCsv = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const num = (v: number): string => (Number.isNaN(v) ? '' : String(v));
const tri = (v: TriState | number): string => (v === 1 ? 'true' : v === 0 ? 'false' : '');

const pad = (n: number) => String(n).padStart(2, '0');

let localFormatter: Intl.DateTimeFormat | null = null;
const getLocalFormatter = () =>
  (localFormatter ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: LOCAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }));

/** ISO 8601 UTC : `2026-08-11T07:00:00Z`. */
export const formatUtc = (ms: number): string =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** ISO 8601 heure de Paris avec décalage : `2026-08-11T09:00:00+02:00`. */
export const formatParisLocal = (ms: number): string => {
  const parts: Record<string, string> = {};
  for (const p of getLocalFormatter().formatToParts(new Date(ms))) {
    parts[p.type] = p.value;
  }
  const y = Number(parts.year);
  const mo = Number(parts.month);
  const d = Number(parts.day);
  const h = Number(parts.hour);
  const mi = Number(parts.minute);
  const s = Number(parts.second);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetMin = Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Génère le CSV par parts (Blob), en rendant la main régulièrement pour ne pas
 * figer l'onglet sur des millions de lignes.
 */
export async function buildCampaignCsvBlob(
  store: CampaignDataStore,
  context: CampaignCsvContext,
  onProgress?: (written: number, total: number) => void
): Promise<Blob> {
  const series = store.getSeries();
  const total = series.reduce((sum, s) => sum + s.length, 0);
  const parts: string[] = [BOM + CAMPAIGN_CSV_COLUMNS.join(CSV_SEPARATOR) + '\n'];
  const fixedPrefix = [
    escapeCsv(context.studyId),
    escapeCsv(context.studyName),
    escapeCsv(context.campaignId),
    escapeCsv(context.campaignName),
  ].join(CSV_SEPARATOR);

  let buffer: string[] = [];
  let written = 0;

  for (const s of series) {
    const deviceName = s.deviceName ?? context.deviceNames?.get(s.deviceId) ?? null;
    const seriesPrefix = [
      escapeCsv(s.deviceId),
      escapeCsv(deviceName),
      escapeCsv(s.brand),
      escapeCsv(s.model),
    ].join(CSV_SEPARATOR);
    const variableCols = [
      escapeCsv(s.variableIso),
      escapeCsv(s.variableName),
      escapeCsv(s.unit),
    ].join(CSV_SEPARATOR);

    for (let i = 0; i < s.length; i += 1) {
      const t = s.time[i]!;
      const loc = store.locations[s.locationIndex[i]!];
      const status = s.statusCode[i] ?? null;
      const site = context.siteFor?.(s.key, i) ?? null;
      buffer.push(
        [
          formatUtc(t),
          formatParisLocal(t),
          fixedPrefix,
          seriesPrefix,
          escapeCsv(loc?.locationId),
          escapeCsv(loc?.locationName),
          escapeCsv(loc?.lat),
          escapeCsv(loc?.lon),
          escapeCsv(site?.key),
          escapeCsv(site?.label),
          variableCols,
          num(s.valueRef[i]!),
          num(s.value[i]!),
          num(s.valueRaw[i]!),
          num(s.valueN1[i]!),
          tri(s.isN1[i]!),
          tri(s.isN2[i]!),
          tri(s.manuallyValidated[i]!),
          escapeCsv(status),
          escapeCsv(status ? context.statusLabels?.get(status) : null),
        ].join(CSV_SEPARATOR)
      );
      written += 1;
      if (buffer.length >= ROWS_PER_PART) {
        parts.push(buffer.join('\n') + '\n');
        buffer = [];
        onProgress?.(written, total);
        await yieldToUi();
      }
    }
  }
  if (buffer.length > 0) parts.push(buffer.join('\n') + '\n');
  onProgress?.(written, total);

  return new Blob(parts, { type: 'text/csv;charset=utf-8' });
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);

/** Date locale (celle saisie par l'utilisateur), pas UTC. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * `campagne_48_essais-en-atelier_2026-09-15_2026-11-19_horaire.csv`
 * `to` est exclusif (minuit du lendemain) : le nom porte le dernier jour inclus.
 */
export const campaignCsvFilename = (
  campaignId: number,
  campaignName: string,
  from: Date,
  to: Date
): string =>
  `campagne_${campaignId}_${slug(campaignName)}_${localDay(from)}_${localDay(new Date(to.getTime() - 1))}_horaire.csv`;
