import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { pollutants } from "../../constants/pollutants";
import { getQualityThresholdLegendItems } from "../../utils/qualityLegend";
import { getCommonThresholds } from "./utils/historicalChartConfig";

interface ChartThresholdLegendProps {
  selectedPollutants: string[];
  source: string;
  stations?: unknown[];
  /** Masque la légende avec les bandes (mode daltoniens). */
  hidden?: boolean;
  /** Masque la légende si le graphique n'a aucune série à tracer. */
  hasData?: boolean;
}

/**
 * Échelle compacte des seuils qualité, alignée sur les bandes colorées du
 * graphique. Les plages sont toujours visibles : contrairement à la légende
 * carte, les couleurs du graphe n'ont aucun libellé au survol.
 */
const ChartThresholdLegend: React.FC<ChartThresholdLegendProps> = ({
  selectedPollutants,
  source,
  stations = [],
  hidden = false,
  hasData = true,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const thresholds = useMemo(
    () => getCommonThresholds(selectedPollutants, source, stations),
    [selectedPollutants, source, stations]
  );

  const firstPollutant = selectedPollutants[0];
  const unit = firstPollutant ? pollutants[firstPollutant]?.unit ?? "" : "";

  const items = useMemo(
    () => (thresholds ? getQualityThresholdLegendItems(thresholds, t) : []),
    [thresholds, t]
  );

  if (hidden || !hasData || !thresholds || items.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-2 px-0.5"
      data-testid="chart-threshold-legend"
      role="region"
      aria-label={t("chart.thresholdLegendAria", { unit })}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-[var(--r-sm)]"
          aria-hidden="true"
        >
          {items.map((item) => (
            <div
              key={item.key}
              className="min-w-0 flex-1"
              style={{ backgroundColor: item.color }}
            />
          ))}
        </div>
        {unit ? (
          <span className="shrink-0 text-[10px] font-medium text-[color:var(--fg-muted)]">
            {unit}
          </span>
        ) : null}
      </div>
      <ul className="mt-1.5 grid grid-cols-6 gap-x-0.5" role="list">
        {items.map((item) => (
          <li key={item.key} className="min-w-0 text-center">
            <span
              className="block truncate text-[9px] font-medium leading-tight text-[color:var(--fg)] sm:text-[10px]"
              dir={isRtl ? "rtl" : "ltr"}
            >
              {item.shortLabel}
            </span>
            <span className="block text-[8px] tabular-nums leading-tight text-[color:var(--fg-muted)] sm:text-[9px]">
              {item.range}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChartThresholdLegend;
