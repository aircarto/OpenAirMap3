/** Instant calendaire local affiché sur la carte (pas UTC). */
export type MapInstant = {
  date: string;
  hour: number;
};

export type MapInstantMode = 'live' | 'exploration';

export type ModelingKind = 'azur' | 'aircrowd' | 'none';

export type TimeBarSlotKind = 'past' | 'live' | 'forecast';

export type TimeBarSlot = MapInstant & { kind: TimeBarSlotKind };

export const MAP_INSTANT_MEASUREMENT_TIME_STEPS = [
  'heure',
] as const;

export const isMapInstantAllowedForTimeStep = (timeStep: string): boolean =>
  (MAP_INSTANT_MEASUREMENT_TIME_STEPS as readonly string[]).includes(timeStep);

export const formatLocalIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const clampHour = (hour: number): number =>
  Math.max(0, Math.min(23, Math.floor(hour)));

export const toMapInstant = (date: Date): MapInstant => ({
  date: formatLocalIsoDate(date),
  hour: date.getHours(),
});

export const instantToLocalDate = (instant: MapInstant): Date => {
  const [y, m, d] = instant.date.split('-').map(Number);
  return new Date(y, m - 1, d, clampHour(instant.hour), 0, 0, 0);
};

export const addHoursToInstant = (
  instant: MapInstant,
  deltaHours: number
): MapInstant => {
  const date = instantToLocalDate(instant);
  date.setHours(date.getHours() + deltaHours);
  return toMapInstant(date);
};

export const compareInstants = (a: MapInstant, b: MapInstant): number =>
  instantToLocalDate(a).getTime() - instantToLocalDate(b).getTime();

export const isSameInstant = (a: MapInstant, b: MapInstant): boolean =>
  a.date === b.date && a.hour === b.hour;

export const hoursBetween = (from: MapInstant, to: MapInstant): number =>
  Math.round(
    (instantToLocalDate(to).getTime() - instantToLocalDate(from).getTime()) /
      (60 * 60 * 1000)
  );

export const currentHourInstant = (now: Date = new Date()): MapInstant => {
  const truncated = new Date(now);
  truncated.setMinutes(0, 0, 0);
  return toMapInstant(truncated);
};

/**
 * Dernière heure pleine (agrégat horaire déjà clos).
 * À 12:16 l’heure 12–13 n’est pas terminée : le créneau live est 11–12.
 */
export const lastCompletedHourInstant = (
  now: Date = new Date()
): MapInstant => addHoursToInstant(currentHourInstant(now), -1);

/** Index Azur 0–47 (h24 = heure en cours locale). Hors fenêtre → null. */
export const instantToAzurIndex = (
  instant: MapInstant,
  now: Date = new Date()
): number | null => {
  const live = currentHourInstant(now);
  const delta = hoursBetween(live, instant);
  const index = 24 + delta;
  if (index < 0 || index > 47) return null;
  return index;
};

export const azurIndexToInstant = (
  index: number,
  now: Date = new Date()
): MapInstant => {
  const safe = Math.max(0, Math.min(47, Math.floor(index)));
  return addHoursToInstant(currentHourInstant(now), safe - 24);
};

export const clampInstant = (
  instant: MapInstant,
  min: MapInstant,
  max: MapInstant
): MapInstant => {
  if (compareInstants(instant, min) < 0) return min;
  if (compareInstants(instant, max) > 0) return max;
  return { date: instant.date, hour: clampHour(instant.hour) };
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
  const start = instantToLocalDate(currentHourInstant(now));
  start.setDate(start.getDate() - days);
  return toMapInstant(start);
};

export type TimeBarWindow = {
  slots: TimeBarSlot[];
  liveIndex: number;
  minDate: string;
  maxDate: string;
  showForecastZone: boolean;
};

const kindForAzurIndex = (index: number): TimeBarSlotKind => {
  if (index < 24) return 'past';
  if (index === 24) return 'live';
  return 'forecast';
};

/** Fenêtre Azur : 48 créneaux horaires (passé + heure en cours + prévision). */
export const buildAzurTimeBarWindow = (
  now: Date = new Date()
): TimeBarWindow => {
  const slots: TimeBarSlot[] = [];
  for (let index = 0; index < 48; index += 1) {
    const instant = azurIndexToInstant(index, now);
    slots.push({ ...instant, kind: kindForAzurIndex(index) });
  }
  return {
    slots,
    liveIndex: 24,
    minDate: slots[0].date,
    maxDate: slots[slots.length - 1].date,
    showForecastZone: true,
  };
};

const enumerateHours = (from: MapInstant, to: MapInstant): MapInstant[] => {
  const result: MapInstant[] = [];
  let cursor = from;
  const guard = hoursBetween(from, to);
  const steps = Math.max(0, guard);
  for (let i = 0; i <= steps; i += 1) {
    result.push(cursor);
    if (isSameInstant(cursor, to)) break;
    cursor = addHoursToInstant(cursor, 1);
  }
  return result;
};

/**
 * Fenêtre AirCrowd : créneaux publiés, sinon chaque heure de minDate 00h
 * jusqu’à la dernière heure pleine (pas d’heure en cours incomplète).
 */
export const buildAirCrowdTimeBarWindow = (
  minDate: string,
  maxDate: string,
  now: Date = new Date(),
  availableByDate?: Record<string, number[]>
): TimeBarWindow => {
  const live = lastCompletedHourInstant(now);
  const min: MapInstant = { date: minDate, hour: 0 };
  const catalogMax: MapInstant = {
    date: maxDate < live.date ? maxDate : live.date,
    hour: maxDate < live.date ? 23 : live.hour,
  };
  const end =
    compareInstants(catalogMax, live) > 0 ? live : catalogMax;

  const instants: MapInstant[] = [];
  if (availableByDate && Object.keys(availableByDate).length > 0) {
    const dates = Object.keys(availableByDate).sort();
    for (const date of dates) {
      if (date < minDate || date > end.date) continue;
      const hours = availableByDate[date] ?? [];
      for (const hour of hours) {
        const slot = { date, hour: clampHour(hour) };
        if (compareInstants(slot, end) <= 0) instants.push(slot);
      }
    }
  }
  if (instants.length === 0) {
    instants.push(...enumerateHours(min, end));
  }

  const slots: TimeBarSlot[] = instants.map((instant) => ({
    ...instant,
    kind: isSameInstant(instant, live) ? 'live' : 'past',
  }));

  let liveIndex = slots.findIndex((slot) => slot.kind === 'live');
  if (liveIndex < 0) liveIndex = Math.max(0, slots.length - 1);

  return {
    slots,
    liveIndex,
    minDate: slots[0]?.date ?? minDate,
    maxDate: slots[slots.length - 1]?.date ?? maxDate,
    showForecastZone: false,
  };
};

/**
 * Mesures seules : 25 créneaux (24 h passées + dernière heure pleine),
 * ou les 24 h du jour choisi si l’instant exploré est plus ancien.
 */
export const buildMeasurementsTimeBarWindow = (
  now: Date = new Date(),
  explorationInstant: MapInstant | null = null
): TimeBarWindow => {
  const live = lastCompletedHourInstant(now);
  const withinDefault =
    !explorationInstant || hoursBetween(explorationInstant, live) <= 24;

  if (withinDefault) {
    const start = addHoursToInstant(live, -24);
    const instants = enumerateHours(start, live);
    const slots: TimeBarSlot[] = instants.map((instant) => ({
      ...instant,
      kind: isSameInstant(instant, live) ? 'live' : 'past',
    }));
    return {
      slots,
      liveIndex: slots.length - 1,
      minDate: slots[0].date,
      maxDate: slots[slots.length - 1].date,
      showForecastZone: false,
    };
  }

  const dayStart: MapInstant = { date: explorationInstant.date, hour: 0 };
  const isToday = explorationInstant.date === live.date;
  const dayEnd: MapInstant = {
    date: explorationInstant.date,
    hour: isToday ? live.hour : 23,
  };
  const instants = enumerateHours(dayStart, dayEnd);
  const slots: TimeBarSlot[] = instants.map((instant) => ({
    ...instant,
    kind: 'past',
  }));
  return {
    slots,
    liveIndex: -1,
    minDate: explorationInstant.date,
    maxDate: explorationInstant.date,
    showForecastZone: false,
  };
};

export const buildTimeBarWindow = (args: {
  kind: ModelingKind;
  now?: Date;
  aircrowdMinDate?: string;
  aircrowdMaxDate?: string;
  aircrowdHoursByDate?: Record<string, number[]>;
  explorationInstant?: MapInstant | null;
}): TimeBarWindow => {
  const now = args.now ?? new Date();
  if (args.kind === 'azur') return buildAzurTimeBarWindow(now);
  if (args.kind === 'aircrowd') {
    return buildAirCrowdTimeBarWindow(
      args.aircrowdMinDate ?? formatLocalIsoDate(now),
      args.aircrowdMaxDate ?? formatLocalIsoDate(now),
      now,
      args.aircrowdHoursByDate
    );
  }
  return buildMeasurementsTimeBarWindow(now, args.explorationInstant ?? null);
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

/** Libellé [heure de début, heure de fin] de l’agrégat horaire. */
export const formatInstantPeriod = (
  instant: MapInstant,
  locale: string,
  now: Date = new Date()
): string => {
  const start = instantToLocalDate(instant);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const live = lastCompletedHourInstant(now);
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

  const startTime = timeFmt.format(start).replace(':00', 'h');
  const endTime = timeFmt.format(end).replace(':00', 'h');
  if (sameDay) return `${startTime}–${endTime}`;
  return `${dateFmt.format(start)} ${startTime}–${endTime}`;
};

export const getSlotBadge = (
  mode: MapInstantMode,
  slot: TimeBarSlot | undefined
): 'live' | 'past' | 'forecast' => {
  if (mode === 'live') return 'live';
  if (slot?.kind === 'forecast' || slot?.kind === 'live') return 'forecast';
  return 'past';
};
