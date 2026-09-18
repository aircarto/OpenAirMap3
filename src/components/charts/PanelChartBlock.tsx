import React, { useMemo } from "react";
import { cn } from "../../lib/utils";
import ChartLoadingOverlay from "./ChartLoadingOverlay";
import ChartThresholdLegend from "./ChartThresholdLegend";
import HistoricalChart, { type HistoricalChartProps } from "./HistoricalChart";

export interface PanelChartBlockProps extends HistoricalChartProps {
  loading?: boolean;
  heightClassName: string;
  className?: string;
}

const hasHistoricalPoints = (
  data: HistoricalChartProps["data"]
): boolean =>
  Object.values(data).some(
    (points) => Array.isArray(points) && points.length > 0
  );

/**
 * Bloc graphique des panneaux : canvas à hauteur fixe, overlay de chargement,
 * légende des seuils en dessous pour ne pas rogner le graphe.
 */
const PanelChartBlock: React.FC<PanelChartBlockProps> = ({
  loading = false,
  heightClassName,
  className,
  ...chartProps
}) => {
  const hasData = useMemo(
    () => hasHistoricalPoints(chartProps.data),
    [chartProps.data]
  );

  return (
    <div className={cn(className)}>
      <div className={cn("relative", heightClassName)}>
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
