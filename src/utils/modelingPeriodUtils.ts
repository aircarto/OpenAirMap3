export function getModelingDisplayedPeriod(
  modelingHourIndex: number,
  locale: string
): string {
  const safeIndex = Math.max(0, Math.min(47, modelingHourIndex));
  const deltaHours = safeIndex - 24; // h24 = heure en cours

  const base = new Date();
  base.setMinutes(0, 0, 0);

  const start = new Date(base.getTime() + deltaHours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const startDay = start.toDateString();
  const baseDay = base.toDateString();

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const startTime = timeFmt.format(start).replace(":00", "h");
  const endTime = timeFmt.format(end).replace(":00", "h");

  // Si on sort du jour courant, inclure la date pour éviter l'ambiguïté.
  if (startDay !== baseDay) {
    return `${dateFmt.format(start)} ${startTime}–${endTime}`;
  }

  return `${startTime}–${endTime}`;
}

