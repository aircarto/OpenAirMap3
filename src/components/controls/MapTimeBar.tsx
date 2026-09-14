import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import PollutionEpisodeCalendar from './PollutionEpisodeCalendar';
import { cn } from '../../lib/utils';
import {
  formatInstantPeriod,
  getSlotBadge,
  type MapInstantMode,
  type TimeBarSlot,
} from '../../utils/mapInstant';

export interface MapTimeBarProps {
  visible: boolean;
  mode: MapInstantMode;
  slots: TimeBarSlot[];
  index: number;
  liveIndex: number;
  showForecastZone: boolean;
  minDate: string;
  maxDate: string;
  selectedPollutant: string;
  loading?: boolean;
  onIndexChange: (index: number) => void;
  onGoLive: () => void;
  onGoToDate: (date: string) => void;
}

const MapTimeBar: React.FC<MapTimeBarProps> = ({
  visible,
  mode,
  slots,
  index,
  liveIndex,
  showForecastZone,
  minDate,
  maxDate,
  selectedPollutant,
  loading = false,
  onIndexChange,
  onGoLive,
  onGoToDate,
}) => {
  const { t, i18n } = useTranslation();
  const barRef = useRef<HTMLElement | null>(null);
  const [goToOpen, setGoToOpen] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    const column = bar?.parentElement;
    if (!visible || !bar || !column) {
      column?.style.setProperty('--timebar-inset', '0px');
      return;
    }

    const publish = () => {
      const bottomPx = Number.parseFloat(getComputedStyle(bar).bottom) || 8;
      column.style.setProperty(
        '--timebar-inset',
        `${bar.offsetHeight + bottomPx + 8}px`
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      column.style.removeProperty('--timebar-inset');
    };
  }, [visible, slots.length]);

  if (!visible || slots.length === 0) {
    return null;
  }

  const safeIndex = Math.max(0, Math.min(slots.length - 1, index));
  const slot = slots[safeIndex];
  const badge = getSlotBadge(mode, slot);
  const maxIndex = Math.max(0, slots.length - 1);
  const forecastStart =
    showForecastZone && liveIndex >= 0
      ? Math.max(0, Math.min(maxIndex, liveIndex))
      : null;
  const forecastPct =
    forecastStart !== null && maxIndex > 0
      ? (forecastStart / maxIndex) * 100
      : 100;

  const periodLabel = formatInstantPeriod(slot, i18n.language);
  const sliderLabel = `${t('timeBar.slider')}: ${periodLabel}`;

  const goPrev = () => {
    if (safeIndex > 0) onIndexChange(safeIndex - 1);
  };
  const goNext = () => {
    if (safeIndex < maxIndex) onIndexChange(safeIndex + 1);
  };

  const handleGoToDate = (date: string) => {
    onGoToDate(date);
    setGoToOpen(false);
  };

  return (
    <section
      ref={barRef}
      data-testid="map-timebar"
      data-tour="map-timebar"
      aria-label={t('timeBar.regionLabel')}
      className={cn(
        'glass-1 pointer-events-auto absolute z-map-search',
        'right-2',
        'flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3'
      )}
      style={{
        borderRadius: 'var(--r-lg)',
        bottom:
          'calc(var(--rail-bottom-inset, 0px) + var(--attribution-inset, 1.65rem))',
        left: 'max(0.5rem, calc(var(--rail-inset, 0px) + 0.35rem), var(--instrument-band, 0px))',
      }}
    >
      <button
        type="button"
        onClick={onGoLive}
        aria-pressed={mode === 'live'}
        data-testid="map-timebar-now"
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-md)] px-2.5 text-xs font-semibold',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))] focus-visible:ring-offset-2',
          mode === 'live'
            ? 'bg-[hsl(var(--brand-700))] text-white'
            : 'border border-[hsl(var(--brand-200))] bg-white/80 text-[hsl(var(--brand-800))] hover:bg-[hsl(var(--brand-100))]'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-2 w-2 rounded-full',
            mode === 'live'
              ? 'bg-emerald-300 motion-safe:animate-pulse'
              : 'bg-gray-400'
          )}
        />
        {t('timeBar.now')}
      </button>

      <span
        data-testid="map-timebar-badge"
        className={cn(
          'hidden shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline',
          badge === 'live' &&
            'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80',
          badge === 'past' &&
            'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
          badge === 'forecast' &&
            'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80'
        )}
      >
        {badge === 'live'
          ? t('timeBar.live')
          : badge === 'forecast'
            ? t('timeBar.forecast')
            : t('timeBar.past')}
      </span>

      <button
        type="button"
        onClick={goPrev}
        disabled={safeIndex <= 0}
        aria-label={t('timeBar.previous')}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[hsl(var(--brand-800))] hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))]"
      >
        <span aria-hidden="true" className="text-base leading-none">
          ‹
        </span>
      </button>

      <div className="relative min-w-0 flex-1">
        {forecastStart !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-0 right-0 overflow-hidden rounded-full"
          >
            <div
              className="h-full bg-[hsl(var(--brand-200))]/70"
              style={{ width: `${forecastPct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-amber-200/70"
              style={{ left: `${forecastPct}%`, right: 0 }}
            />
          </div>
        ) : null}
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={safeIndex}
          disabled={loading}
          aria-valuemin={0}
          aria-valuemax={maxIndex}
          aria-valuenow={safeIndex}
          aria-valuetext={periodLabel}
          aria-label={sliderLabel}
          data-testid="map-timebar-slider"
          onChange={(event) => onIndexChange(Number(event.target.value))}
          className={cn(
            'relative z-[1] h-11 w-full cursor-pointer accent-[hsl(var(--brand-600))]',
            loading && 'opacity-60'
          )}
        />
      </div>

      <button
        type="button"
        onClick={goNext}
        disabled={safeIndex >= maxIndex}
        aria-label={t('timeBar.next')}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[hsl(var(--brand-800))] hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))]"
      >
        <span aria-hidden="true" className="text-base leading-none">
          ›
        </span>
      </button>

      <p
        className="hidden min-w-[7.5rem] shrink-0 text-right text-xs font-medium tabular-nums text-[color:var(--fg)] md:block"
        data-testid="map-timebar-label"
      >
        {periodLabel}
      </p>

      <Popover open={goToOpen} onOpenChange={setGoToOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="map-timebar-goto"
            data-tour="map-timebar-goto"
            className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--r-md)] border border-gray-200/80 bg-white/80 px-2.5 text-xs font-medium text-[color:var(--fg)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))]"
          >
            {t('timeBar.goTo')}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="glass-1 w-[min(22rem,calc(100vw-2rem))] p-3"
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-[color:var(--fg)]">
              {t('timeBar.goToTitle')}
            </p>
            <label className="flex flex-col gap-1 text-xs text-[color:var(--fg-muted)]">
              <span>{t('aircrowdWms.date')}</span>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={slot.date}
                onChange={(event) => {
                  if (event.target.value) handleGoToDate(event.target.value);
                }}
                className="min-h-11 rounded-[var(--r-md)] border border-gray-200 bg-white px-2 text-sm text-[color:var(--fg)]"
              />
            </label>
            <div className="max-h-[40vh] overflow-y-auto">
              <PollutionEpisodeCalendar
                selectedPollutant={selectedPollutant}
                selectedStartDate={slot.date}
                selectedEndDate={slot.date}
                onDateSelect={handleGoToDate}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </section>
  );
};

export default MapTimeBar;
