/** Limite API SignalAir par requête (jours calendaires). */
export const SIGNAL_AIR_CHUNK_MAX_DAYS = 30;

export type DateOnlyPeriod = { startDate: string; endDate: string };

const parseLocalDate = (isoDate: string): Date => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const formatLocalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Découpe une période calendaire en chunks ≤ `maxDays` (inclusifs).
 * Ex. 45 j → [0–30], [30–45] avec chevauchement d’1 jour au joint éventuel évité
 * en avançant le curseur d’un jour après chaque fin de chunk.
 */
export const chunkDatePeriod = (
  period: DateOnlyPeriod,
  maxDays: number = SIGNAL_AIR_CHUNK_MAX_DAYS
): DateOnlyPeriod[] => {
  const start = parseLocalDate(period.startDate);
  const end = parseLocalDate(period.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [period];
  }
  if (start > end) {
    return [{ startDate: period.endDate, endDate: period.startDate }];
  }

  const chunks: DateOnlyPeriod[] = [];
  let cursor = new Date(start.getTime());
  while (cursor <= end) {
    const chunkEnd = new Date(cursor.getTime());
    chunkEnd.setDate(chunkEnd.getDate() + maxDays);
    if (chunkEnd > end) {
      chunks.push({
        startDate: formatLocalDate(cursor),
        endDate: formatLocalDate(end),
      });
      break;
    }
    chunks.push({
      startDate: formatLocalDate(cursor),
      endDate: formatLocalDate(chunkEnd),
    });
    cursor = new Date(chunkEnd.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return chunks.length > 0 ? chunks : [period];
};

export const mergeSignalAirReportsById = <T extends { id: string }>(
  batches: T[][]
): T[] => {
  const byId = new Map<string, T>();
  for (const batch of batches) {
    for (const report of batch) {
      byId.set(report.id, report);
    }
  }
  return Array.from(byId.values());
};
