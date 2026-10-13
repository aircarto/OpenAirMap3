import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceLocationStay } from '../../types';
import { cn } from '../../lib/utils';
import CollapsiblePanelSection from './CollapsiblePanelSection';

export interface DeviceLocationsSectionProps {
  stays: DeviceLocationStay[];
  /** Survol / focus d'un site (highlight courbe). */
  highlightedLocationId: string | null;
  onHighlightLocation: (locationId: string | null) => void;
  onCenterLocation: (stay: DeviceLocationStay) => void;
  onLoadPeriod: (stay: DeviceLocationStay) => void;
  /** Préfixe de titre optionnel (mode comparaison : nom de station). */
  stationLabel?: string;
  storageKey?: string;
  className?: string;
}

const formatInterval = (start: string, end: string, locale: string): string => {
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };
  const startLabel = new Date(start).toLocaleDateString(locale, opts);
  const endLabel = new Date(end).toLocaleDateString(locale, opts);
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
};

/**
 * Encart repliable listant les sites successifs d'un microcapteur AtmoMicro.
 * Visible uniquement si stays.length >= 2 (filtré par l'appelant).
 */
const DeviceLocationsSection: React.FC<DeviceLocationsSectionProps> = ({
  stays,
  highlightedLocationId,
  onHighlightLocation,
  onCenterLocation,
  onLoadPeriod,
  stationLabel,
  storageKey = 'device-locations',
  className,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr')
    ? 'fr-FR'
    : i18n.language?.startsWith('en')
      ? 'en-GB'
      : i18n.language || 'fr-FR';

  const title = useMemo(() => {
    const base = t('panels.deviceLocations.title');
    return stationLabel ? `${stationLabel} — ${base}` : base;
  }, [stationLabel, t]);

  if (stays.length < 2) {
    return null;
  }

  return (
    <CollapsiblePanelSection
      title={title}
      storageKey={storageKey}
      defaultOpen={true}
      className={className}
      trailing={
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {t('panels.deviceLocations.count', { count: stays.length })}
        </span>
      }
    >
      <ul className="space-y-2" role="list">
        {stays.map((stay) => {
          const selected = highlightedLocationId === stay.locationId;
          return (
            <li
              key={stay.locationId}
              className={cn(
                'rounded-[var(--r-sm)] border px-2.5 py-2 transition-colors',
                selected
                  ? 'border-blue-300 bg-blue-50/80'
                  : 'border-[rgb(16_32_56_/_0.08)] bg-white hover:bg-slate-50'
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
                        {t('panels.deviceLocations.currentBadge')}
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
                      {t('panels.deviceLocations.influence', {
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
                      'inline-flex items-center justify-center rounded-[var(--r-sm)] border border-blue-200',
                      'bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700',
                      'hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2',
                      'focus-visible:ring-[color:var(--ring)]'
                    )}
                  >
                    {t('panels.deviceLocations.centerOnMap')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadPeriod(stay)}
                    className={cn(
                      'inline-flex items-center justify-center rounded-[var(--r-sm)] border border-slate-200',
                      'bg-white px-2 py-1 text-[11px] font-medium text-slate-700',
                      'hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2',
                      'focus-visible:ring-[color:var(--ring)]'
                    )}
                  >
                    {t('panels.deviceLocations.loadPeriod')}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </CollapsiblePanelSection>
  );
};

export default DeviceLocationsSection;
