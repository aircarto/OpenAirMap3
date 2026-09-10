import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MeasurementDevice, SignalAirReport } from '../../types';
import StatisticsPanel from './StatisticsPanel';
import { cn } from '../../lib/utils';
import { sources } from '../../constants/sources';
import {
  DeviceStatistics as DeviceStatisticsType,
  SourceStatistics,
} from '../../utils/deviceStatisticsUtils';
import { getDisplayedPeriod } from '../../utils/dataPeriodUtils';

export type DeviceStatisticsVariant = 'compact' | 'full';

interface DeviceStatisticsProps {
  visibleDevices: MeasurementDevice[];
  visibleReports: SignalAirReport[];
  totalDevices: number;
  totalReports: number;
  selectedPollutant: string;
  selectedSources?: string[];
  selectedTimeStep?: string;
  historicalCurrentDate?: string;
  displayedPeriodOverride?: string;
  statistics?: DeviceStatisticsType;
  sourceStatistics?: SourceStatistics[];
  showDetails?: boolean;
  /**
   * `compact` : chip période seule (mobile).
   * `full` : période + compteurs (desktop / tablette).
   */
  variant?: DeviceStatisticsVariant;
}

/**
 * Statistiques des appareils visibles dans le viewport (chip période ou bloc complet).
 */
const DeviceStatistics: React.FC<DeviceStatisticsProps> = ({
  visibleDevices,
  visibleReports,
  totalDevices,
  totalReports,
  selectedPollutant,
  selectedSources = [],
  selectedTimeStep = '',
  historicalCurrentDate,
  displayedPeriodOverride,
  statistics,
  sourceStatistics,
  variant = 'full',
}) => {
  const { t, i18n } = useTranslation();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const isCompact = variant === 'compact';
  const displayedPeriod =
    displayedPeriodOverride ||
    (selectedTimeStep &&
      getDisplayedPeriod(selectedTimeStep, historicalCurrentDate, i18n.language, {
        compact: isCompact,
      }));

  const canOpenPanel =
    visibleDevices.length > 0 || visibleReports.length > 0;

  const openPanel = () => {
    if (canOpenPanel) {
      setIsPanelOpen((open) => !open);
    }
  };

  const isRtl = i18n.language === 'ar';
  const periodAria = displayedPeriod
    ? t('statistics.periodAria', { period: displayedPeriod })
    : t('panels.showStats');

  if (isCompact) {
    if (!displayedPeriod) {
      return null;
    }

    return (
      <>
        <button
          type='button'
          onClick={openPanel}
          disabled={!canOpenPanel}
          className={cn(
            'glass-3 flex min-h-10 max-w-full items-center rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] border-l-4 border-l-blue-400 px-2.5 py-1.5 text-left shadow-sm transition-colors',
            'landscape:max-w-[9.5rem] landscape:min-h-9 landscape:px-2 landscape:py-1',
            canOpenPanel
              ? 'cursor-pointer hover:bg-white/80'
              : 'cursor-default opacity-80',
            isPanelOpen && 'ring-1 ring-blue-300'
          )}
          aria-label={periodAria}
        >
          <span
            className='truncate text-sm font-medium text-blue-600 landscape:text-xs'
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {displayedPeriod}
          </span>
        </button>

        <StatisticsPanel
          visibleDevices={visibleDevices}
          visibleReports={visibleReports}
          selectedSources={selectedSources}
          selectedPollutant={selectedPollutant}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          statistics={statistics}
          sourceStatistics={sourceStatistics}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          'cursor-pointer text-xs text-gray-600 transition-all',
          'hover:bg-gray-50 rounded-md -mx-1 px-1 py-0.5',
          isPanelOpen && 'bg-gray-50'
        )}
        onClick={openPanel}
        role='button'
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPanel();
          }
        }}
        aria-label={t('panels.showStats')}
      >
        {displayedPeriod && !isPanelOpen ? (
          <div className='mb-1.5'>
            <div
              className='flex w-full items-center justify-center rounded-r-md rounded-l border border-slate-200 border-l-4 border-l-blue-400 bg-white py-1.5 pl-2.5 pr-3 shadow-sm'
              role='status'
              aria-label={periodAria}
            >
              <span
                className='text-sm text-slate-600'
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                <span className='font-medium text-slate-700'>
                  {t('controls.period')}
                </span>
                <span className='mx-1 text-slate-400' aria-hidden>
                  ·
                </span>
                <span className='font-medium text-blue-600'>
                  {displayedPeriod}
                </span>
              </span>
            </div>
          </div>
        ) : null}

        <div className='flex items-center justify-between'>
          <div className='flex min-w-0 items-center space-x-1'>
            <span className='font-medium' dir={isRtl ? 'rtl' : 'ltr'}>
              {t('statistics.devicesVisible', { count: visibleDevices.length })}
              {visibleDevices.length !== totalDevices && totalDevices > 0 ? (
                <span className='font-normal text-gray-500'>
                  {' '}
                  {t('statistics.ofTotal', { total: totalDevices })}
                </span>
              ) : null}
            </span>
          </div>
          {canOpenPanel ? (
            <svg
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                isPanelOpen && 'rotate-180'
              )}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 9l-7 7-7-7'
              />
            </svg>
          ) : null}
        </div>

        {visibleReports.length > 0 ? (
          <div className='mt-1'>
            <span dir={isRtl ? 'rtl' : 'ltr'}>
              {t('statistics.reportsVisible', { count: visibleReports.length })}
              {visibleReports.length !== totalReports && totalReports > 0 ? (
                <span className='text-gray-500'>
                  {' '}
                  {t('statistics.ofTotal', { total: totalReports })}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <StatisticsPanel
        visibleDevices={visibleDevices}
        visibleReports={visibleReports}
        selectedSources={selectedSources}
        selectedPollutant={selectedPollutant}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        statistics={statistics}
        sourceStatistics={sourceStatistics}
      />
    </>
  );
};

export default DeviceStatistics;
