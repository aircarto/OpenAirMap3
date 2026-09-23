import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import ChartLoadingOverlay from './ChartLoadingOverlay';
import ChartThresholdLegend from './ChartThresholdLegend';
import HistoricalChart, { type HistoricalChartProps } from './HistoricalChart';
import { CHART_PANEL_HEIGHT_CLASS } from '../panels/SidePanelShell';

export interface PanelChartBlockProps extends HistoricalChartProps {
  loading?: boolean;
  /** Classes de hauteur du canvas. Défaut : flex-grow panel. */
  heightClassName?: string;
  className?: string;
}

const hasHistoricalPoints = (
  data: HistoricalChartProps['data']
): boolean =>
  Object.values(data).some(
    (points) => Array.isArray(points) && points.length > 0
  );

/**
 * Bloc graphique des panneaux : canvas flex-grow, overlay de chargement,
 * légende des seuils en dessous pour ne pas rogner le graphe.
 */
const PanelChartBlock: React.FC<PanelChartBlockProps> = ({
  loading = false,
  heightClassName = CHART_PANEL_HEIGHT_CLASS,
  className,
  ...chartProps
}) => {
  const hasData = useMemo(
    () => hasHistoricalPoints(chartProps.data),
    [chartProps.data]
  );

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className={cn('relative isolate w-full overflow-hidden', heightClassName)}>
        <HistoricalChart {...chartProps} />
        {loading ? <ChartLoadingOverlay /> : null}
      </div>
      <ChartThresholdLegend
        selectedPollutants={chartProps.selectedPollutants}
        source={chartProps.source}
        stations={chartProps.stations}
        hidden={chartProps.hideThresholdBackgroundForColorblind}
        hasData={hasData}
      />
    </div>
  );
};

export default PanelChartBlock;
