import React from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '../ui/button-group';
import { cn } from '../../lib/utils';
import HistoricalTimeRangeSelector from './HistoricalTimeRangeSelector';
import type { TimeRange } from '../../utils/historicalTimeRange';
import {
  chartSegmentGroupClass,
  chartSegmentItemClass,
} from './chartSegmentStyles';

export interface ChartTimeStepOption {
  key: string;
  label: string;
  shortLabel?: string;
  disabled?: boolean;
  title?: string;
}

export interface ChartTimeControlsProps {
  timeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  timeStep: string;
  onTimeStepChange: (timeStep: string) => void;
  timeStepOptions: ChartTimeStepOption[];
  disabled?: boolean;
  timeStepHint?: React.ReactNode;
  className?: string;
}

/**
 * Barre plate période + pas de temps (2 rangées), sans cartes bordées.
 * Toujours visible sous le graphique — fond opaque pour éviter tout
 * chevauchement avec le canvas amcharts.
 */
const ChartTimeControls: React.FC<ChartTimeControlsProps> = ({
  timeRange,
  onTimeRangeChange,
  timeStep,
  onTimeStepChange,
  timeStepOptions,
  disabled = false,
  timeStepHint,
  className,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'relative z-10 shrink-0 space-y-2 bg-white rtl-on-ar',
        className
      )}
      data-testid="chart-time-controls"
    >
      <HistoricalTimeRangeSelector
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        timeStep={timeStep}
        disabled={disabled}
        variant="toolbar"
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1 px-0 text-[11px] font-medium uppercase tracking-wide text-[color:var(--fg-muted)]">
          {t('controls.timeStep')}
        </legend>
        <ToggleGroup
          type="single"
          value={timeStep}
          onValueChange={(value) => {
            if (disabled || !value) return;
            const option = timeStepOptions.find((o) => o.key === value);
            if (option?.disabled) return;
            onTimeStepChange(value);
          }}
          className={chartSegmentGroupClass}
        >
          {timeStepOptions.map((option) => (
            <ToggleGroupItem
              key={option.key}
              value={option.key}
              disabled={disabled || option.disabled}
              title={option.title ?? option.label}
              className={cn(
                chartSegmentItemClass,
                (disabled || option.disabled) && 'opacity-40'
              )}
            >
              {option.shortLabel ? (
                <>
                  <span className="time-step-button-full truncate">
                    {option.label}
                  </span>
                  <span className="time-step-button-short truncate">
                    {option.shortLabel}
                  </span>
                </>
              ) : (
                <span className="truncate">{option.label}</span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {timeStepHint ? <div className="mt-1.5">{timeStepHint}</div> : null}
      </fieldset>
    </div>
  );
};

export default ChartTimeControls;
