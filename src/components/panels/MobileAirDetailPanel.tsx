import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MobileAirRoute,
  MobileAirDataPoint,
  MobileAirMatchedReport,
  MOBILEAIR_POLLUTANT_MAPPING,
} from "../../types";
import { pollutants } from "../../constants/pollutants";
import {
  getQualityColor,
  getQualityLevel,
} from "../../constants/qualityColors";
import { AmChartsLineChart, AmChartsLineChartData, AmChartsLineSeries } from "../charts";
import ExportMenu from "../charts/ExportMenu";
import { getCommonThresholds } from "../charts/utils/historicalChartConfig";
import { addThresholdZones } from "../charts/utils/amChartsHelpers";
import {
  exportAmChartsAsPNG,
  exportDataAsCSV,
  generateExportFilename,
} from "../../utils/exportUtils";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import SidePanelShell, {
  CHART_PANEL_BODY_CLASS,
  CHART_PANEL_HEIGHT_CLASS,
  type PanelSize,
} from "./SidePanelShell";
import CollapsiblePanelSection from "./CollapsiblePanelSection";
import PanelReopenBadge from "./PanelReopenBadge";
import MobileAirManageSection from "./MobileAirManageSection";
import MobileAirMovingBadge from "./MobileAirMovingBadge";
import MobileAirReportsSection from "./MobileAirReportsSection";
import { filterReportsForRoute } from "../../utils/mobileAirContextMatch";
import type { MobileAirSensorStatus } from "../../constants/mobileAir";

interface MobileAirDetailPanelProps {
  isOpen: boolean;
  selectedRoute: MobileAirRoute | null;
  activeRoute: MobileAirRoute | null;
  allRoutes: MobileAirRoute[];
  initialPollutant: string;
  highlightedPoint?: MobileAirDataPoint | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange: (size: PanelSize) => void;
  onPointHover?: (point: MobileAirDataPoint | null) => void;
  onPointHighlight?: (point: MobileAirDataPoint | null) => void;
  onRouteSelect?: (route: MobileAirRoute) => void;
  panelSize: PanelSize;
  /** Gestion multi-capteurs (solution D) */
  loadedSensorIds?: string[];
  sensorVisibility?: Record<string, boolean>;
  sensorStatus?: Record<string, MobileAirSensorStatus>;
  sensorPeriods?: Record<string, { startDate: string; endDate: string }>;
  defaultPeriod?: { startDate: string; endDate: string };
  isSessionOnMap?: (route: MobileAirRoute) => boolean;
  onSensorVisibilityChange?: (sensorId: string, visible: boolean) => void;
  onSensorRemove?: (sensorId: string) => void;
  onSensorPeriodChange?: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  onToggleSessionOnMap?: (route: MobileAirRoute, visible: boolean) => void;
  onSetSensorSessionsVisible?: (sensorId: string, visible: boolean) => void;
  /** Signalements appariés (get_context) pour les sessions chargées */
  matchedReports?: MobileAirMatchedReport[];
}

const MobileAirDetailPanel: React.FC<MobileAirDetailPanelProps> = ({
  isOpen,
  selectedRoute,
  activeRoute,
  allRoutes,
  initialPollutant,
  highlightedPoint,
  onClose,
  onHidden,
  onSizeChange,
  onPointHover,
  onPointHighlight,
  onRouteSelect,
  panelSize,
  loadedSensorIds = [],
  sensorVisibility = {},
  sensorStatus = {},
  sensorPeriods = {},
  defaultPeriod = { startDate: "", endDate: "" },
  isSessionOnMap,
  onSensorVisibilityChange,
  onSensorRemove,
  onSensorPeriodChange,
  onToggleSessionOnMap,
  onSetSensorSessionsVisible,
  matchedReports = [],
}) => {
  const { t, i18n } = useTranslation();
  const [hoveredPoint, setHoveredPoint] = useState<MobileAirDataPoint | null>(
    null
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [localSelectedPollutants, setLocalSelectedPollutants] = useState<string[]>([initialPollutant]);
  const chartRef = useRef<am5xy.XYChart | null>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRefs = useRef<Map<string, am5xy.LineSeries>>(new Map());
  const routeIdRef = useRef<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const reportRangesRef = useRef<am5.DataItem<am5xy.IDateAxisDataItem>[]>([]);
  const matchedReportsRef = useRef(matchedReports);
  matchedReportsRef.current = matchedReports;

  // Initialiser les polluants locaux uniquement lors de l'ouverture du panel ou du changement de route
  useEffect(() => {
    if (!isOpen) {
      // Réinitialiser la référence de route quand le panel est fermé
      routeIdRef.current = null;
      return;
    }
    
    // activeRoute = focus calculé (null si aucun trajet coché sur la carte)
    const routeToUse = activeRoute;
    const currentRouteId = routeToUse 
      ? `${routeToUse.sensorId}-${routeToUse.sessionId}` 
      : null;
    
    // Vérifier si c'est une nouvelle route ou l'ouverture du panel
    const isNewRoute = currentRouteId !== routeIdRef.current;
    
    if (isNewRoute && currentRouteId) {
      routeIdRef.current = currentRouteId;
      
      // Vérifier si le polluant initial est supporté par MobileAir
      const isSupported = Object.values(MOBILEAIR_POLLUTANT_MAPPING).includes(initialPollutant);
      if (isSupported) {
        // Initialiser avec le polluant initial uniquement lors du chargement initial
        setLocalSelectedPollutants([initialPollutant]);
      }
    }
  }, [isOpen, selectedRoute, activeRoute, initialPollutant]);

  // Liste des polluants supportés par MobileAir
  const supportedPollutants = useMemo(() => {
    return Object.entries(MOBILEAIR_POLLUTANT_MAPPING).map(([key, value]) => ({
      code: value,
      label: t(`pollutants.${value}`, { defaultValue: key }),
      key: key,
    }));
  }, [t]);

  // Fonction pour obtenir une couleur pour un polluant
  const getPollutantColor = useCallback((pollutantCode: string, index: number): string => {
    const colors = ["#3B82F6", "#EF4444", "#10B981"]; // Bleu, Rouge, Vert
    return colors[index % colors.length];
  }, []);


  // Fonction pour obtenir la clé du polluant dans les données
  const getPollutantKey = (pollutant: string): string => {
    const mapping: Record<string, string> = {
      pm1: "PM1",
      pm25: "PM25",
      pm10: "PM10",
    };
    return mapping[pollutant] || "PM25";
  };


  // Fonction pour formater la durée
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return t("panels.mobileAirDetail.durationMin", { count: Math.round(minutes) });
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return t("panels.mobileAirDetail.durationHrMin", {
      hours,
      minutes: remainingMinutes,
    });
  };

  // Fonction pour formater la date
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "de" ? "de-DE" : i18n.language === "ar" ? "ar-SA" : i18n.language;
    return date.toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [i18n.language]);

  // Fonction pour générer un identifiant unique pour un point
  const getPointId = (point: MobileAirDataPoint): string => {
    return `${point.sensorId}-${point.sessionId}-${
      point.time
    }-${point.lat.toFixed(6)}-${point.lon.toFixed(6)}`;
  };

  // Fonction pour comparer deux points avec une tolérance appropriée
  const isSamePoint = (
    point1: MobileAirDataPoint,
    point2: MobileAirDataPoint
  ): boolean => {
    // Comparaison d'abord par identifiant unique (plus fiable)
    if (
      point1.sensorId === point2.sensorId &&
      point1.sessionId === point2.sessionId &&
      point1.time === point2.time
    ) {
      return true;
    }

    // Fallback avec tolérance pour les coordonnées
    const COORDINATE_TOLERANCE = 0.0001; // Environ 10 mètres

    // Comparaison des coordonnées avec tolérance
    const latMatch = Math.abs(point1.lat - point2.lat) < COORDINATE_TOLERANCE;
    const lonMatch = Math.abs(point1.lon - point2.lon) < COORDINATE_TOLERANCE;

    // Comparaison des timestamps (plus flexible)
    const time1 = new Date(point1.time).getTime();
    const time2 = new Date(point2.time).getTime();
    const timeMatch = Math.abs(time1 - time2) < 1000; // Tolérance de 1 seconde

    return latMatch && lonMatch && timeMatch;
  };

  // Source de vérité : focus carte (null si tous les trajets sont désactivés)
  const routeToUse = activeRoute;

  const routeReports = useMemo(
    () => filterReportsForRoute(matchedReports, routeToUse),
    [matchedReports, routeToUse]
  );

  const clearReportRanges = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) {
      reportRangesRef.current = [];
      return;
    }
    const xAxis = chart.xAxes.getIndex(0) as
      | am5xy.DateAxis<am5xy.AxisRendererX>
      | undefined;
    if (!xAxis) return;
    for (const item of reportRangesRef.current) {
      try {
        xAxis.axisRanges.removeValue(item);
      } catch {
        // ignore
      }
    }
    reportRangesRef.current = [];
  }, []);

  const paintReportBubbles = useCallback(() => {
    const chart = chartRef.current;
    const root = rootRef.current;
    if (!chart || !root || !routeToUse) return;

    const xAxis = chart.xAxes.getIndex(0) as
      | am5xy.DateAxis<am5xy.AxisRendererX>
      | undefined;
    if (!xAxis) return;

    clearReportRanges();

    const reports = filterReportsForRoute(
      matchedReportsRef.current,
      routeToUse
    );

    for (const report of reports) {
      const ts = Date.parse(report.datetimeStart);
      if (Number.isNaN(ts)) continue;

      const shortComment = (report.comments || "").trim().slice(0, 40);
      const typeLabel = t(`mobileAir.contextType.${report.contextType}`, {
        defaultValue: report.contextType,
      });
      const labelText = shortComment
        ? `${typeLabel}: ${shortComment}`
        : typeLabel;

      const rangeDataItem = xAxis.makeDataItem({ value: ts });
      const range = xAxis.createAxisRange(rangeDataItem);
      range.get("grid")?.setAll({
        stroke: am5.color("#F59E0B"),
        strokeOpacity: 0.85,
        strokeWidth: 1.5,
        strokeDasharray: [3, 3],
        visible: true,
      });
      const label = range.get("label");
      if (label) {
        label.setAll({
          text: labelText,
          inside: true,
          rotation: -90,
          centerX: 0,
          centerY: 0,
          dy: -8,
          fontSize: 9,
          fill: am5.color("#B45309"),
          background: am5.RoundedRectangle.new(root, {
            fill: am5.color("#FFFBEB"),
            fillOpacity: 0.92,
            cornerRadiusTL: 3,
            cornerRadiusTR: 3,
            cornerRadiusBL: 3,
            cornerRadiusBR: 3,
          }),
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: 4,
          paddingRight: 4,
        });
      }
      reportRangesRef.current.push(rangeDataItem);
    }
  }, [clearReportRanges, routeToUse, t]);

  useEffect(() => {
    paintReportBubbles();
  }, [paintReportBubbles, routeReports]);

  const handleReportClick = useCallback(
    (report: MobileAirMatchedReport) => {
      setSelectedReportId(report.id);
      onPointHighlight?.(report.matchedPoint);

      const chart = chartRef.current;
      const xAxis = chart?.xAxes.getIndex(0) as
        | am5xy.DateAxis<am5xy.AxisRendererX>
        | undefined;
      if (xAxis) {
        const ts = Date.parse(report.datetimeStart);
        if (!Number.isNaN(ts)) {
          const pad = 15 * 60 * 1000;
          try {
            xAxis.zoomToValues(ts - pad, ts + pad);
          } catch {
            // ignore zoom errors
          }
        }
      }
    },
    [onPointHighlight]
  );

  // Préparer les données pour le graphique avec tous les polluants sélectionnés
  const chartData = useMemo(() => {
    if (!routeToUse || localSelectedPollutants.length === 0) return [];
    
    // Trier les points par timestamp
    const sortedPoints = [...routeToUse.points].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // Créer une entrée par point avec toutes les valeurs des polluants sélectionnés
    return sortedPoints
      .map((point) => {
        const timestamp = new Date(point.time).getTime();
        const dataPoint: Record<string, any> = {
          timestamp,
          point: point, // Stocker le point original pour les interactions
        };

        // Ajouter la valeur pour chaque polluant sélectionné
        localSelectedPollutants.forEach((pollutantCode) => {
          const pollutantKey = getPollutantKey(pollutantCode);
          const value = point[pollutantKey as keyof MobileAirDataPoint] as number;
          if (value != null && !isNaN(value)) {
            dataPoint[pollutantCode] = value;
          }
        });

        // Retourner null si aucun polluant n'a de valeur valide
        const hasValidValue = localSelectedPollutants.some((pollutantCode) => 
          dataPoint[pollutantCode] != null
        );

        return hasValidValue ? dataPoint : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [routeToUse, localSelectedPollutants]);

  // Préparer les données pour amCharts (même structure, mais avec tous les polluants)
  const amChartsData: AmChartsLineChartData[] = useMemo(() => {
    return chartData.map((item) => {
      const chartItem: Record<string, any> = {
        timestamp: item.timestamp,
        point: item.point,
      };
      
      // Ajouter chaque polluant comme propriété séparée (toujours présenter, même si null)
      // AmCharts a besoin que toutes les propriétés existent pour toutes les séries
      localSelectedPollutants.forEach((pollutantCode) => {
        chartItem[pollutantCode] = item[pollutantCode] ?? null;
      });

      return chartItem as AmChartsLineChartData;
    });
  }, [chartData, localSelectedPollutants]);

  // Configuration des séries (une par polluant sélectionné)
  const series: AmChartsLineSeries[] = useMemo(() => {
    return localSelectedPollutants.map((pollutantCode, index) => ({
      dataKey: pollutantCode,
      name: t(`pollutants.${pollutantCode}`, { defaultValue: pollutantCode }),
      color: getPollutantColor(pollutantCode, index),
      strokeWidth: 2,
      yAxisId: "left",
    }));
  }, [localSelectedPollutants, getPollutantColor, t]);

  // Formatage de l'axe X
  const xAxisLabelFormatter = useCallback((date: Date) => {
    const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "de" ? "de-DE" : i18n.language === "ar" ? "ar-SA" : i18n.language;
    return date.toLocaleString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [i18n.language]);

  // Formatage du tooltip - non utilisé car on le configure dans handleChartReady
  const tooltipFormatter = undefined;

  // Callback quand le graphique est prêt - stable pour éviter les recréations
  const handleChartReady = useCallback(
    (chart: am5xy.XYChart, root: am5.Root) => {
      chartRef.current = chart;
      rootRef.current = root;

      // Récupérer l'axe X et l'axe Y
      const xAxis = chart.xAxes.getIndex(0) as am5xy.DateAxis<am5xy.AxisRendererX>;
      const yAxis = chart.yAxes.getIndex(0) as am5xy.ValueAxis<am5xy.AxisRendererY>;

      // Calculer les seuils communs pour les polluants sélectionnés
      const commonThresholds = getCommonThresholds(localSelectedPollutants, "mobileair", []);
      
      // Ajouter les zones de seuils si disponibles
      if (commonThresholds && yAxis) {
        const yAxisMap = new Map<string, am5xy.ValueAxis<am5xy.AxisRendererY>>();
        yAxisMap.set("left", yAxis);
        addThresholdZones(yAxisMap, commonThresholds);
      }

      // Récupérer toutes les séries et les stocker (ordre = localSelectedPollutants)
      chart.series.each((seriesItem, index) => {
        const lineSeries = seriesItem as am5xy.LineSeries;
        const pollutantCode = localSelectedPollutants[index];
        if (pollutantCode) {
          seriesRefs.current.set(pollutantCode, lineSeries);
        }
      });

      const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "de" ? "de-DE" : i18n.language === "ar" ? "ar-SA" : i18n.language;
      const formatDateForTooltip = (dateString: string) =>
        new Date(dateString).toLocaleString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

      // Configurer le tooltip pour chaque série
      chart.series.each((seriesItem, index) => {
        const lineSeries = seriesItem as am5xy.LineSeries;
        const seriesName = lineSeries.get("name");
        const pollutantCode = localSelectedPollutants[index] || localSelectedPollutants[0];
        const config = pollutants[pollutantCode];

        const tooltip = am5.Tooltip.new(root, {});
        tooltip.label.adapters.add("text", (text, target) => {
          const dataItem = target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>;
          if (dataItem) {
            const data = dataItem.dataContext as { point: MobileAirDataPoint };
            const value = (dataItem as any).get("valueY") as number;

            if (data && data.point && typeof value === "number" && seriesName) {
              return `${formatDateForTooltip(data.point.time)} - ${seriesName}: ${value.toFixed(1)} ${config?.unit || "µg/m³"}`;
            }
            if (typeof value === "number") {
              return `${value.toFixed(1)} µg/m³`;
            }
          }
          return text;
        });
        lineSeries.set("tooltip", tooltip);
      });

      // Configurer le curseur vertical au lieu des points
      const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
        behavior: "zoomXY",
        xAxis: xAxis,
      }));
      
      if (chart.series.length > 0) {
        cursor.set("snapToSeries", chart.series.values);
      }
      
      // Afficher uniquement la ligne verticale (pas la ligne horizontale)
      cursor.lineY.set("visible", false);
      cursor.lineX.set("visible", true);
      cursor.lineX.set("stroke", am5.color("#666666"));
      cursor.lineX.set("strokeWidth", 2);
      cursor.lineX.set("strokeDasharray", [5, 5]);

      // Fonction pour trouver et mettre en évidence le point le plus proche
      const findAndHighlightPoint = (xValue: number) => {
        let closestPoint: MobileAirDataPoint | null = null;
        let minDistance = Infinity;

        // Parcourir toutes les séries pour trouver le point le plus proche
        chart.series.each((seriesItem) => {
          const lineSeries = seriesItem as am5xy.LineSeries;
          const dataItemsArray = Array.from(lineSeries.dataItems);
          for (const dataItem of dataItemsArray) {
            const itemX = (dataItem as any).get("valueX") as number;
            if (itemX !== undefined) {
              const distance = Math.abs(itemX - xValue);
              if (distance < minDistance) {
                minDistance = distance;
                const data = dataItem.dataContext as { point: MobileAirDataPoint };
                if (data && data.point) {
                  closestPoint = data.point;
                }
              }
            }
          }
        });

        if (closestPoint) {
          setHoveredPoint(closestPoint);
          if (onPointHover) {
            onPointHover(closestPoint);
          }
        }
      };

      // Gérer les événements du curseur pour mettre en évidence les points
      // Ajouter des bullets interactifs sur chaque série
      chart.series.each((seriesItem) => {
        const lineSeries = seriesItem as am5xy.LineSeries;
        
        // Créer des bullets interactifs avec une zone de détection plus large
        lineSeries.bullets.push((root, series, dataItem) => {
          const circle = am5.Circle.new(root, {
            radius: 10, // Zone de détection plus large
            fill: am5.color("#00000000"), // Transparent
            stroke: am5.color("#00000000"), // Transparent
            fillOpacity: 0,
            strokeOpacity: 0,
            cursorOverStyle: "pointer",
          });

          // Gérer le survol sur les bullets
          circle.events.on("pointerover", () => {
            const data = dataItem.dataContext as { point: MobileAirDataPoint };
            if (data && data.point) {
              setHoveredPoint(data.point);
              if (onPointHover) {
                onPointHover(data.point);
              }
            }
          });

          circle.events.on("pointerout", () => {
            // Réinitialiser le point survolé quand on quitte
            setHoveredPoint(null);
            if (onPointHover) {
              onPointHover(null);
            }
          });

          return am5.Bullet.new(root, {
            sprite: circle,
          });
        });
        
      });

      // Utiliser un intervalle pour vérifier la position du curseur
      // Cette approche fonctionne en vérifiant périodiquement la position du curseur
      let lastHoveredPoint: MobileAirDataPoint | null = null;
      let cursorCheckInterval: any = null;
      
      const checkCursorPosition = () => {
        if (!cursor || !xAxis) return;
        
        try {
          // Obtenir la position X du curseur
          // Le curseur amCharts stocke sa position dans l'axe X via getPrivate
          const cursorX = (cursor as any).getPrivate("xPosition") as number | undefined;
          const isVisible = cursor.get("visible") !== false;
          
          if (isVisible && cursorX !== undefined && !isNaN(cursorX)) {
            // Convertir la position en valeur de date
            const xValue = xAxis.positionToValue(cursorX);
            
            if (xValue !== undefined && !isNaN(xValue)) {
              // Trouver le point le plus proche
              let closestPoint: MobileAirDataPoint | null = null;
              let minDistance = Infinity;

              chart.series.each((seriesItem) => {
                const lineSeries = seriesItem as am5xy.LineSeries;
                const dataItemsArray = Array.from(lineSeries.dataItems);
                
                for (const dataItem of dataItemsArray) {
                  const itemX = (dataItem as any).get("valueX") as number;
                  if (itemX !== undefined) {
                    const distance = Math.abs(itemX - xValue);
                    if (distance < minDistance) {
                      minDistance = distance;
                      const data = dataItem.dataContext as { point: MobileAirDataPoint };
                      if (data && data.point) {
                        closestPoint = data.point;
                      }
                    }
                  }
                }
              });

              // Mettre à jour seulement si le point a changé
              if (closestPoint && (!lastHoveredPoint || !isSamePoint(closestPoint, lastHoveredPoint))) {
                lastHoveredPoint = closestPoint;
                setHoveredPoint(closestPoint);
                if (onPointHover) {
                  onPointHover(closestPoint);
                }
              }
            }
          } else if (lastHoveredPoint !== null) {
            // Si le curseur n'est plus visible, réinitialiser
            lastHoveredPoint = null;
            setHoveredPoint(null);
            if (onPointHover) {
              onPointHover(null);
            }
          }
        } catch (error) {
          // Ignorer les erreurs silencieusement
        }
      };

      // Vérifier la position du curseur périodiquement (toutes les 100ms)
      cursorCheckInterval = setInterval(checkCursorPosition, 100);
      
      // Stocker l'intervalle pour le nettoyage
      (root as any).__cursorCheckInterval = cursorCheckInterval;

      // Bulles signalements (après création du chart)
      paintReportBubbles();
    },
    [localSelectedPollutants, onPointHover, i18n.language, paintReportBubbles]
  );

  // Nettoyer l'intervalle du curseur au démontage
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        const interval = (rootRef.current as any).__cursorCheckInterval;
        if (interval) {
          clearInterval(interval);
        }
      }
    };
  }, []);

  // Plus besoin de gérer highlightedPoint, on utilise uniquement hoveredPoint

  const mobileAirExportMetadata = useMemo(() => {
    if (!routeToUse) return [];
    const pollutantLabels = localSelectedPollutants
      .map((pollutantCode) =>
        t(`pollutants.${pollutantCode}`, { defaultValue: pollutantCode })
      )
      .join(", ");

    return [
      `MobileAir - Session ${routeToUse.sessionId}`,
      `Capteur: ${routeToUse.sensorId}`,
      `Début: ${formatDate(routeToUse.startTime)}`,
      `Fin: ${formatDate(routeToUse.endTime)}`,
      `Polluants: ${pollutantLabels}`,
      `Points: ${routeToUse.points.length}`,
    ];
  }, [routeToUse, localSelectedPollutants, t, formatDate]);

  const handleExportPNG = useCallback(async () => {
    if (!routeToUse || !amChartsData.length) return;

    try {
      const filename = generateExportFilename("mobileair", localSelectedPollutants);
      await exportAmChartsAsPNG(
        chartContainerRef,
        filename,
        null,
        localSelectedPollutants,
        "mobileair",
        [],
        undefined,
        undefined,
        mobileAirExportMetadata
      );
    } catch (error) {
      console.error("Erreur lors de l'export PNG MobileAir:", error);
      alert("Erreur lors de l'exportation en PNG");
    }
  }, [
    routeToUse,
    amChartsData.length,
    localSelectedPollutants,
    mobileAirExportMetadata,
  ]);

  const handleExportCSV = useCallback(() => {
    if (!routeToUse || !amChartsData.length) return;

    try {
      const filename = generateExportFilename("mobileair", localSelectedPollutants);
      exportDataAsCSV(
        amChartsData,
        filename,
        "mobileair",
        [],
        localSelectedPollutants,
        null,
        undefined,
        undefined,
        mobileAirExportMetadata
      );
    } catch (error) {
      console.error("Erreur lors de l'export CSV MobileAir:", error);
      alert("Erreur lors de l'exportation en CSV");
    }
  }, [
    routeToUse,
    amChartsData,
    localSelectedPollutants,
    mobileAirExportMetadata,
  ]);

  // Return conditionnel APRÈS tous les hooks
  if (!isOpen) {
    return null;
  }

  // Vérifier si au moins un polluant est supporté par MobileAir
  const isPollutantSupported = localSelectedPollutants.some((p) =>
    Object.values(MOBILEAIR_POLLUTANT_MAPPING).includes(p)
  );

  const hasManage =
    loadedSensorIds.length > 0 &&
    onSensorVisibilityChange &&
    onSensorRemove &&
    onSensorPeriodChange &&
    onToggleSessionOnMap &&
    onSetSensorSessionsVisible &&
    isSessionOnMap;

  return (
    <SidePanelShell
      isOpen={isOpen}
      panelSize={panelSize}
      onSizeChange={onSizeChange}
      onHidden={onHidden}
      width="compact"
      bodyClassName={CHART_PANEL_BODY_CLASS}
      testId="mobileair-detail-panel"
      title={
        routeToUse
          ? t("panels.mobileAirDetail.sessionTitle", {
              sessionId: routeToUse.sessionId,
            })
          : t("panels.mobileAirManage.panelTitle")
      }
      subtitle={
        routeToUse
          ? t("panels.mobileAirDetail.sensorLabel", {
              sensorId: routeToUse.sensorId,
            })
          : loadedSensorIds.length > 0
            ? t("panels.mobileAirManage.title", {
                count: loadedSensorIds.length,
              })
            : undefined
      }
      badge={
        <div className="flex items-center gap-2">
          {routeToUse && (
            <MobileAirMovingBadge moving={routeToUse.moving} />
          )}
          <PanelReopenBadge
            label={t("panels.mobileAirSelection.reopenButtonTooltip")}
            className="bg-green-600 text-white"
          />
        </div>
      }
    >
      {hasManage && (
        <MobileAirManageSection
          sensorIds={loadedSensorIds}
          allRoutes={allRoutes}
          sensorVisibility={sensorVisibility}
          sensorStatus={sensorStatus}
          sensorPeriods={sensorPeriods}
          defaultPeriod={defaultPeriod}
          focusRoute={routeToUse}
          isSessionOnMap={isSessionOnMap}
          onSensorVisibilityChange={onSensorVisibilityChange}
          onSensorRemove={onSensorRemove}
          onSensorPeriodChange={onSensorPeriodChange}
          onToggleSessionOnMap={onToggleSessionOnMap}
          onSetSensorSessionsVisible={onSetSensorSessionsVisible}
          onFocusRoute={(route) => onRouteSelect?.(route)}
        />
      )}

      {!routeToUse && (
        <p className="rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-4 text-center text-sm text-[color:var(--fg-muted)]">
          {t("panels.mobileAirManage.selectSessionHint")}
        </p>
      )}

      {routeToUse && (
        <>
      {/* Sélection de polluants — compacte */}
      <div className="shrink-0 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-2 sm:p-2.5">
        <div className="mb-2 text-center text-xs font-medium text-[color:var(--fg-muted)]">
          {t("panels.mobileAirDetail.pollutantsDisplayed", { count: localSelectedPollutants.length })}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {supportedPollutants.map((pollutant) => {
            const isSelected = localSelectedPollutants.includes(pollutant.code);
            const colorIndex = localSelectedPollutants.indexOf(pollutant.code);
            const color = isSelected ? getPollutantColor(pollutant.code, colorIndex >= 0 ? colorIndex : 0) : undefined;
                
            return (
              <button
                key={pollutant.code}
                onClick={() => {
                  setLocalSelectedPollutants((prev) => {
                    if (prev.includes(pollutant.code)) {
                      // Ne pas permettre de désélectionner le dernier polluant
                      if (prev.length > 1) {
                        return prev.filter((p) => p !== pollutant.code);
                      }
                      return prev;
                    } else {
                      return [...prev, pollutant.code];
                    }
                  });
                }}
                className={`min-h-11 rounded-[var(--r-md)] px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none ${
                  isSelected
                    ? "text-white shadow-md"
                    : "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] hover:bg-black/10"
                }`}
                style={
                  isSelected && color
                    ? { backgroundColor: color }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {pollutant.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessions du capteur focus — repliées par défaut */}
      {!hasManage && allRoutes.length > 0 && (
        <CollapsiblePanelSection
          title={t("panels.mobileAirDetail.sessionsAvailable", { count: allRoutes.length })}
          defaultOpen={false}
          storageKey="mobileair-sessions"
        >
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {allRoutes
              .sort(
                (a, b) =>
                  new Date(b.startTime).getTime() -
                  new Date(a.startTime).getTime()
              )
              .map((route) => {
                const isCurrentSession = route.sessionId === routeToUse.sessionId;
                return (
                  <button
                    key={route.sessionId}
                    onClick={() => onRouteSelect && onRouteSelect(route)}
                    className={`w-full flex items-center justify-between p-3 rounded-[var(--r-md)] border transition-colors ${
                      isCurrentSession
                        ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
                        : "border-[rgb(16_32_56_/_0.09)] hover:bg-black/5"
                    }`}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className={`text-sm font-medium ${
                          isCurrentSession ? "text-blue-900" : "text-[color:var(--fg)]"
                        }`}>
                          {t("panels.mobileAirDetail.sessionLabel", { sessionId: route.sessionId })}
                        </div>
                        {isCurrentSession && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                            {t("panels.mobileAirDetail.currentBadge")}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${
                        isCurrentSession ? "text-blue-700" : "text-[color:var(--fg-muted)]"
                      }`}>
                        {formatDate(route.startTime)} •{" "}
                        {formatDuration(route.duration)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        isCurrentSession ? "text-blue-900" : "text-[color:var(--fg)]"
                      }`}>
                        {route.averageValue.toFixed(1)}{" "}
                        {pollutants[localSelectedPollutants[0]]?.unit || "µg/m³"}
                      </div>
                      <div className={`text-xs ${
                        isCurrentSession ? "text-blue-700" : "text-[color:var(--fg-muted)]"
                      }`}>
                        {t("panels.mobileAirDetail.pointsCount", { count: route.points.length })}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </CollapsiblePanelSection>
      )}

      <MobileAirReportsSection
        reports={routeReports}
        selectedReportId={selectedReportId}
        onReportClick={handleReportClick}
      />

      <CollapsiblePanelSection
        title={t("panels.mobileAirDetail.sessionInfoTitle")}
        defaultOpen={false}
        storageKey="mobileair-session-info"
      >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.startLabel")}</span>
            <p className="font-medium">
              {formatDate(routeToUse.startTime)}
            </p>
          </div>
          <div>
            <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.endLabel")}</span>
            <p className="font-medium">{formatDate(routeToUse.endTime)}</p>
          </div>
          <div>
            <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.durationLabel")}</span>
            <p className="font-medium">
              {formatDuration(routeToUse.duration)}
            </p>
          </div>
          <div>
            <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.pointsLabel")}</span>
            <p className="font-medium">{routeToUse.points.length}</p>
          </div>
          <div className="col-span-2">
            <span className="text-[color:var(--fg-muted)]">
              {t("panels.mobileAirDetail.modeLabel")}
            </span>
            <p className="mt-1">
              <MobileAirMovingBadge moving={routeToUse.moving} />
            </p>
          </div>
        </div>
      </CollapsiblePanelSection>

      <CollapsiblePanelSection
        title={t("panels.mobileAirDetail.statsTitle")}
        defaultOpen={false}
        storageKey="mobileair-stats"
      >
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <span className="text-[color:var(--fg-muted)] block">{t("panels.mobileAirDetail.average")}</span>
            <p className="font-medium text-lg">
              {routeToUse.averageValue.toFixed(1)}
            </p>
            <p className="text-xs text-[color:var(--fg-muted)]">
              {localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                ? pollutants[localSelectedPollutants[0]].unit 
                : "µg/m³"}
            </p>
          </div>
          <div className="text-center">
            <span className="text-[color:var(--fg-muted)] block">{t("panels.mobileAirDetail.maximum")}</span>
            <p className="font-medium text-lg">
              {routeToUse.maxValue.toFixed(1)}
            </p>
            <p className="text-xs text-[color:var(--fg-muted)]">
              {localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                ? pollutants[localSelectedPollutants[0]].unit 
                : "µg/m³"}
            </p>
          </div>
          <div className="text-center">
            <span className="text-[color:var(--fg-muted)] block">{t("panels.mobileAirDetail.minimum")}</span>
            <p className="font-medium text-lg">
              {routeToUse.minValue.toFixed(1)}
            </p>
            <p className="text-xs text-[color:var(--fg-muted)]">
              {localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                ? pollutants[localSelectedPollutants[0]].unit 
                : "µg/m³"}
            </p>
          </div>
        </div>
      </CollapsiblePanelSection>

      {/* Graphique — shrink-0 + hauteur clamp (évite le chevauchement flex-1 / canvas) */}
      <div className="flex shrink-0 flex-col rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-2 sm:p-3">
        {!isPollutantSupported ? (
          <div className={`flex items-center justify-center ${CHART_PANEL_HEIGHT_CLASS}`}>
            <div className="text-center">
              <svg
                className="w-12 h-12 text-red-400 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <h4 className="text-sm font-medium text-red-800 mb-2">
                {t("panels.mobileAirDetail.pollutantNotSupported")}
              </h4>
              <p className="text-xs text-red-600 mb-3">
                {t("panels.mobileAirDetail.pollutantsCannotBeDisplayed")}
              </p>
              <div className="bg-red-50 rounded-[var(--r-sm)] p-2">
                <p className="text-xs text-red-700">
                  {t("panels.mobileAirDetail.onlyPmSupported")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`relative isolate ${CHART_PANEL_HEIGHT_CLASS}`}
            ref={chartContainerRef}
          >
            <div
              className="absolute top-2 right-2 z-10"
              data-export-ignore="true"
            >
              <ExportMenu
                hasData={amChartsData.length > 0}
                onExportPNG={handleExportPNG}
                onExportCSV={handleExportCSV}
              />
            </div>
            <AmChartsLineChart
              key={`mobileair-chart-${localSelectedPollutants.join("-")}`}
              data={amChartsData}
              series={series}
              yAxes={[
                {
                  id: "left",
                  label: t("panels.mobileAirDetail.concentration"),
                  unit: localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                    ? pollutants[localSelectedPollutants[0]].unit 
                    : "µg/m³",
                },
              ]}
              height="100%"
              width="100%"
              showGrid={true}
              showLegend={true}
              onChartReady={handleChartReady}
              xAxisLabelFormatter={xAxisLabelFormatter}
              tooltipFormatter={tooltipFormatter}
            />
          </div>
        )}
      </div>

      {/* Point mis en surbrillance */}
      {hoveredPoint && (
        <div className="shrink-0 border border-yellow-300 rounded-[var(--r-md)] p-3 sm:p-4 bg-blue-50">
          <h3 className="text-sm font-medium text-yellow-800 mb-3 flex items-center">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
            {t("panels.mobileAirDetail.highlightedPoint")}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.timeLabel")}</span>
              <p className="font-medium">
                {formatDate(hoveredPoint.time)}
              </p>
            </div>
            <div>
              <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.positionLabel")}</span>
              <p className="font-medium text-xs">
                {hoveredPoint.lat.toFixed(6)},{" "}
                {hoveredPoint.lon.toFixed(6)}
              </p>
            </div>
            <div>
              <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.valueLabel")}</span>
              {localSelectedPollutants.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {localSelectedPollutants.map((pollutantCode, index) => {
                    const config = pollutants[pollutantCode];
                    const pollutantKey = getPollutantKey(pollutantCode);
                    const value = hoveredPoint[
                      pollutantKey as keyof MobileAirDataPoint
                    ] as number;
                        
                    return (
                      <div key={pollutantCode} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getPollutantColor(pollutantCode, index) }}
                        />
                        <span className="text-xs font-medium">
                          {t(`pollutants.${pollutantCode}`, { defaultValue: pollutantCode })}: {value?.toFixed(1) || "N/A"} {config?.unit || "µg/m³"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="font-medium">N/A</p>
              )}
            </div>
            <div>
              <span className="text-[color:var(--fg-muted)]">{t("panels.mobileAirDetail.levelLabel")}</span>
              {localSelectedPollutants.length > 0 && (
                <div className="space-y-1 mt-1">
                  {localSelectedPollutants.map((pollutantCode, index) => {
                    const pollutantKey = getPollutantKey(pollutantCode);
                    const value = hoveredPoint[
                      pollutantKey as keyof MobileAirDataPoint
                    ] as number;
                        
                    return (
                      <div key={pollutantCode} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getPollutantColor(pollutantCode, index) }}
                        />
                        <p
                          className="font-medium capitalize text-xs"
                          style={{
                            color: getQualityColor(value || 0, pollutantCode, pollutants),
                          }}
                        >
                          {t(`pollutants.${pollutantCode}`, { defaultValue: pollutantCode })}: {t(`quality.${getQualityLevel(value || 0, pollutantCode, pollutants)}`)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              {localSelectedPollutants.length === 0 && (
                <p className="font-medium">N/A</p>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </SidePanelShell>
  );
};

export default MobileAirDetailPanel;
