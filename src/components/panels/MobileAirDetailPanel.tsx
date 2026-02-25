import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MobileAirRoute,
  MobileAirDataPoint,
  MOBILEAIR_POLLUTANT_MAPPING,
} from "../../types";
import { pollutants } from "../../constants/pollutants";
import {
  getQualityColor,
  getQualityLevel,
} from "../../constants/qualityColors";
import { AmChartsLineChart, AmChartsLineChartData, AmChartsLineSeries } from "../charts";
import { getCommonThresholds } from "../charts/utils/historicalChartConfig";
import { addThresholdZones } from "../charts/utils/amChartsHelpers";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";

interface MobileAirDetailPanelProps {
  isOpen: boolean;
  selectedRoute: MobileAirRoute | null;
  activeRoute: MobileAirRoute | null;
  allRoutes: MobileAirRoute[];
  initialPollutant: string;
  highlightedPoint?: MobileAirDataPoint | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange?: (size: "normal" | "fullscreen" | "hidden") => void;
  onPointHover?: (point: MobileAirDataPoint | null) => void;
  onPointHighlight?: (point: MobileAirDataPoint | null) => void;
  onRouteSelect?: (route: MobileAirRoute) => void;
  panelSize?: "normal" | "fullscreen" | "hidden";
}

type PanelSize = "normal" | "fullscreen" | "hidden";

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
  panelSize: externalPanelSize,
}) => {
  const { t, i18n } = useTranslation();
  const [internalPanelSize, setInternalPanelSize] =
    useState<PanelSize>("normal");
  const [hoveredPoint, setHoveredPoint] = useState<MobileAirDataPoint | null>(
    null
  );
  const [localSelectedPollutants, setLocalSelectedPollutants] = useState<string[]>([initialPollutant]);
  const chartRef = useRef<am5xy.XYChart | null>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRefs = useRef<Map<string, am5xy.LineSeries>>(new Map());
  const routeIdRef = useRef<string | null>(null);

  // Utiliser la taille externe si fournie, sinon la taille interne
  const currentPanelSize = externalPanelSize || internalPanelSize;

  // Initialiser les polluants locaux uniquement lors de l'ouverture du panel ou du changement de route
  useEffect(() => {
    if (!isOpen) {
      // Réinitialiser la référence de route quand le panel est fermé
      routeIdRef.current = null;
      return;
    }
    
    const routeToUse = selectedRoute || activeRoute;
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


  const handlePanelSizeChange = (newSize: PanelSize) => {
    if (onSizeChange) {
      onSizeChange(newSize);
    } else {
      setInternalPanelSize(newSize);
    }

    if (newSize === "hidden" && onHidden) {
      onHidden();
    }
  };

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
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "ar" ? "ar-SA" : i18n.language;
    return date.toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const routeToUse = selectedRoute || activeRoute;

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
  }, [selectedRoute, activeRoute, localSelectedPollutants]);

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
    const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "ar" ? "ar-SA" : i18n.language;
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

      const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "ar" ? "ar-SA" : i18n.language;
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
    },
    [localSelectedPollutants, onPointHover, i18n.language]
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

  // Return conditionnel APRÈS tous les hooks
  if (!isOpen || !routeToUse) {
    return null;
  }

  // Vérifier si au moins un polluant est supporté par MobileAir
  const isPollutantSupported = localSelectedPollutants.some((p) =>
    Object.values(MOBILEAIR_POLLUTANT_MAPPING).includes(p)
  );

  const getPanelClasses = () => {
    const baseClasses =
      "bg-white shadow-xl flex flex-col border-r border-gray-200 transition-all duration-300 h-full md:h-[calc(100vh-64px)] relative z-[1500]";

    switch (currentPanelSize) {
      case "fullscreen":
        // En fullscreen, utiliser absolute pour ne pas affecter le layout de la carte
        return `${baseClasses} absolute inset-0 w-full`;
      case "hidden":
        // Retirer complètement du flux pour éviter l'espace réservé
        return `${baseClasses} hidden`;
      case "normal":
      default:
        // Responsive: plein écran sur mobile, largeur réduite pour les petits écrans en paysage
        return `${baseClasses} w-full sm:w-[350px] md:w-[450px] lg:w-[600px] xl:w-[650px]`;
    }
  };

  return (
    <div className={getPanelClasses()}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-3 md:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {t("panels.mobileAirDetail.sessionTitle", { sessionId: routeToUse.sessionId })}
            </h2>
            {/* Rappel visuel du bouton de réouverture */}
            <div className="p-1 rounded bg-green-600 border border-green-600" title={t("panels.mobileAirSelection.reopenButtonTooltip")}>
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">
            {t("panels.mobileAirDetail.sensorLabel", { sensorId: routeToUse.sensorId })}
          </p>
        </div>

        {/* Contrôles unifiés du panel */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Bouton agrandir/rétrécir */}
          <button
            onClick={() =>
              handlePanelSizeChange(
                currentPanelSize === "fullscreen" ? "normal" : "fullscreen"
              )
            }
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={
              currentPanelSize === "fullscreen"
                ? t("panels.shrinkPanel")
                : t("panels.expandPanel")
            }
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {currentPanelSize === "fullscreen" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              )}
            </svg>
          </button>

          {/* Bouton rabattre */}
          <button
            onClick={() => handlePanelSizeChange("hidden")}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={t("panels.collapsePanel")}
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Contenu */}
      {currentPanelSize !== "hidden" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* Sélection de polluants */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
              {t("panels.mobileAirDetail.pollutantsDisplayed", { count: localSelectedPollutants.length })}
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? "text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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

          {/* Sessions disponibles */}
          {allRoutes.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
                {t("panels.mobileAirDetail.sessionsAvailable", { count: allRoutes.length })}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
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
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isCurrentSession
                            ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className={`text-sm font-medium ${
                              isCurrentSession ? "text-blue-900" : "text-gray-900"
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
                            isCurrentSession ? "text-blue-700" : "text-gray-600"
                          }`}>
                            {formatDate(route.startTime)} •{" "}
                            {formatDuration(route.duration)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            isCurrentSession ? "text-blue-900" : "text-gray-900"
                          }`}>
                            {route.averageValue.toFixed(1)}{" "}
                            {pollutants[localSelectedPollutants[0]]?.unit || "µg/m³"}
                          </div>
                          <div className={`text-xs ${
                            isCurrentSession ? "text-blue-700" : "text-gray-600"
                          }`}>
                            {t("panels.mobileAirDetail.pointsCount", { count: route.points.length })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Graphique */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
              {t("panels.mobileAirDetail.temporalEvolution")}
            </h3>
            {!isPollutantSupported ? (
              <div className="h-64 flex items-center justify-center">
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
                  <div className="bg-red-50 rounded-md p-2">
                    <p className="text-xs text-red-700">
                      {t("panels.mobileAirDetail.onlyPmSupported")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64">
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
            <div className="border border-yellow-300 rounded-lg p-3 sm:p-4 bg-blue-50">
              <h3 className="text-sm font-medium text-yellow-800 mb-3 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                {t("panels.mobileAirDetail.highlightedPoint")}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">{t("panels.mobileAirDetail.timeLabel")}</span>
                  <p className="font-medium">
                    {formatDate(hoveredPoint.time)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">{t("panels.mobileAirDetail.positionLabel")}</span>
                  <p className="font-medium text-xs">
                    {hoveredPoint.lat.toFixed(6)},{" "}
                    {hoveredPoint.lon.toFixed(6)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">{t("panels.mobileAirDetail.valueLabel")}</span>
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
                  <span className="text-gray-600">{t("panels.mobileAirDetail.levelLabel")}</span>
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
          {/* Informations de la session */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
              {t("panels.mobileAirDetail.sessionInfoTitle")}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">{t("panels.mobileAirDetail.startLabel")}</span>
                <p className="font-medium">
                  {formatDate(routeToUse.startTime)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">{t("panels.mobileAirDetail.endLabel")}</span>
                <p className="font-medium">{formatDate(routeToUse.endTime)}</p>
              </div>
              <div>
                <span className="text-gray-600">{t("panels.mobileAirDetail.durationLabel")}</span>
                <p className="font-medium">
                  {formatDuration(routeToUse.duration)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">{t("panels.mobileAirDetail.pointsLabel")}</span>
                <p className="font-medium">{routeToUse.points.length}</p>
              </div>
            </div>
          </div>

          {/* Statistiques */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
              {t("panels.mobileAirDetail.statsTitle")}
            </h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center">
                <span className="text-gray-600 block">{t("panels.mobileAirDetail.average")}</span>
                <p className="font-medium text-lg">
                  {routeToUse.averageValue.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">
                  {localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                    ? pollutants[localSelectedPollutants[0]].unit 
                    : "µg/m³"}
                </p>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block">{t("panels.mobileAirDetail.maximum")}</span>
                <p className="font-medium text-lg">
                  {routeToUse.maxValue.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">
                  {localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                    ? pollutants[localSelectedPollutants[0]].unit 
                    : "µg/m³"}
                </p>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block">{t("panels.mobileAirDetail.minimum")}</span>
                <p className="font-medium text-lg">
                  {routeToUse.minValue.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">
                  {localSelectedPollutants.length > 0 && pollutants[localSelectedPollutants[0]]?.unit 
                    ? pollutants[localSelectedPollutants[0]].unit 
                    : "µg/m³"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAirDetailPanel;
