import React, { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import PollutionEpisodeCalendar from './PollutionEpisodeCalendar';
import { cn } from '../../lib/utils';
import {
  formatBoundDateLabel,
  formatInstantHoverLabel,
  formatInstantPeriod,
  getMaxCustomRangeCalendarDays,
  getSlotBadge,
  type MapInstantMode,
  type TimeBarCustomRange,
  type TimeBarSlot,
} from '../../utils/mapInstant';

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;

export interface MapTimeBarProps {
  visible: boolean;
  mode: MapInstantMode;
  slots: TimeBarSlot[];
  index: number;
  liveIndex: number;
  showForecastZone: boolean;
  minDate: string;
  maxDate: string;
  canSeekPast?: boolean;
  canSeekFuture?: boolean;
  selectedPollutant: string;
  timeStep: string;
  /** true seulement sur miss bloquant — le prefetch silencieux ne gèle pas le playback */
  loading?: boolean;
  customRange?: TimeBarCustomRange | null;
  /** Ouvre le sélecteur de période (ex. depuis le rail). */
  periodPickerOpen?: boolean;
  onPeriodPickerOpenChange?: (open: boolean) => void;
  onCustomRangeChange?: (range: TimeBarCustomRange | null) => void;
  onIndexChange: (index: number) => void;
  onGoLive: () => void;
  onSeekBeyond?: (direction: 'past' | 'future') => void;
  onPlayingChange?: (playing: boolean) => void;
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Cible tactile ≥ 44px (skill ui-ux). */
const iconBtnClass = cn(
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
  'text-[hsl(var(--brand-800))]',
  'hover:bg-[hsl(var(--brand-100))]',
  'disabled:cursor-not-allowed disabled:opacity-35',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))]'
);

const seekBtnClass = cn(
  iconBtnClass,
  'bg-[hsl(var(--brand-100))]/70 ring-1 ring-[hsl(var(--brand-200))]/60',
  'hover:bg-[hsl(var(--brand-200))] hover:ring-[hsl(var(--brand-300))]'
);

const MapTimeBar: React.FC<MapTimeBarProps> = ({
  visible,
  mode,
  slots,
  index,
  liveIndex,
  showForecastZone,
  minDate,
  maxDate,
  canSeekPast = false,
  canSeekFuture = false,
  selectedPollutant,
  timeStep,
  loading = false,
  customRange = null,
  periodPickerOpen,
  onPeriodPickerOpenChange,
  onCustomRangeChange,
  onIndexChange,
  onGoLive,
  onSeekBeyond,
  onPlayingChange,
}) => {
  const { t, i18n } = useTranslation();
  const barRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [periodOpenInternal, setPeriodOpenInternal] = useState(false);
  const periodOpen =
    periodPickerOpen !== undefined ? periodPickerOpen : periodOpenInternal;
  const setPeriodOpen = (open: boolean) => {
    onPeriodPickerOpenChange?.(open);
    if (periodPickerOpen === undefined) setPeriodOpenInternal(open);
  };
  const [speedOpen, setSpeedOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    label: string;
    xPct: number;
  } | null>(null);
  const loadingRef = useRef(loading);
  const indexRef = useRef(index);
  const slotsLengthRef = useRef(slots.length);
  const onIndexChangeRef = useRef(onIndexChange);
  const lastSeekAtRef = useRef(0);
  const pausedForLoadRef = useRef(false);

  loadingRef.current = loading;
  indexRef.current = index;
  slotsLengthRef.current = slots.length;
  onIndexChangeRef.current = onIndexChange;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

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

  useEffect(() => {
    if (mode === 'live' && isPlaying) {
      pausedForLoadRef.current = false;
      setIsPlaying(false);
    }
  }, [mode, isPlaying]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    // Pendant le play : ne pas couper la lecture — le tick attend déjà
    // via loadingRef. Un pause manuel reste possible via le bouton.
    if (loading && isPlaying) return;
    if (!loading && pausedForLoadRef.current) {
      pausedForLoadRef.current = false;
      setIsPlaying(true);
    }
  }, [loading, isPlaying]);

  useEffect(() => {
    if (!periodOpen) return;
    setDraftStart(customRange?.start.date ?? slots[0]?.date ?? '');
    setDraftEnd(
      customRange?.end.date ?? slots[slots.length - 1]?.date ?? maxDate
    );
    setRangeError(null);
  }, [periodOpen, customRange, slots, maxDate]);

  useEffect(() => {
    if (!isPlaying || reduceMotion) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (loadingRef.current) return;
      const maxIdx = Math.max(0, slotsLengthRef.current - 1);
      const current = indexRef.current;
      // Play ne doit jamais étendre la plage (confirm réservé aux boutons prev/next).
      if (current >= maxIdx) {
        setIsPlaying(false);
        return;
      }
      const minDelay = Math.max(500, 1000 / playbackSpeed);
      const skip = Math.max(1, Math.round(Math.max(playbackSpeed * 0.5, 1)));
      const elapsed = Date.now() - lastSeekAtRef.current;
      if (elapsed < minDelay) return;
      const next = Math.min(maxIdx, current + skip);
      lastSeekAtRef.current = Date.now();
      onIndexChangeRef.current(next);
    };

    const interval = window.setInterval(tick, 100);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, reduceMotion]);

  if (!visible || slots.length === 0) {
    return null;
  }

  const safeIndex = Math.max(0, Math.min(slots.length - 1, index));
  const slot = slots[safeIndex];
  const startSlot = slots[0];
  const endSlot = slots[slots.length - 1];
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

  const periodLabel = formatInstantPeriod(slot, i18n.language, timeStep);
  const startBoundLabel = formatBoundDateLabel(
    startSlot,
    i18n.language,
    timeStep
  );
  const endBoundLabel = formatBoundDateLabel(endSlot, i18n.language, timeStep);
  const sliderLabel = `${t('timeBar.slider')}: ${periodLabel}`;
  // Pendant le play, un miss de buffer ne doit pas geler les contrôles ni afficher de spinner.
  const showLoadingUi = loading && !isPlaying;
  const controlsDisabled = showLoadingUi;
  const maxRangeDays =
    timeStep === 'jour' ? null : getMaxCustomRangeCalendarDays(timeStep);

  const goPrev = () => {
    if (controlsDisabled) return;
    if (safeIndex > 0) {
      onIndexChange(safeIndex - 1);
      return;
    }
    onSeekBeyond?.('past');
  };
  const goNext = () => {
    if (controlsDisabled) return;
    if (safeIndex < maxIndex) {
      onIndexChange(safeIndex + 1);
      return;
    }
    onSeekBeyond?.('future');
  };

  const updateHoverPreview = (clientX: number) => {
    const track = trackRef.current;
    if (!track || slots.length === 0) {
      setHoverPreview(null);
      return;
    }
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const hoverIndex = Math.round(ratio * maxIndex);
    const hovered = slots[hoverIndex];
    if (!hovered) {
      setHoverPreview(null);
      return;
    }
    setHoverPreview({
      label: formatInstantHoverLabel(hovered, i18n.language, timeStep),
      xPct: maxIndex > 0 ? (hoverIndex / maxIndex) * 100 : 0,
    });
  };

  const clearHoverPreview = () => setHoverPreview(null);

  const handlePlayToggle = () => {
    if (controlsDisabled) return;
    if (reduceMotion) {
      goNext();
      return;
    }
    if (isPlaying) {
      pausedForLoadRef.current = false;
      setIsPlaying(false);
      return;
    }
    // Reprise depuis le début si déjà en fin de plage (pas d’extension auto).
    if (safeIndex >= maxIndex) {
      onIndexChange(0);
    }
    setIsPlaying(true);
  };

  const handleSliderChange = (nextIndex: number) => {
    if (controlsDisabled) return;
    if (isPlaying) {
      pausedForLoadRef.current = false;
      setIsPlaying(false);
    }
    onIndexChange(nextIndex);
  };

  const applyDraftRange = () => {
    if (!onCustomRangeChange || !draftStart || !draftEnd) return;
    if (draftStart > draftEnd) {
      setRangeError(t('timeBar.periodInvalidOrder'));
      return;
    }
    onCustomRangeChange({
      start: { date: draftStart, hour: 0, minute: 0 },
      end: { date: draftEnd, hour: 23, minute: 45 },
    });
    setPeriodOpen(false);
  };

  const clearCustomRange = () => {
    onCustomRangeChange?.(null);
    setPeriodOpen(false);
  };

  return (
    <section
      ref={barRef}
      data-testid="map-timebar"
      data-tour="map-timebar"
      aria-label={t('timeBar.regionLabel')}
      aria-busy={loading || undefined}
      className={cn(
        'glass-1 pointer-events-auto absolute z-map-search',
        'right-2',
        'flex items-center gap-1 px-2 py-1 sm:gap-1.5 sm:px-2.5',
        loading && 'opacity-90'
      )}
      style={{
        borderRadius: 'var(--r-lg)',
        bottom:
          'calc(var(--rail-bottom-inset, 0px) + var(--attribution-inset, 1.65rem))',
        left: 'max(0.5rem, calc(var(--rail-inset, 0px) + 0.35rem), var(--instrument-band, 0px))',
      }}
    >
      {/* Passé → Période (gauche) */}
      {onCustomRangeChange ? (
        <Popover
          open={periodOpen && !controlsDisabled}
          onOpenChange={(open) => {
            if (controlsDisabled) return;
            setPeriodOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={controlsDisabled}
              data-testid="map-timebar-period"
              data-tour="map-timebar-period"
              aria-label={t('timeBar.period')}
              aria-pressed={Boolean(customRange)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--r-md)] border px-2.5 text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))]',
                'disabled:cursor-not-allowed disabled:opacity-40',
                customRange
                  ? 'border-[hsl(var(--brand-400))] bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-800))]'
                  : 'border-gray-200/80 bg-white/80 text-[color:var(--fg)] hover:bg-white'
              )}
            >
              <span className="hidden sm:inline">{t('timeBar.period')}</span>
              <svg
                className="h-4 w-4 sm:hidden"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 11h18M8 3v4M16 3v4" />
              </svg>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="glass-1 w-[min(22rem,calc(100vw-2rem))] p-3"
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-[color:var(--fg)]">
                {t('timeBar.periodTitle')}
              </p>
              <p className="text-[11px] text-[color:var(--fg-muted)]">
                {timeStep === 'jour'
                  ? t('timeBar.periodLimitMonths', { count: 6 })
                  : t('timeBar.periodLimitDays', { count: maxRangeDays ?? 14 })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-[color:var(--fg-muted)]">
                  <span>{t('timeBar.periodStart')}</span>
                  <input
                    type="date"
                    min={minDate}
                    max={draftEnd || maxDate}
                    value={draftStart}
                    onChange={(event) => {
                      setDraftStart(event.target.value);
                      setRangeError(null);
                    }}
                    className="min-h-11 rounded-[var(--r-md)] border border-gray-200 bg-white px-2 text-sm text-[color:var(--fg)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[color:var(--fg-muted)]">
                  <span>{t('timeBar.periodEnd')}</span>
                  <input
                    type="date"
                    min={draftStart || minDate}
                    max={maxDate}
                    value={draftEnd}
                    onChange={(event) => {
                      setDraftEnd(event.target.value);
                      setRangeError(null);
                    }}
                    className="min-h-11 rounded-[var(--r-md)] border border-gray-200 bg-white px-2 text-sm text-[color:var(--fg)]"
                  />
                </label>
              </div>
              {rangeError ? (
                <p className="text-xs text-red-600" role="alert">
                  {rangeError}
                </p>
              ) : null}
              <div className="max-h-[36vh] overflow-y-auto">
                <PollutionEpisodeCalendar
                  selectedPollutant={selectedPollutant}
                  selectedStartDate={draftStart || undefined}
                  selectedEndDate={draftEnd || undefined}
                  maxDateRange={maxRangeDays ?? undefined}
                  onDateRangeChange={(start, end) => {
                    setDraftStart(start);
                    setDraftEnd(end);
                    setRangeError(null);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="map-timebar-period-apply"
                  onClick={applyDraftRange}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--r-md)] bg-[hsl(var(--brand-700))] px-3 text-xs font-semibold text-white"
                >
                  {t('timeBar.periodApply')}
                </button>
                {customRange ? (
                  <button
                    type="button"
                    data-testid="map-timebar-period-clear"
                    onClick={clearCustomRange}
                    className="inline-flex min-h-11 items-center justify-center rounded-[var(--r-md)] border border-gray-200 px-3 text-xs font-medium text-[color:var(--fg)] hover:bg-black/5"
                  >
                    {t('timeBar.periodClear')}
                  </button>
                ) : null}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {/* Piste : borne · prev · slider · next · borne · créneau · play · speed */}
      <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
        <span
          data-testid="map-timebar-bound-start"
          className="hidden w-[3.25rem] shrink-0 text-right text-[10px] font-medium tabular-nums leading-tight text-[color:var(--fg-muted)] sm:block"
          title={startBoundLabel}
        >
          {startBoundLabel}
        </span>

        <button
          type="button"
          onClick={goPrev}
          disabled={controlsDisabled || (safeIndex <= 0 && !canSeekPast)}
          aria-label={t('timeBar.previous')}
          data-testid="map-timebar-prev"
          className={seekBtnClass}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div
          ref={trackRef}
          className="relative min-w-0 flex-1 px-0.5"
          onMouseMove={(event) => updateHoverPreview(event.clientX)}
          onMouseLeave={clearHoverPreview}
        >
          {hoverPreview ? (
            <div
              role="tooltip"
              data-testid="map-timebar-hover-tooltip"
              className={cn(
                'pointer-events-none absolute bottom-[calc(100%+0.15rem)] z-20',
                '-translate-x-1/2 whitespace-nowrap',
                'rounded-md bg-slate-900 px-2.5 py-1.5',
                'text-xs font-semibold tabular-nums tracking-wide text-white',
                'shadow-lg ring-1 ring-white/20'
              )}
              style={{ left: `${hoverPreview.xPct}%` }}
            >
              {hoverPreview.label}
            </div>
          ) : null}
          {forecastStart !== null ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2 left-0 right-0 overflow-hidden rounded-full"
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
            disabled={controlsDisabled}
            aria-valuemin={0}
            aria-valuemax={maxIndex}
            aria-valuenow={safeIndex}
            aria-valuetext={periodLabel}
            aria-label={sliderLabel}
            data-testid="map-timebar-slider"
            onChange={(event) =>
              handleSliderChange(Number(event.target.value))
            }
            className={cn(
              'relative z-[1] h-11 w-full cursor-pointer accent-[hsl(var(--brand-600))]',
              (loading || controlsDisabled) && 'cursor-not-allowed opacity-60'
            )}
          />
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={
            controlsDisabled || (safeIndex >= maxIndex && !canSeekFuture)
          }
          aria-label={t('timeBar.next')}
          data-testid="map-timebar-next"
          className={seekBtnClass}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span
          data-testid="map-timebar-bound-end"
          className="hidden w-[3.25rem] shrink-0 text-left text-[10px] font-medium tabular-nums leading-tight text-[color:var(--fg-muted)] sm:block"
          title={endBoundLabel}
        >
          {endBoundLabel}
        </span>

        {/* Créneau courant — seule info horaire primaire */}
        <p
          className="hidden min-w-[4.5rem] shrink-0 text-center text-[11px] font-semibold tabular-nums text-[color:var(--fg)] md:block"
          data-testid="map-timebar-label"
          aria-live={isPlaying ? 'polite' : 'off'}
        >
          {periodLabel}
        </p>

        {showLoadingUi ? (
          <span
            data-testid="map-timebar-spinner"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--brand-600))] border-t-transparent" />
          </span>
        ) : null}

        <button
          type="button"
          onClick={handlePlayToggle}
          disabled={controlsDisabled}
          aria-pressed={isPlaying}
          aria-label={
            reduceMotion
              ? t('timeBar.next')
              : isPlaying
                ? t('timeBar.pause')
                : t('timeBar.play')
          }
          title={reduceMotion ? t('timeBar.reducedMotionPlay') : undefined}
          data-testid="map-timebar-play"
          data-tour="map-timebar-play"
          className={iconBtnClass}
        >
          {isPlaying ? (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg
              className="ml-0.5 h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {!reduceMotion ? (
          <Popover
            open={speedOpen && !controlsDisabled}
            onOpenChange={(open) => !controlsDisabled && setSpeedOpen(open)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={controlsDisabled}
                aria-label={t('timeBar.speedMenu', { value: playbackSpeed })}
                data-testid="map-timebar-speed"
                className={cn(
                  iconBtnClass,
                  'min-w-11 px-1 text-xs font-semibold tabular-nums'
                )}
              >
                {playbackSpeed}×
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="center"
              sideOffset={8}
              className="glass-1 w-auto p-2"
            >
              <div
                className="flex flex-col gap-1"
                role="group"
                aria-label={t('timeBar.speedLabel')}
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    aria-pressed={playbackSpeed === speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setSpeedOpen(false);
                    }}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-[var(--r-md)] px-3 text-xs font-medium',
                      playbackSpeed === speed
                        ? 'bg-[hsl(var(--brand-700))] text-white'
                        : 'text-[color:var(--fg)] hover:bg-black/5'
                    )}
                  >
                    {t('timeBar.speed', { value: speed })}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {/* Présent → Maintenant (droite, près de la borne haute) */}
      <div className="flex shrink-0 items-center gap-1">
        {!showLoadingUi ? (
          <span
            data-testid="map-timebar-badge"
            className={cn(
              'hidden shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide lg:inline',
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
        ) : null}

        <button
          type="button"
          onClick={onGoLive}
          disabled={controlsDisabled}
          aria-pressed={mode === 'live'}
          data-testid="map-timebar-now"
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-md)] px-2.5 text-xs font-semibold',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-40',
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
          <span className="hidden sm:inline">{t('timeBar.now')}</span>
        </button>
      </div>
    </section>
  );
};

export default memo(MapTimeBar);
