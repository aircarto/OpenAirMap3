import React from "react";
import { useTranslation } from "react-i18next";
import type { DeviceLocationStay } from "../../types";
import { cn } from "../../lib/utils";

export interface DeviceLocationsListProps {
  stays: DeviceLocationStay[];
  /** Survol / focus d'un site (highlight courbe). */
  highlightedLocationId: string | null;
  onHighlightLocation: (locationId: string | null) => void;
  onCenterLocation: (stay: DeviceLocationStay) => void;
  onLoadPeriod: (stay: DeviceLocationStay) => void;
  /**
   * `default` : cartes détaillées (panneau capteur).
   * `compact` : lignes denses avec boutons icône (liste de comparaison).
   */
  variant?: "default" | "compact";
  className?: string;
}

const formatInterval = (start: string, end: string, locale: string): string => {
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  const startLabel = new Date(start).toLocaleDateString(locale, opts);
  const endLabel = new Date(end).toLocaleDateString(locale, opts);
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
};

const MapPinIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const iconButtonClass = cn(
  "inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] border transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
);

/**
 * Liste des sites successifs d'un microcapteur AtmoMicro (sans enveloppe).
 * Réutilisée par DeviceLocationsSection (panneau capteur) et par la liste
 * des stations du mode comparaison.
 */
const DeviceLocationsList: React.FC<DeviceLocationsListProps> = ({
  stays,
  highlightedLocationId,
  onHighlightLocation,
  onCenterLocation,
  onLoadPeriod,
  variant = "default",
  className,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("fr")
    ? "fr-FR"
    : i18n.language?.startsWith("en")
      ? "en-GB"
      : i18n.language || "fr-FR";

  if (variant === "compact") {
    return (
      <ul className={cn("space-y-1", className)} role="list">
        {stays.map((stay) => {
          const selected = highlightedLocationId === stay.locationId;
          const coords = `${stay.lat.toFixed(5)}, ${stay.lon.toFixed(5)}`;
          return (
            <li
              key={stay.locationId}
              title={coords}
              className={cn(
                "flex items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1.5 transition-colors",
                selected
                  ? "border-blue-300 bg-blue-50/80"
                  : "border-transparent hover:bg-slate-50",
              )}
              onMouseEnter={() => onHighlightLocation(stay.locationId)}
              onMouseLeave={() => onHighlightLocation(null)}
              onFocus={() => onHighlightLocation(stay.locationId)}
              onBlur={() => onHighlightLocation(null)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full border",
                  stay.isCurrent
                    ? "border-emerald-600 bg-emerald-500"
                    : "border-slate-400 bg-transparent",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-[color:var(--fg)]">
                    {stay.label}
                  </span>
                  {stay.isCurrent ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                      {t("panels.deviceLocations.currentBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-[color:var(--fg-muted)]">
                  {stay.intervals
                    .map((interval) =>
                      formatInterval(interval.start, interval.end, locale),
                    )
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onCenterLocation(stay)}
                  aria-label={`${t("panels.deviceLocations.centerOnMap")} — ${stay.label}`}
                  title={t("panels.deviceLocations.centerOnMap")}
                  className={cn(
                    iconButtonClass,
                    "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
                  )}
                >
                  <MapPinIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onLoadPeriod(stay)}
                  aria-label={`${t("panels.deviceLocations.loadPeriod")} — ${stay.label}`}
                  title={t("panels.deviceLocations.loadPeriod")}
                  className={cn(
                    iconButtonClass,
                    "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <CalendarIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={cn("space-y-2", className)} role="list">
      {stays.map((stay) => {
        const selected = highlightedLocationId === stay.locationId;
        return (
          <li
            key={stay.locationId}
            className={cn(
              "rounded-[var(--r-sm)] border px-2.5 py-2 transition-colors",
              selected
                ? "border-blue-300 bg-blue-50/80"
                : "border-[rgb(16_32_56_/_0.08)] bg-white hover:bg-slate-50",
            )}
            onMouseEnter={() => onHighlightLocation(stay.locationId)}
            onMouseLeave={() => onHighlightLocation(null)}
            onFocus={() => onHighlightLocation(stay.locationId)}
            onBlur={() => onHighlightLocation(null)}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-[color:var(--fg)]">
                    {stay.label}
                  </span>
                  {stay.isCurrent ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                      {t("panels.deviceLocations.currentBadge")}
                    </span>
                  ) : null}
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-[color:var(--fg-muted)]">
                  {stay.intervals.map((interval) => (
                    <li key={`${interval.start}-${interval.end}`}>
                      {formatInterval(interval.start, interval.end, locale)}
                    </li>
                  ))}
                </ul>
                {stay.influence ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t("panels.deviceLocations.influence", {
                      value: stay.influence,
                    })}
                  </p>
                ) : null}
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                  {stay.lat.toFixed(5)}, {stay.lon.toFixed(5)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onCenterLocation(stay)}
                  className={cn(
                    "inline-flex items-center justify-center rounded-[var(--r-sm)] border border-blue-200",
                    "bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700",
                    "hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-[color:var(--ring)]",
                  )}
                >
                  {t("panels.deviceLocations.centerOnMap")}
                </button>
                <button
                  type="button"
                  onClick={() => onLoadPeriod(stay)}
                  className={cn(
                    "inline-flex items-center justify-center rounded-[var(--r-sm)] border border-slate-200",
                    "bg-white px-2 py-1 text-[11px] font-medium text-slate-700",
                    "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-[color:var(--ring)]",
                  )}
                >
                  {t("panels.deviceLocations.loadPeriod")}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default DeviceLocationsList;
