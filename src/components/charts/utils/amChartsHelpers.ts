/**
 * Fonctions utilitaires pour créer et configurer les éléments amCharts
 */

import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import i18n from "i18next";
import { pollutants } from "../../../constants/pollutants";
import { QUALITY_COLORS } from "../../../constants/qualityColors";
import { encodeUnit } from "./historicalChartUtils";
import { getLuminance } from "./historicalChartUtils";
import { SeriesConfig } from "./historicalChartConfig";

/**
 * Configure le tooltip pour une série
 */
export const createSeriesTooltip = (
  root: am5.Root,
  seriesConfig: SeriesConfig
): am5.Tooltip => {
  const seriesTooltip = am5.Tooltip.new(root, {
    getFillFromSprite: false,
    autoTextColor: false,
  });
  
  const backgroundColor = seriesConfig.color;
  const luminance = getLuminance(backgroundColor);
  const textColor = luminance > 128 ? "#000000" : "#ffffff";
  
  seriesTooltip.label.set("fill", am5.color(textColor));
  seriesTooltip.get("background")!.set("fill", am5.color(seriesConfig.color));
  seriesTooltip.get("background")!.set("fillOpacity", 0.9);
  seriesTooltip.get("background")!.set("stroke", am5.color(seriesConfig.color));
  seriesTooltip.get("background")!.set("strokeWidth", 1);
  
  seriesTooltip.label.adapters.add("text", (text, target) => {
    const dataItem = target.dataItem;
    if (!dataItem) return text || "";

    const data = (dataItem as any).dataContext as any;
    const value = data?.[seriesConfig.dataKey];
    
    // Formater la date (locale courante)
    const locale = i18n.language?.startsWith("fr") ? "fr-FR" : i18n.language?.startsWith("en") ? "en-GB" : i18n.language?.startsWith("es") ? "es-ES" : i18n.language?.startsWith("it") ? "it-IT" : "fr-FR";
    let dateStr = "";
    if (data?.timestamp) {
      const timestampValue = data.timestamp;
      const date = typeof timestampValue === "number" ? new Date(timestampValue) : new Date(timestampValue);
      if (!isNaN(date.getTime())) {
        dateStr = date.toLocaleString(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    // Obtenir le nom du polluant (traduit)
    const isModeling = seriesConfig.dataKey.endsWith("_modeling");
    const isRaw = seriesConfig.dataKey.endsWith("_raw");
    const isCorrected = seriesConfig.dataKey.endsWith("_corrected");
    const pollutantKey = seriesConfig.dataKey.replace(/_corrected$|_raw$|_modeling$/, "");
    const pollutantName = i18n.exists(`pollutants.${pollutantKey}`) ? i18n.t(`pollutants.${pollutantKey}`) : (pollutants[pollutantKey]?.name || seriesConfig.name);

    // Obtenir l'unité
    let unit = data?.[`${pollutantKey}_unit`] || "";
    if (!unit && pollutants[pollutantKey]) {
      unit = pollutants[pollutantKey].unit;
    }
    const encodedUnit = encodeUnit(unit);

    // Construire le texte du tooltip
    let tooltipText = "";
    if (dateStr) {
      tooltipText += `${dateStr}\n`;
    }

    // Construire le label avec les indications appropriées (traduites)
    let label = pollutantName;
    if (isModeling) {
      label += " " + i18n.t("chart.modelingSuffix");
    } else if (isRaw) {
      label += " " + i18n.t("chart.rawSuffix");
    } else if (isCorrected) {
      label += " " + i18n.t("chart.correctedSuffix");
    }
    
    tooltipText += `${label}: ${typeof value === "number" ? value.toFixed(1) : value} ${encodedUnit}`;
    
    return tooltipText;
  });
  
  return seriesTooltip;
};

/**
 * Crée une série de ligne pour amCharts
 */
export const createLineSeries = (
  root: am5.Root,
  chart: am5xy.XYChart,
  xAxis: am5xy.DateAxis<am5xy.AxisRendererX>,
  yAxis: am5xy.ValueAxis<am5xy.AxisRendererY>,
  seriesConfig: SeriesConfig,
  amChartsData: any[],
  timeStep?: string
): am5xy.LineSeries => {
  const lineSeries = chart.series.push(
    am5xy.LineSeries.new(root, {
      name: seriesConfig.name,
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: seriesConfig.dataKey,
      valueXField: "timestamp",
      stroke: am5.color(seriesConfig.color),
      visible: true,
    })
  );
  
  // S'assurer que la série est visible et que le stroke est bien configuré
  lineSeries.set("visible", true);
  lineSeries.strokes.template.set("stroke", am5.color(seriesConfig.color));
  lineSeries.strokes.template.set("strokeOpacity", 1);

  // Configurer l'épaisseur et le style de ligne
  lineSeries.strokes.template.set("strokeWidth", seriesConfig.strokeWidth);
  if (seriesConfig.strokeDasharray !== "0") {
    const dashArray = seriesConfig.strokeDasharray
      .split(" ")
      .map((d) => parseFloat(d))
      .filter((d) => !isNaN(d));
    if (dashArray.length > 0) {
      lineSeries.strokes.template.set("strokeDasharray", dashArray);
    }
  }

  // Configurer connectNulls pour gérer les gaps
  // Selon la doc amCharts 5 officielle:
  // - connect: false = ne pas connecter les points avec des valeurs null, dessine des segments séparés
  // - connect: true = connecter même les points null, dessine une ligne continue
  // 
  // APPROCHE CORRECTE selon la doc:
  // 1. Insérer des valeurs null dans les données pour les gaps (fait par fillGapsInData)
  // 2. Utiliser connect: false pour ne pas connecter les points null
  // 3. Les timestamps doivent être des nombres (millisecondes) - déjà fait
  // 
  // Utiliser connectNulls de la configuration si disponible, sinon calculer selon timeStep
  const shouldConnect = seriesConfig.connectNulls !== undefined 
    ? seriesConfig.connectNulls 
    : !(timeStep && ["quartHeure", "heure", "jour"].includes(timeStep));
  lineSeries.set("connect", shouldConnect);

  // Configurer le tooltip
  const seriesTooltip = createSeriesTooltip(root, seriesConfig);
  lineSeries.set("tooltip", seriesTooltip);

  // Ajouter des bullets invisibles pour l'interaction
  // Ne créer des bullets que pour les points valides (pas undefined/null)
  lineSeries.bullets.push((root, series, dataItem) => {
    const data = dataItem.dataContext as any;
    const value = data?.[seriesConfig.dataKey];
    
    // Ne pas créer de bullet pour les points undefined/null
    if (value === undefined || value === null) {
      return undefined;
    }
    
    const circle = am5.Circle.new(root, {
      radius: 3,
      fill: am5.color(seriesConfig.color),
      fillOpacity: 0,
      strokeOpacity: 0,
    });
    
    return am5.Bullet.new(root, {
      sprite: circle,
    });
  });

  // Ajouter les données
  lineSeries.data.setAll(amChartsData);
  
  // Vérifier que la série a bien des points valides
  const validPoints = amChartsData.filter(p => {
    const value = p[seriesConfig.dataKey];
    return value !== null && value !== undefined && !isNaN(value);
  }).length;
  
  if (validPoints === 0) {
    console.warn(`[amCharts] ATTENTION: La série "${seriesConfig.name}" n'a aucun point valide !`);
  }

  return lineSeries;
};

/**
 * Ajoute les zones de seuils aux axes Y
 */
export const addThresholdZones = (
  yAxisMap: Map<string, am5xy.ValueAxis<am5xy.AxisRendererY>>,
  thresholds: any
): void => {
  const levels = [
    { key: "bon", color: QUALITY_COLORS.bon },
    { key: "moyen", color: QUALITY_COLORS.moyen },
    { key: "degrade", color: QUALITY_COLORS.degrade },
    { key: "mauvais", color: QUALITY_COLORS.mauvais },
    { key: "tresMauvais", color: QUALITY_COLORS.tresMauvais },
    { key: "extrMauvais", color: QUALITY_COLORS.extrMauvais },
  ];

  yAxisMap.forEach((yAxis) => {
    levels.forEach((level) => {
      const threshold = thresholds[level.key as keyof typeof thresholds];
      if (threshold) {
        const range = yAxis.createAxisRange(yAxis.makeDataItem({
          value: threshold.min,
          endValue: threshold.max,
        }));

        range.get("axisFill")!.setAll({
          fill: am5.color(level.color),
          fillOpacity: 0.4,
          visible: true,
        });
      }
    });
  });
};

/** Seuil au-delà duquel la légende passe en grille multi-colonnes avec hauteur limitée */
const LEGEND_COMPACT_THRESHOLD = 5;

/**
 * Configure la légende du graphique.
 * Au-delà de LEGEND_COMPACT_THRESHOLD séries : grille 3 colonnes + hauteur limitée avec scroll.
 */
export const setupLegend = (
  root: am5.Root,
  chart: am5xy.XYChart,
  seriesConfigs: SeriesConfig[],
  isMobile: boolean
): am5.Legend => {
  const seriesCount = seriesConfigs.length;
  const useCompactLegend = seriesCount > LEGEND_COMPACT_THRESHOLD;

  const legendOptions: am5.ILegendSettings & { layout?: am5.Layout; height?: am5.Percent; verticalScrollbar?: am5.Scrollbar } = {
    centerX: am5.p50,
    x: am5.p50,
    marginTop: isMobile ? 2 : 8,
    marginBottom: 0,
    marginLeft: isMobile ? 0 : 8,
    marginRight: isMobile ? 0 : 8,
  };

  if (useCompactLegend) {
    legendOptions.layout = am5.GridLayout.new(root, {
      maxColumns: 3,
      fixedWidthGrid: true,
    });
    legendOptions.height = 72 as unknown as am5.Percent;
    legendOptions.verticalScrollbar = am5.Scrollbar.new(root, {
      orientation: "vertical",
    });
  }

  const legend = chart.children.push(am5.Legend.new(root, legendOptions));

  // Personnaliser les items de la légende
  legend.labels.template.setAll({
    fontSize: isMobile ? 9 : 12,
  });

  legend.markers.template.setAll({
    width: isMobile ? 10 : 12,
    height: isMobile ? 10 : 12,
  });

  // Créer des marqueurs personnalisés avec styles (plein/discontinu)
  legend.markers.template.adapters.add("strokeDasharray" as any, (strokeDasharray: any, target: any) => {
    const dataItem = target.dataItem;
    if (dataItem) {
      const series = dataItem.dataContext as am5xy.LineSeries;
      if (series) {
        const seriesName = series.get("name");
        const seriesConfig = seriesConfigs.find((s) => s.name === seriesName);
        if (seriesConfig) {
          return seriesConfig.strokeDasharray !== "0" ? [3, 3] : undefined;
        }
      }
    }
    return strokeDasharray;
  });

  // Adapter pour la couleur des marqueurs de la légende
  legend.markers.template.adapters.add("stroke" as any, (stroke: any, target: any) => {
    const dataItem = target.dataItem;
    if (dataItem) {
      const series = dataItem.dataContext as am5xy.LineSeries;
      if (series) {
        const seriesStroke = series.get("stroke");
        if (seriesStroke) {
          return seriesStroke;
        }
      }
    }
    return stroke;
  });

  legend.markers.template.adapters.add("fill" as any, (fill: any, target: any) => {
    const dataItem = target.dataItem;
    if (dataItem) {
      const series = dataItem.dataContext as am5xy.LineSeries;
      if (series) {
        const seriesStroke = series.get("stroke");
        if (seriesStroke) {
          return seriesStroke;
        }
      }
    }
    return fill;
  });

  legend.data.setAll(chart.series.values);

  // Gérer le clic sur la légende pour masquer/afficher les séries
  legend.itemContainers.template.events.on("tap" as keyof am5.IContainerEvents, (ev) => {
    const dataItem = ev.target.dataItem;
    if (dataItem) {
      const series = dataItem.dataContext as am5xy.LineSeries;
      if (series) {
        if (series.isHidden()) {
          series.show();
        } else {
          series.hide();
        }
      }
    }
  });

  return legend;
};

/** Nombre de colonnes pour la légende en mode export (sans scroll, tout visible, plus compact) */
const LEGEND_EXPORT_MAX_COLUMNS = 5;

export interface LegendExportState {
  verticalScrollbar: am5.Scrollbar | undefined;
  height: number | am5.Percent | undefined;
  layout: am5.Layout | undefined;
}

function toUndefined<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

/**
 * Trouve la légende du graphique (dernier enfant de type Legend du chart).
 */
function findChartLegend(root: am5.Root): am5.Legend | null {
  const container = root.container;
  const children = container.children;
  if (!children || !children.values || children.values.length === 0) return null;
  const chart = children.values[0];
  if (!chart || !("children" in chart)) return null;
  const chartChildren = (chart as am5.Container).children;
  if (!chartChildren || !chartChildren.values) return null;
  for (let i = chartChildren.values.length - 1; i >= 0; i--) {
    const child = chartChildren.values[i];
    if (child && child instanceof am5.Legend) return child as am5.Legend;
  }
  return null;
}

/**
 * Prépare la légende pour l'export image : retire le scroll, fixe une grille multi-colonnes
 * pour que toute la légende soit visible sans écraser le graphique.
 * @returns État sauvegardé à passer à restoreLegendAfterExport
 */
export function prepareLegendForExport(root: am5.Root): LegendExportState | null {
  const legend = findChartLegend(root);
  if (!legend) return null;
  const scrollbar = legend.get("verticalScrollbar");
  if (scrollbar === undefined) return null;

  const saved: LegendExportState = {
    verticalScrollbar: legend.get("verticalScrollbar"),
    height: toUndefined(legend.get("height")),
    layout: toUndefined(legend.get("layout")),
  };

  legend.set("verticalScrollbar", undefined);
  legend.set("height", undefined);
  legend.set(
    "layout",
    am5.GridLayout.new(root, {
      maxColumns: LEGEND_EXPORT_MAX_COLUMNS,
      fixedWidthGrid: true,
    })
  );

  return saved;
}

/**
 * Restaure la légende après l'export image (remet scroll et hauteur limitée).
 */
export function restoreLegendAfterExport(
  root: am5.Root,
  saved: LegendExportState | null
): void {
  if (!saved) return;
  const legend = findChartLegend(root);
  if (!legend) return;

  legend.set("verticalScrollbar", saved.verticalScrollbar);
  legend.set("height", saved.height);
  legend.set("layout", saved.layout);
}

