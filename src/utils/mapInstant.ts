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
      return 7;
    case 'heure':
      return 30;
    default:
      return 365;
  }
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
 * Bornes d’un bloc TimeBar / snapshot autour d’un focus.
 * Pas de plafond de recul : seule la fin est coupée au live, et on étend
 * alors le début pour garder 7 j / 30 j / 365 j.
 */
export const resolveBlockBounds = (
  focus: MapInstant,
  timeStep: string,
  now: Date = new Date()
): { start: MapInstant; end: MapInstant } => {
  const live = lastCompletedSlotInstant(timeStep, now);
  const clampedFocus =
    compareInstants(focus, live) > 0 ? live : normalizeInstant(focus, timeStep);
  const spanMinutes = getSnapshotBufferSpanMinutes(timeStep);
  const halfMinutes = spanMinutes / 2;

  let start = addMinutesToInstant(clampedFocus, -halfMinutes, timeStep);
  let end = addMinutesToInstant(clampedFocus, halfMinutes, timeStep);
  if (compareInstants(end, live) > 0) end = live;

  const spanMs = spanMinutes * 60 * 1000;
  const currentMs =
    instantToLocalDate(end).getTime() - instantToLocalDate(start).getTime();
  const missingMinutes = Math.round((spanMs - currentMs) / (60 * 1000));
  if (missingMinutes > 0 && compareInstants(end, live) >= 0) {
    start = addMinutesToInstant(start, -missingMinutes, timeStep);
  }

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
  const step = getSlotStepMinutes(timeStep);
  const result: MapInstant[] = [];
  let cursor = from;
  const guard = Math.ceil(
    (instantToLocalDate(to).getTime() - instantToLocalDate(from).getTime()) /
      (step * 60 * 1000)
  );
  const steps = Math.max(0, guard);
  for (let i = 0; i <= steps; i += 1) {
    result.push(cursor);
    if (isSameInstant(cursor, to)) break;
    cursor = addMinutesToInstant(cursor, step, timeStep);
  }
  return result;
};

/**
 * Fenêtre mesures : un bloc autour du focus (live par défaut).
 * 15 min → 7 j ; horaire → 30 j ; jour → 365 j. Pas de plafond depuis aujourd’hui :
 * une date ancienne ne s’étire pas jusqu’au live.
 * Si Azur est actif et que le bloc contient le live, 24 h de prévision suivent.
 */
export const buildMeasurementsTimeBarWindow = (
  timeStep: string,
  now: Date = new Date(),
  includeForecast = false,
  focus?: MapInstant
): TimeBarWindow => {
  const live = lastCompletedSlotInstant(timeStep, now);
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
}): TimeBarWindow => {
  const now = args.now ?? new Date();
  const includeForecast = args.kind === 'azur';
  return buildMeasurementsTimeBarWindow(
    args.timeStep,
    now,
    includeForecast,
    args.focus
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

/** Moitié de la fenêtre chargée (pour un centrage ±). */
export const getSnapshotBufferPadMinutes = (timeStep: string): number =>
  getSnapshotBufferSpanMinutes(timeStep) / 2;

export type SnapshotBufferWindow = {
  startInstant: MapInstant;
  endInstant: MapInstant;
  startDate: string;
  endDate: string;
};

/**
 * Fenêtre cache / graphique autour de l’instant : même bloc que la TimeBar
 * (7 j / 30 j / 365 j), sans plafond de recul, fin ≤ live.
 */
export const buildSnapshotBufferWindow = (
  instant: MapInstant,
  timeStep: string,
  now: Date = new Date()
): SnapshotBufferWindow => {
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
  now: Date = new Date()
): { startDate: string; endDate: string } => {
  const buffer = buildSnapshotBufferWindow(instant, timeStep, now);
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
): boolean => {
  if (!isInstantInBuffer(instant, buffer, timeStep)) return false;
  const t = instantToLocalDate(instant).getTime();
  const start = instantToLocalDate(buffer.startInstant).getTime();
  const end = instantToLocalDate(buffer.endInstant).getTime();
  const span = end - start;
  if (span <= 0) return false;
  const ratio = (t - start) / span;
  return ratio <= margin || ratio >= 1 - margin;
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

  const startTime = timeFmt.format(start).replace(':00', 'h');
  const endTime = timeFmt.format(end).replace(':00', 'h');
  if (sameDay) return `${startTime}–${endTime}`;
  return `${dateFmt.format(start)} ${startTime}–${endTime}`;
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

export const getSlotBadge = (
  mode: MapInstantMode,
  slot: TimeBarSlot | undefined
): 'live' | 'past' | 'forecast' => {
  if (mode === 'live') return 'live';
  if (slot?.kind === 'forecast') return 'forecast';
  return 'past';
};
