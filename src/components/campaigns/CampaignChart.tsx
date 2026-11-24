'use client';

import React, { useEffect, useId, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
/** Points d'une courbe : horodatages (ms) et valeurs de référence (NaN = trou). */
export interface ChartSeriesData {
  length: number;
  time: ArrayLike<number>;
  valueRef: ArrayLike<number>;
}

export interface CampaignChartSeries {
  key: string;
  label: string;
  color: string;
  /** Même objet tant que les données ne changent pas (identité = pas de recalcul). */
  series: ChartSeriesData;
  /** Deuxième capteur d'un même site, et suivants : trait pointillé. */
  dashed?: boolean;
  /** Survolée sur la carte ou dans la liste : trait épaissi. */
  highlighted?: boolean;
}

interface CampaignChartProps {
  series: CampaignChartSeries[];
  unit: string;
  emptyMessage: string;
}

interface Point {
  t: number;
  v: number;
}

/** Points horaires complets, sans agrégation ; les NaN sont des trous. */
const toPoints = (s: ChartSeriesData): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const v = s.valueRef[i]!;
    if (!Number.isNaN(v)) out.push({ t: s.time[i]!, v });
  }
  return out;
};

/**
 * Courbes superposées d'une variable, une série par localisation × capteur, au pas horaire.
 *
 * Chaque série porte ses propres données (pas de tableau « large » fusionné par
 * horodatage) : des dizaines de capteurs × 10⁴ points restent tenables.
 * autoGapCount coupe la ligne dès qu'il manque plus d'une heure et demie.
 */
export const CampaignChart: React.FC<CampaignChartProps> = ({ series, unit, emptyMessage }) => {
  const containerId = `campaign-chart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const rootRef = useRef<am5.Root | null>(null);
  const chartRef = useRef<am5xy.XYChart | null>(null);
  const xAxisRef = useRef<am5xy.DateAxis<am5xy.AxisRenderer> | null>(null);
  const yAxisRef = useRef<am5xy.ValueAxis<am5xy.AxisRenderer> | null>(null);
  const legendRef = useRef<am5.Legend | null>(null);
  const seriesByKey = useRef(new Map<string, { line: am5xy.LineSeries; source: ChartSeriesData }>());

  // Création unique du graphique
  useEffect(() => {
    const root = am5.Root.new(containerId);
    root.setThemes([am5themes_Animated.new(root)]);
    root.utc = false; // affichage en heure locale du navigateur
    root.numberFormatter.set('numberFormat', '#,###.##');

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        wheelX: 'panX',
        wheelY: 'zoomX',
        pinchZoomX: true,
        layout: root.verticalLayout,
      })
    );
    chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'zoomX' }));

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: { timeUnit: 'hour', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 80 }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );
    chart.set('scrollbarX', am5.Scrollbar.new(root, { orientation: 'horizontal' }));

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.gridLayout,
        maxHeight: 80,
        verticalScrollbar: am5.Scrollbar.new(root, { orientation: 'vertical' }),
      })
    );

    rootRef.current = root;
    chartRef.current = chart;
    xAxisRef.current = xAxis;
    yAxisRef.current = yAxis;
    legendRef.current = legend;
    const seriesMap = seriesByKey.current;

    return () => {
      seriesMap.clear();
      root.dispose();
      rootRef.current = null;
      chartRef.current = null;
    };
  }, [containerId]);

  // Libellé d'unité
  useEffect(() => {
    const root = rootRef.current;
    const yAxis = yAxisRef.current;
    if (!root || !yAxis) return;
    yAxis.children.each((child) => {
      if (child instanceof am5.Label) child.dispose();
    });
    yAxis.children.unshift(
      am5.Label.new(root, { rotation: -90, text: unit, y: am5.p50, centerX: am5.p50 })
    );
  }, [unit]);

  // Synchronisation incrémentale des séries
  useEffect(() => {
    const root = rootRef.current;
    const chart = chartRef.current;
    const xAxis = xAxisRef.current;
    const yAxis = yAxisRef.current;
    const legend = legendRef.current;
    if (!root || !chart || !xAxis || !yAxis || !legend) return;

    const wanted = new Map(series.map((s) => [s.key, s]));
    for (const [key, entry] of seriesByKey.current) {
      const next = wanted.get(key);
      if (!next || next.series !== entry.source) {
        chart.series.removeValue(entry.line);
        entry.line.dispose();
        seriesByKey.current.delete(key);
      }
    }

    for (const s of series) {
      let entry = seriesByKey.current.get(s.key);
      if (!entry) {
        const line = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: s.label,
            xAxis,
            yAxis,
            valueXField: 't',
            valueYField: 'v',
            connect: false,
            autoGapCount: 1.5,
            stroke: am5.color(s.color),
            fill: am5.color(s.color),
            tooltip: am5.Tooltip.new(root, {
              labelText: `{name}: {valueY} ${unit}`,
            }),
          })
        );
        line.data.setAll(toPoints(s.series));
        entry = { line, source: s.series };
        seriesByKey.current.set(s.key, entry);
      }
      entry.line.strokes.template.setAll({
        strokeWidth: s.highlighted ? 3 : 1.25,
        strokeDasharray: s.dashed ? [6, 3] : [],
      });
      entry.line.set('stroke', am5.color(s.color));
    }
    legend.data.setAll(chart.series.values);
  }, [series, unit]);

  return (
    <div className="relative h-full w-full">
      <div id={containerId} className="h-full w-full" />
      {series.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
};

export default CampaignChart;
