function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convertit l’index Azur (0–47, h24 = heure en cours locale) en créneau calendaire.
 * Aligné sur getModelingDisplayedPeriod / les layers WMTS azur_heure.
 */
export function getModelingHourCalendarSlot(
  modelingHourIndex: number,
  now: Date = new Date()
): { date: string; hour: number; start: Date; end: Date } {
  const safeIndex = Math.max(0, Math.min(47, Math.floor(modelingHourIndex)));
  const deltaHours = safeIndex - 24;

  const base = new Date(now);
  base.setMinutes(0, 0, 0);

  const start = new Date(base.getTime() + deltaHours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    date: formatLocalIsoDate(start),
    hour: start.getHours(),
    start,
    end,
  };
}

export function getModelingDisplayedPeriod(
  modelingHourIndex: number,
  locale: string,
  now: Date = new Date()
): string {
  const { start, end } = getModelingHourCalendarSlot(modelingHourIndex, now);

  const startDay = start.toDateString();
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  const baseDay = base.toDateString();

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

  if (startDay !== baseDay) {
    return `${dateFmt.format(start)} ${startTime}–${endTime}`;
  }

  return `${startTime}–${endTime}`;
}
