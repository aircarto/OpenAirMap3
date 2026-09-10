import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  AIRCROWD_WMS_DEFAULT_END_DATE,
  AirCrowdWmsAvailability,
  fetchAirCrowdWmsAvailability,
  formatAirCrowdWmsHour,
  getAvailableHoursForAirCrowd,
  isAirCrowdLayerAvailable,
  isAirCrowdWmsPollutantSupported,
  pickNearestAvailableAirCrowdHour,
} from "../../services/AirCrowdWmsLayerService";

interface AirCrowdWmsControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  date: string;
  onDateChange: (date: string) => void;
  hour: number;
  onHourChange: (hour: number) => void;
  startDate: string;
  selectedPollutant: string;
  className?: string;
}

/**
 * PoC : toggle + date + heure pour la cartographie WMS AirCrowd.
 * Le calendrier est borné aux layers réellement publiés (GetCapabilities).
 */
const AirCrowdWmsControls: React.FC<AirCrowdWmsControlsProps> = ({
  enabled,
  onEnabledChange,
  date,
  onDateChange,
  hour,
  onHourChange,
  startDate,
  selectedPollutant,
  className,
}) => {
  const { t, i18n } = useTranslation();
  const pollutantOk = isAirCrowdWmsPollutantSupported(selectedPollutant);
  const disabled = !pollutantOk;
  const [availability, setAvailability] =
    useState<AirCrowdWmsAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAirCrowdWmsAvailability()
      .then((result) => {
        if (!cancelled) {
          setAvailability(result);
          setAvailabilityError(false);
        }
      })
      .catch((error) => {
        console.warn("[AIRCROWD WMS] GetCapabilities indisponible:", error);
        if (!cancelled) {
          setAvailability(null);
          setAvailabilityError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const minDate = availability?.minDate ?? startDate;
  const maxDate = availability?.maxDate ?? AIRCROWD_WMS_DEFAULT_END_DATE;
  const availableDates = pollutantOk
    ? Object.keys(availability?.byPollutant[selectedPollutant] ?? {}).sort()
    : [];
  const availableHours = pollutantOk
    ? getAvailableHoursForAirCrowd(availability, selectedPollutant, date)
    : [];
  const layerOk = isAirCrowdLayerAvailable(
    availability,
    selectedPollutant,
    date,
    hour
  );

  // Recaler date/heure sur un créneau publié dès que le catalogue est connu.
  useEffect(() => {
    if (!availability || !pollutantOk) return;

    const dates = Object.keys(
      availability.byPollutant[selectedPollutant] ?? {}
    ).sort();
    if (dates.length === 0) return;

    const nextDate = dates.includes(date)
      ? date
      : dates.find((d) => d >= date) ?? dates[dates.length - 1];
    if (nextDate !== date) {
      onDateChange(nextDate);
      return;
    }

    const hours = getAvailableHoursForAirCrowd(
      availability,
      selectedPollutant,
      nextDate
    );
    if (hours.length === 0) return;
    if (!hours.includes(hour)) {
      const nearest = pickNearestAvailableAirCrowdHour(hours, hour);
      if (nearest !== null) onHourChange(nearest);
    }
  }, [
    availability,
    pollutantOk,
    selectedPollutant,
    date,
    hour,
    onDateChange,
    onHourChange,
  ]);

  const hourLabel = formatAirCrowdWmsHour(hour);
  const periodLabel = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(y, m - 1, d, hour);
      return `${dt.toLocaleDateString(i18n.language, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} ${hourLabel}`;
    } catch {
      return `${date} ${hourLabel}`;
    }
  })();

  const hourMin = availableHours[0] ?? 0;
  const hourMax = availableHours[availableHours.length - 1] ?? 23;

  return (
    <div className={cn("flex flex-col gap-2 px-1", className)}>
      <label
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          disabled ? "cursor-not-allowed text-gray-400" : "text-gray-800"
        )}
      >
        <input
          type="checkbox"
          className="accent-[#4271B3]"
          checked={enabled && pollutantOk}
          disabled={disabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          data-testid="aircrowd-wms-toggle"
        />
        <span>{t("aircrowdWms.title")}</span>
      </label>

      {!pollutantOk ? (
        <p className="text-xs text-amber-700">
          {t("aircrowdWms.unsupportedPollutant")}
        </p>
      ) : null}

      {enabled && pollutantOk ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            <span>{t("aircrowdWms.date")}</span>
            <input
              type="date"
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
              min={minDate}
              max={maxDate}
              value={date}
              list={
                availableDates.length > 0 ? "aircrowd-wms-dates" : undefined
              }
              onChange={(e) => onDateChange(e.target.value)}
              data-testid="aircrowd-wms-date"
            />
            {availableDates.length > 0 ? (
              <datalist id="aircrowd-wms-dates">
                {availableDates.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            ) : null}
          </label>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
              <span>{t("aircrowdWms.hour")}</span>
              <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 font-medium tabular-nums text-gray-700">
                {periodLabel}
              </span>
            </div>
            <input
              type="range"
              min={hourMin}
              max={hourMax}
              step={1}
              value={Math.min(Math.max(hour, hourMin), hourMax)}
              onChange={(e) => {
                const requested = Number(e.target.value);
                if (availableHours.length === 0) {
                  onHourChange(requested);
                  return;
                }
                const nearest = pickNearestAvailableAirCrowdHour(
                  availableHours,
                  requested
                );
                if (nearest !== null) onHourChange(nearest);
              }}
              className="w-full accent-[#4271B3]"
              aria-label={t("aircrowdWms.hour")}
              data-testid="aircrowd-wms-hour"
            />
            {availableHours.length > 0 ? (
              <p className="text-[11px] text-gray-500">
                {t("aircrowdWms.availableHours", {
                  hours:
                    availableHours.length === 1
                      ? formatAirCrowdWmsHour(availableHours[0])
                      : `${formatAirCrowdWmsHour(availableHours[0])}–${formatAirCrowdWmsHour(
                          availableHours[availableHours.length - 1]
                        )} (${availableHours.length})`,
                })}
              </p>
            ) : null}
          </div>

          {!layerOk ? (
            <p className="text-xs text-amber-700">{t("aircrowdWms.layerMissing")}</p>
          ) : null}
          {availabilityError ? (
            <p className="text-xs text-amber-700">
              {t("aircrowdWms.capabilitiesError")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default AirCrowdWmsControls;
