/** Instant calendaire local affiché sur la carte (pas UTC). */
export type MapInstant = {
  date: string;
  hour: number;
  minute: number;
};

export type MapInstantMode = 'live' | 'exploration';

export type ModelingKind = 'azur' | 'none';

export type TimeBarSlotKind = 'past' | 'live' | 'forecast';

export type TimeBarSlot = MapInstant & { kind: TimeBarSlotKind };

export const MAP_INSTANT_ALLOWED_TIME_STEPS = [
  'quartHeure',
  'heure',
  'jour',
] as const;

export const isMapInstantAllowedForTimeStep = (timeStep: string): boolean =>
  (MAP_INSTANT_ALLOWED_TIME_STEPS as readonly string[]).includes(timeStep);

export const formatLocalIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const clampHour = (hour: number): number =>
  Math.max(0, Math.min(23, Math.floor(hour)));

export const clampQuarterMinute = (minute: number): number => {
  const snapped = Math.floor(minute / 15) * 15;
  return Math.max(0, Math.min(45, snapped));
};

export const getSlotStepMinutes = (timeStep: string): number => {
  switch (timeStep) {
    case 'quartHeure':
      return 15;
    case 'jour':
      return 24 * 60;
    default:
      return 60;
  }
};

export const toMapInstant = (
  date: Date,
  timeStep: string = 'heure'
): MapInstant => {
  if (timeStep === 'jour') {
    return { date: formatLocalIsoDate(date), hour: 0, minute: 0 };
  }
  if (timeStep === 'quartHeure') {
    return {
      date: formatLocalIsoDate(date),
      hour: date.getHours(),
      minute: clampQuarterMinute(date.getMinutes()),
    };
  }
  return {
    date: formatLocalIsoDate(date),
    hour: date.getHours(),
    minute: 0,
  };
};

export const normalizeInstant = (
  instant: Pick<MapInstant, 'date' | 'hour'> & { minute?: number },
  timeStep: string = 'heure'
): MapInstant => {
  const minute = instant.minute ?? 0;
  if (timeStep === 'jour') {
    return { date: instant.date, hour: 0, minute: 0 };
  }
  if (timeStep === 'quartHeure') {
    return {
      date: instant.date,
      hour: clampHour(instant.hour),
      minute: clampQuarterMinute(minute),
    };
  }
  return {
    date: instant.date,
    hour: clampHour(instant.hour),
    minute: 0,
  };
};

export const instantToLocalDate = (instant: MapInstant): Date => {
  const [y, m, d] = instant.date.split('-').map(Number);
  return new Date(
    y,
    m - 1,
    d,
    clampHour(instant.hour),
    instant.minute ?? 0,
    0,
    0
  );
};

export const addMinutesToInstant = (
  instant: MapInstant,
  deltaMinutes: number,
  timeStep: string = 'heure'
): MapInstant => {
  const date = instantToLocalDate(instant);
  date.setMinutes(date.getMinutes() + deltaMinutes);
  return toMapInstant(date, timeStep);
};

export const addHoursToInstant = (
  instant: MapInstant,
  deltaHours: number,
  timeStep: string = 'heure'
): MapInstant => addMinutesToInstant(instant, deltaHours * 60, timeStep);

export const compareInstants = (a: MapInstant, b: MapInstant): number =>
  instantToLocalDate(a).getTime() - instantToLocalDate(b).getTime();

export const isSameInstant = (a: MapInstant, b: MapInstant): boolean =>
  a.date === b.date &&
  a.hour === b.hour &&
  (a.minute ?? 0) === (b.minute ?? 0);

export const hoursBetween = (from: MapInstant, to: MapInstant): number =>
  Math.round(
    (instantToLocalDate(to).getTime() - instantToLocalDate(from).getTime()) /
      (60 * 60 * 1000)
  );

export const currentHourInstant = (now: Date = new Date()): MapInstant => {
  const truncated = new Date(now);
  truncated.setMinutes(0, 0, 0);
  return toMapInstant(truncated, 'heure');
};

/**
 * Dernière heure pleine (agrégat horaire déjà clos).
 * À 12:16 l’heure 12–13 n’est pas terminée : le créneau live est 11–12.
 */
export const lastCompletedHourInstant = (
  now: Date = new Date()
): MapInstant => addHoursToInstant(currentHourInstant(now), -1, 'heure');

export const lastCompletedSlotInstant = (
  timeStep: string,
  now: Date = new Date()
): MapInstant => {
  if (timeStep === 'jour') {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    startOfToday.setDate(startOfToday.getDate() - 1);
    return toMapInstant(startOfToday, 'jour');
  }
  if (timeStep === 'quartHeure') {
    const truncated = new Date(now);
    const quarter = clampQuarterMinute(truncated.getMinutes());
    truncated.setMinutes(quarter, 0, 0);
    truncated.setMinutes(truncated.getMinutes() - 15);
    return toMapInstant(truncated, 'quartHeure');
  }
  return lastCompletedHourInstant(now);
};

/** Index Azur 0–47 (h24 = heure en cours locale). Hors fenêtre → null. */
export const instantToAzurIndex = (
  instant: MapInstant,
  now: Date = new Date()
): number | null => {
  const live = currentHourInstant(now);
  const hourly: MapInstant = {
    date: instant.date,
    hour: clampHour(instant.hour),
    minute: 0,
  };
  const delta = hoursBetween(live, hourly);
  const index = 24 + delta;
  if (index < 0 || index > 47) return null;
  return index;
};

export const azurIndexToInstant = (
  index: number,
  now: Date = new Date()
): MapInstant => {
  const safe = Math.max(0, Math.min(47, Math.floor(index)));
  return addHoursToInstant(currentHourInstant(now), safe - 24, 'heure');
};

export const clampInstant = (
  instant: MapInstant,
  min: MapInstant,
  max: MapInstant,
  timeStep: string = 'heure'
): MapInstant => {
  const normalized = normalizeInstant(instant, timeStep);
  if (compareInstants(normalized, min) < 0) return min;
  if (compareInstants(normalized, max) > 0) return max;
  return normalized;
};

export const getLookbackDaysForTimeStep = (timeStep: string): number => {
  switch (timeStep) {
    case 'quartHeure':
    case 'heure':
      return 1;
    default:
      return 7;
  }
};

/** Plage custom choisie par l’utilisateur (bornes TimeBar navigables). */
export type TimeBarCustomRange = {
  start: MapInstant;
  end: MapInstant;
};

/**
 * Plafond de durée d’une plage custom selon le pas de temps.
 * qh = 5 j, heure = 14 j, jour = 6 mois calendaires.
 */
export const getMaxCustomRangeCalendarDays = (timeStep: string): number => {
  switch (timeStep) {
    case 'quartHeure':
      return 5;
    case 'heure':
      return 14;
    case 'jour':
      return 183; // approx pour messages ; le clamp calendaire utilise subtractCalendarMonths
    default:
      return 14;
  }
};

/** Soustrait N mois calendaires (même jour, clamp fin de mois). */
export const subtractCalendarMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
};

/** Instant plancher max pour une plage se terminant à `end` (6 mois calendaires pour jour). */
export const getMinInstantForCustomRangeEnd = (
  end: MapInstant,
  timeStep: string
): MapInstant => {
  const endDate = instantToLocalDate(end);
  if (timeStep === 'jour') {
    return toMapInstant(subtractCalendarMonths(endDate, 6), timeStep);
  }
  const days = getMaxCustomRangeCalendarDays(timeStep);
  const start = new Date(endDate.getTime());
  start.setDate(start.getDate() - days);
  return toMapInstant(start, timeStep);
};

/**
 * Clamp une plage custom : end ≤ live, start ≥ min(end), span ≤ plafond pas de temps.
 * Si start > end après normalisation, start = end.
 */
export const clampCustomRange = (
  range: TimeBarCustomRange,
  timeStep: string,
  now: Date = new Date()
): TimeBarCustomRange => {
  const live = lastCompletedSlotInstant(timeStep, now);
  let end = normalizeInstant(range.end, timeStep);
  if (compareInstants(end, live) > 0) end = live;
  let start = normalizeInstant(range.start, timeStep);
  const minStart = getMinInstantForCustomRangeEnd(end, timeStep);
  if (compareInstants(start, minStart) < 0) start = minStart;
  if (compareInstants(start, end) > 0) start = end;
  return { start, end };
};

/**
 * Propose une plage élargie pour couvrir `target` tout en respectant le plafond.
 * Hors bornes : ajoute un bloc lookback (24 h en qh/heure, 7 j en jour)
 * plutôt qu’un seul cran — la cible reste toujours incluse.
 */
export const proposeExpandedRange = (
  current: TimeBarCustomRange,
  targetInstant: MapInstant,
  timeStep: string,
  now: Date = new Date()
): TimeBarCustomRange => {
  const live = lastCompletedSlotInstant(timeStep, now);
  const target = clampInstant(
    normalizeInstant(targetInstant, timeStep),
    getTimeBarGoToMinInstant(timeStep),
    live,
    timeStep
  );
  const clamped = clampCustomRange(current, timeStep, now);

  if (
    compareInstants(target, clamped.start) >= 0 &&
    compareInstants(target, clamped.end) <= 0
  ) {
    return clamped;
  }

  const spanMinutes = getSnapshotBufferSpanMinutes(timeStep);

  if (compareInstants(target, clamped.start) < 0) {
    const chunkStart = addMinutesToInstant(
      clamped.start,
      -spanMinutes,
      timeStep
    );
    const start =
      compareInstants(target, chunkStart) < 0 ? target : chunkStart;
    return clampCustomRange({ start, end: clamped.end }, timeStep, now);
  }

  const chunkEnd = addMinutesToInstant(clamped.end, spanMinutes, timeStep);
  const end = compareInstants(target, chunkEnd) > 0 ? target : chunkEnd;
  return clampCustomRange({ start: clamped.start, end }, timeStep, now);
};

export const minInstantForLookback = (
  timeStep: string,
  now: Date = new Date()
): MapInstant => {
  const days = getLookbackDaysForTimeStep(timeStep);
  const live = lastCompletedSlotInstant(timeStep, now);
  const start = instantToLocalDate(live);
  start.setDate(start.getDate() - days);
  return toMapInstant(start, timeStep);
};

/** Plancher du date picker « Aller à » — pas une limite de données. */
export const TIME_BAR_GO_TO_MIN_DATE = '1900-01-01';

export const getTimeBarGoToMinInstant = (timeStep: string): MapInstant =>
  normalizeInstant(
    { date: TIME_BAR_GO_TO_MIN_DATE, hour: 0, minute: 0 },
    timeStep
  );

/** Dernier cran atteignable : live, ou fin de prévision Azur si elle est affichée. */
export const getTimeBarHorizonEnd = (
  timeStep: string,
  now: Date = new Date(),
  includeForecast = false
): MapInstant => {
  if (
    includeForecast &&
    (timeStep === 'heure' || timeStep === 'quartHeure')
  ) {
    return addHoursToInstant(currentHourInstant(now), 23, timeStep);
  }
  return lastCompletedSlotInstant(timeStep, now);
};

/**
 * Bornes d’un bloc TimeBar / snapshot en lookback depuis le focus.
 * end = focus (clampé au live) ; start = end − span (24 h ou 7 j).
 * Pas de centrage : à l’arrivée sur l’app, on navigue dans les dernières 24 h.
 */
export const resolveBlockBounds = (
  focus: MapInstant,
  timeStep: string,
  now: Date = new Date()
): { start: MapInstant; end: MapInstant } => {
  const live = lastCompletedSlotInstant(timeStep, now);
  const end =
    compareInstants(focus, live) > 0 ? live : normalizeInstant(focus, timeStep);
  const spanMinutes = getSnapshotBufferSpanMinutes(timeStep);
  const start = addMinutesToInstant(end, -spanMinutes, timeStep);
  return { start, end };
};

export type TimeBarWindow = {
  slots: TimeBarSlot[];
  liveIndex: number;
  minDate: string;
  maxDate: string;
  showForecastZone: boolean;
  startInstant: MapInstant;
  endInstant: MapInstant;
};

const enumerateSlots = (
  from: MapInstant,
  to: MapInstant,
  timeStep: string
): MapInstant[] => {
  const start = normalizeInstant(from, timeStep);
  const end = normalizeInstant(to, timeStep);
  if (compareInstants(start, end) > 0) return [start];

  const step = getSlotStepMinutes(timeStep);
  const result: MapInstant[] = [];
  let cursor = start;
  // Garde-fou : ~6 mois au pas 15 min ≈ 17 500 crans.
  const maxSteps = 20_000;
  for (let i = 0; i < maxSteps; i += 1) {
    result.push(cursor);
    if (isSameInstant(cursor, end)) break;
    const next = addMinutesToInstant(cursor, step, timeStep);
    // Évite tout dépassement si le cran suivant saute au-delà de `end`.
    if (compareInstants(next, end) > 0) break;
    cursor = next;
  }
  return result;
};

/**
 * Fenêtre mesures : lookback depuis le focus (live par défaut),
 * ou plage custom complète si `customRange` est fourni (pas de forecast).
 * 15 min / horaire → 24 h ; jour → 7 j. Une date ancienne ne s’étire pas jusqu’au live.
 * Si Azur est actif et que le bloc contient le live, 24 h de prévision suivent.
 */
export const buildMeasurementsTimeBarWindow = (
  timeStep: string,
  now: Date = new Date(),
  includeForecast = false,
  focus?: MapInstant,
  customRange?: TimeBarCustomRange | null
): TimeBarWindow => {
  const live = lastCompletedSlotInstant(timeStep, now);

  if (customRange) {
    const range = clampCustomRange(customRange, timeStep, now);
    const pastAndLive = enumerateSlots(range.start, range.end, timeStep);
    const slots: TimeBarSlot[] = pastAndLive.map((instant) => ({
      ...instant,
      kind: isSameInstant(instant, live) ? 'live' : 'past',
    }));
    const liveIndex = slots.findIndex((slot) => slot.kind === 'live');
    return {
      slots,
      liveIndex,
      minDate: slots[0]?.date ?? range.start.date,
      maxDate: slots[slots.length - 1]?.date ?? range.end.date,
      showForecastZone: false,
      startInstant: range.start,
      endInstant: range.end,
    };
  }

  const { start, end } = resolveBlockBounds(focus ?? live, timeStep, now);
  const pastAndLive = enumerateSlots(start, end, timeStep);
  const slots: TimeBarSlot[] = pastAndLive.map((instant) => ({
    ...instant,
    kind: isSameInstant(instant, live) ? 'live' : 'past',
  }));

  const includesLive = slots.some((slot) => slot.kind === 'live');
  const canForecast =
    includeForecast &&
    includesLive &&
    (timeStep === 'heure' || timeStep === 'quartHeure');
  if (canForecast) {
    const forecastEnd = addHoursToInstant(
      currentHourInstant(now),
      23,
      timeStep
    );
    const firstForecast = addMinutesToInstant(
      live,
      getSlotStepMinutes(timeStep),
      timeStep
    );
    if (compareInstants(firstForecast, forecastEnd) <= 0) {
      const forecastSlots = enumerateSlots(
        firstForecast,
        forecastEnd,
        timeStep
      );
      for (const instant of forecastSlots) {
        slots.push({ ...instant, kind: 'forecast' });
      }
    }
  }

  const liveIndex = slots.findIndex((slot) => slot.kind === 'live');
  return {
    slots,
    liveIndex,
    minDate: slots[0]?.date ?? start.date,
    maxDate: slots[slots.length - 1]?.date ?? end.date,
    showForecastZone: canForecast,
    startInstant: start,
    endInstant: end,
  };
};

export const buildTimeBarWindow = (args: {
  kind: ModelingKind;
  timeStep: string;
  now?: Date;
  focus?: MapInstant;
  customRange?: TimeBarCustomRange | null;
}): TimeBarWindow => {
  const now = args.now ?? new Date();
  // Plage custom : borne haute ≤ live → jamais de zone forecast.
  const includeForecast = args.kind === 'azur' && !args.customRange;
  return buildMeasurementsTimeBarWindow(
    args.timeStep,
    now,
    includeForecast,
    args.focus,
    args.customRange
  );
};

export const isInstantInSlotRange = (
  instant: MapInstant,
  slots: Array<Pick<MapInstant, 'date' | 'hour' | 'minute'>>,
  timeStep: string
): boolean => {
  if (slots.length === 0) return false;
  return isInstantInBuffer(
    instant,
    {
      startInstant: slots[0],
      endInstant: slots[slots.length - 1],
    },
    timeStep
  );
};

/** Cran juste avant le premier / après le dernier slot, ou null si hors bornes Aller à / horizon. */
export const adjacentInstantBeyondSlots = (
  slots: MapInstant[],
  direction: 'past' | 'future',
  timeStep: string,
  now: Date = new Date(),
  includeForecast = false
): MapInstant | null => {
  if (slots.length === 0) return null;
  const step = getSlotStepMinutes(timeStep);
  if (direction === 'future') {
    const next = addMinutesToInstant(
      slots[slots.length - 1],
      step,
      timeStep
    );
    const horizon = getTimeBarHorizonEnd(timeStep, now, includeForecast);
    if (compareInstants(next, horizon) > 0) return null;
    return next;
  }
  const previous = addMinutesToInstant(slots[0], -step, timeStep);
  if (compareInstants(previous, getTimeBarGoToMinInstant(timeStep)) < 0) {
    return null;
  }
  return previous;
};

export const findSlotIndex = (
  slots: TimeBarSlot[],
  instant: MapInstant
): number => {
  const exact = slots.findIndex((slot) => isSameInstant(slot, instant));
  if (exact >= 0) return exact;

  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  const target = instantToLocalDate(instant).getTime();
  for (let i = 0; i < slots.length; i += 1) {
    const dist = Math.abs(instantToLocalDate(slots[i]).getTime() - target);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
};

export const instantToIsoLocal = (instant: MapInstant): string => {
  const hh = String(clampHour(instant.hour)).padStart(2, '0');
  const mm = String(instant.minute ?? 0).padStart(2, '0');
  return `${instant.date}T${hh}:${mm}:00`;
};

/**
 * Bornes ISO UTC d’un créneau, pour fetchTemporalData.
 * Réutilise la conversion locale→UTC de getCustomRangeISO.
 */
export const buildSlotFetchWindow = (
  instant: MapInstant,
  timeStep: string
): { startDate: string; endDate: string; targetMs: number } => {
  const start = instantToLocalDate(instant);
  const step = getSlotStepMinutes(timeStep);
  const end = new Date(start.getTime() + step * 60 * 1000 - 1);
  const startDate = start.toISOString();
  const endDate = end.toISOString();
  const targetMs = start.getTime() + (step * 60 * 1000) / 2;
  return { startDate, endDate, targetMs };
};

export const getSnapshotBufferSpanMinutes = (timeStep: string): number =>
  getLookbackDaysForTimeStep(timeStep) * 24 * 60;

/** Moitié de la fenêtre chargée (prefetch près des bords). */
export const getSnapshotBufferPadMinutes = (timeStep: string): number =>
  getSnapshotBufferSpanMinutes(timeStep) / 2;

export type SnapshotBufferWindow = {
  startInstant: MapInstant;
  endInstant: MapInstant;
  startDate: string;
  endDate: string;
};

/**
 * Fenêtre cache / graphique.
 * - Sans plage custom : lookback 24 h / 7 j autour du focus.
 * - Avec plage custom : toute la période navigable (un seul chargement).
 */
export const buildSnapshotBufferWindow = (
  instant: MapInstant,
  timeStep: string,
  now: Date = new Date(),
  navigableRange?: TimeBarCustomRange | null
): SnapshotBufferWindow => {
  if (navigableRange) {
    const range = clampCustomRange(navigableRange, timeStep, now);
    const endExclusive = addMinutesToInstant(
      range.end,
      getSlotStepMinutes(timeStep),
      timeStep
    );
    const endDate = new Date(instantToLocalDate(endExclusive).getTime() - 1);
    return {
      startInstant: range.start,
      endInstant: range.end,
      startDate: instantToLocalDate(range.start).toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  const { start, end } = resolveBlockBounds(instant, timeStep, now);
  const endExclusive = addMinutesToInstant(
    end,
    getSlotStepMinutes(timeStep),
    timeStep
  );
  const endDate = new Date(instantToLocalDate(endExclusive).getTime() - 1);

  return {
    startInstant: start,
    endInstant: end,
    startDate: instantToLocalDate(start).toISOString(),
    endDate: endDate.toISOString(),
  };
};

export const buildChartRangeAroundInstant = (
  instant: MapInstant,
  timeStep: string,
  now: Date = new Date(),
  navigableRange?: TimeBarCustomRange | null
): { startDate: string; endDate: string } => {
  const buffer = buildSnapshotBufferWindow(
    instant,
    timeStep,
    now,
    navigableRange
  );
  return { startDate: buffer.startDate, endDate: buffer.endDate };
};

export const isInstantInBuffer = (
  instant: MapInstant,
  buffer: Pick<SnapshotBufferWindow, 'startInstant' | 'endInstant'>,
  timeStep: string
): boolean => {
  const t = instantToLocalDate(instant).getTime();
  const start = instantToLocalDate(buffer.startInstant).getTime();
  const endExclusive = instantToLocalDate(
    addMinutesToInstant(
      buffer.endInstant,
      getSlotStepMinutes(timeStep),
      timeStep
    )
  ).getTime();
  return t >= start && t < endExclusive;
};

/** true si l’instant est dans le buffer mais dans les `margin` (ex. 25 %) d’un bord. */
export const shouldPrefetchBuffer = (
  instant: MapInstant,
  buffer: Pick<SnapshotBufferWindow, 'startInstant' | 'endInstant'>,
  timeStep: string,
  margin = 0.25
): boolean => getPrefetchEdgeDirection(instant, buffer, timeStep, margin) !== null;

/**
 * Direction du bord atteint pour le prefetch (null si loin des bords).
 * `past` = près du début du buffer, `future` = près de la fin.
 */
export const getPrefetchEdgeDirection = (
  instant: MapInstant,
  buffer: Pick<SnapshotBufferWindow, 'startInstant' | 'endInstant'>,
  timeStep: string,
  margin = 0.25
): 'past' | 'future' | null => {
  if (!isInstantInBuffer(instant, buffer, timeStep)) return null;
  const t = instantToLocalDate(instant).getTime();
  const start = instantToLocalDate(buffer.startInstant).getTime();
  const end = instantToLocalDate(buffer.endInstant).getTime();
  const span = end - start;
  if (span <= 0) return null;
  const ratio = (t - start) / span;
  if (ratio <= margin) return 'past';
  if (ratio >= 1 - margin) return 'future';
  return null;
};

/**
 * Fenêtre cache adjacente dans une direction (même span lookback),
 * clampée optionnellement dans une plage navigable.
 */
export const buildAdjacentSnapshotBufferWindow = (
  current: Pick<SnapshotBufferWindow, 'startInstant' | 'endInstant'>,
  direction: 'past' | 'future',
  timeStep: string,
  now: Date = new Date(),
  navigableRange?: TimeBarCustomRange | null
): SnapshotBufferWindow => {
  const spanMinutes = getSnapshotBufferSpanMinutes(timeStep);
  const step = getSlotStepMinutes(timeStep);
  let focus: MapInstant;
  if (direction === 'past') {
    focus = addMinutesToInstant(current.startInstant, -step, timeStep);
  } else {
    focus = addMinutesToInstant(current.endInstant, spanMinutes, timeStep);
  }
  const live = lastCompletedSlotInstant(timeStep, now);
  if (compareInstants(focus, live) > 0) focus = live;
  if (navigableRange) {
    const range = clampCustomRange(navigableRange, timeStep, now);
    if (compareInstants(focus, range.start) < 0) focus = range.start;
    if (compareInstants(focus, range.end) > 0) focus = range.end;
  }
  return buildSnapshotBufferWindow(focus, timeStep, now, navigableRange);
};

export const snapshotBufferKey = (
  buffer: Pick<SnapshotBufferWindow, 'startDate' | 'endDate'>,
  pollutant: string,
  timeStep: string,
  sourcesKey: string
): string =>
  `${buffer.startDate}|${buffer.endDate}|${pollutant}|${timeStep}|${sourcesKey}`;

export const formatInstantPeriod = (
  instant: MapInstant,
  locale: string,
  timeStep: string = 'heure',
  now: Date = new Date()
): string => {
  const start = instantToLocalDate(instant);
  const step = getSlotStepMinutes(timeStep);
  const end = new Date(start.getTime() + step * 60 * 1000);
  const live = lastCompletedSlotInstant(timeStep, now);
  const sameDay = instant.date === live.date;

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  if (timeStep === 'jour') {
    return dateFmt.format(start);
  }

  const startTime = timeFmt.format(start).replace(/:00/g, 'h');
  const endTime = timeFmt.format(end).replace(/:00/g, 'h');
  if (sameDay) return `${startTime}–${endTime}`;
  return `${dateFmt.format(start)} ${startTime}–${endTime}`;
};

/**
 * Label de survol TimeBar : date toujours visible, formatée selon la locale
 * (ex. « mer. 10 sept. · 14:00–15:00 »).
 */
export const formatInstantHoverLabel = (
  instant: MapInstant,
  locale: string,
  timeStep: string = 'heure',
  now: Date = new Date()
): string => {
  const start = instantToLocalDate(instant);
  const step = getSlotStepMinutes(timeStep);
  const end = new Date(start.getTime() + step * 60 * 1000);
  const includeYear = start.getFullYear() !== now.getFullYear();

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(includeYear || timeStep === 'jour' ? { year: 'numeric' as const } : {}),
  });

  if (timeStep === 'jour') {
    return dateFmt.format(start);
  }

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
};

export const formatBlockRangeLabel = (
  start: MapInstant,
  end: MapInstant,
  locale: string
): string => {
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${dateFmt.format(instantToLocalDate(start))} – ${dateFmt.format(
    instantToLocalDate(end)
  )}`;
};

/**
 * Libellé de confirmation d’extension : met en avant le cran cible
 * (évite une plage date-seule qui paraît inchangée, ex. toujours « 27–29 août »).
 */
export const formatExpandConfirmLabel = (
  proposed: TimeBarCustomRange,
  target: MapInstant,
  locale: string,
  timeStep: string,
  now: Date = new Date()
): string => {
  const until = formatInstantHoverLabel(target, locale, timeStep, now);
  const range = formatBlockRangeLabel(proposed.start, proposed.end, locale);
  return `${until} (${range})`;
};

/** Label court pour une borne TimeBar (extrémité de piste) — date seule. */
export const formatBoundDateLabel = (
  instant: MapInstant,
  locale: string,
  _timeStep: string = 'heure'
): string => {
  const date = instantToLocalDate(instant);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

export const getSlotBadge = (
  mode: MapInstantMode,
  slot: TimeBarSlot | undefined
): 'live' | 'past' | 'forecast' => {
  if (mode === 'live') return 'live';
  if (slot?.kind === 'forecast') return 'forecast';
  return 'past';
};

/**
 * Évolutions futures (hors v0 TimeBar plage custom) :
 * - Annotations TimeBar (pics polluant sélectionné, événements)
 * - Couche incendie EFFIS synchronisée sur l’instant TimeBar
 * - Azur : h23 = dernière heure pleine ; historique limité ~24 h
 */
