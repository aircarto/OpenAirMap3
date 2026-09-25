import React, { memo, useLayoutEffect } from "react";
import { Polyline, CircleMarker, useMap } from "react-leaflet";
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
import { isFixedMobileAirSession } from "../../constants/mobileAirMoving";

/** Panes dédiés : les points restent toujours au-dessus du trait. */
const MOBILEAIR_LINES_PANE = "mobileair-lines";
const MOBILEAIR_POINTS_PANE = "mobileair-points";

const EnsureMobileAirPanes: React.FC = () => {
  const map = useMap();
  useLayoutEffect(() => {
    // overlayPane = 400 ; points au-dessus des segments colorés
    if (!map.getPane(MOBILEAIR_LINES_PANE)) {
      const pane = map.createPane(MOBILEAIR_LINES_PANE);
      pane.style.zIndex = "410";
    }
    if (!map.getPane(MOBILEAIR_POINTS_PANE)) {
      const pane = map.createPane(MOBILEAIR_POINTS_PANE);
      pane.style.zIndex = "420";
    }
  }, [map]);
  return null;
};

interface MobileAirRoutesProps {
  routes: MobileAirRoute[];
  selectedPollutant: string;
  onPointClick?: (route: MobileAirRoute, point: MobileAirDataPoint) => void;
  onPointHover?: (point: MobileAirDataPoint | null) => void;
  onRouteClick?: (route: MobileAirRoute) => void;
  highlightedPoint?: MobileAirDataPoint | null;
  hoveredPoint?: MobileAirDataPoint | null;
  /** Session affichée dans le graphique — mise en évidence sur la carte. */
  focusedRoute?: MobileAirRoute | null;
}

const isSameRoute = (
  a: MobileAirRoute | null | undefined,
  b: MobileAirRoute
): boolean =>
  !!a &&
  String(a.sensorId) === String(b.sensorId) &&
  String(a.sessionId) === String(b.sessionId);

const MobileAirRoutes: React.FC<MobileAirRoutesProps> = memo(
  ({
    routes,
    selectedPollutant,
    onPointClick,
    onPointHover,
    onRouteClick,
    highlightedPoint,
    hoveredPoint,
    focusedRoute = null,
  }) => {
    // Vérifier si le polluant est supporté par MobileAir
    const isPollutantSupported = Object.values(
      MOBILEAIR_POLLUTANT_MAPPING
    ).includes(selectedPollutant);

    // Si le polluant n'est pas supporté, ne rien afficher
    if (!isPollutantSupported) {
      return null;
    }
    // Fonction pour générer un identifiant unique pour un point
    const getPointId = (point: MobileAirDataPoint): string => {
      return `${point.sensorId}-${point.sessionId}-${
        point.time
      }-${point.lat.toFixed(6)}-${point.lon.toFixed(6)}`;
    };

    // Fonction pour comparer deux points avec une tolérance appropriée
    // Doit être identique à celle dans MobileAirDetailPanel pour la cohérence
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

      // Fallback avec tolérance pour les coordonnées (au cas où les timestamps diffèrent légèrement)
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
    // Utiliser les fonctions centralisées pour la cohérence avec la légende

    // Fonction pour forcer les valeurs négatives à 0
    // Les concentrations de polluants ne peuvent pas être négatives
    const ensureNonNegativeValue = (value: number | undefined | null): number | undefined => {
      // Retourner undefined/null si la valeur n'est pas définie
      if (value === undefined || value === null) return undefined;
      // Vérifier que c'est un nombre valide et forcer les négatives à 0
      if (typeof value === "number" && !isNaN(value)) {
        return Math.max(0, value);
      }
      // Si ce n'est pas un nombre valide, retourner undefined
      return undefined;
    };

    // Fonction pour créer des segments colorés pour un parcours
    const createColoredSegments = (route: MobileAirRoute) => {
      const segments: Array<{
        positions: [number, number][];
        color: string;
        quality: string;
        value: number;
      }> = [];

      // Trier les points par timestamp pour s'assurer de l'ordre
      const sortedPoints = [...route.points].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );

      // Créer des segments entre chaque point consécutif
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const currentPoint = sortedPoints[i];
        const nextPoint = sortedPoints[i + 1];

        // Obtenir la valeur du polluant pour le point actuel
        const pollutantKey = getPollutantKey(selectedPollutant);
        const rawValue = currentPoint[
          pollutantKey as keyof typeof currentPoint
        ] as number;

        // Forcer les valeurs négatives à 0 avant de calculer les couleurs
        const correctedValue = ensureNonNegativeValue(rawValue);
        if (correctedValue !== undefined) {
          const color = getQualityColor(correctedValue, selectedPollutant, pollutants);
          const quality = getQualityLevel(correctedValue, selectedPollutant, pollutants);

          segments.push({
            positions: [
              [currentPoint.lat, currentPoint.lon],
              [nextPoint.lat, nextPoint.lon],
            ],
            color,
            quality,
            value: correctedValue,
          });
        }
      }

      return segments;
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
        return `${Math.round(minutes)} min`;
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        return `${hours}h ${remainingMinutes}min`;
      }
    };

    // Fonction pour formater la date
    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <>
        <EnsureMobileAirPanes />
        {[...routes]
          .sort((a, b) => {
            // Dessiner le trajet focus au-dessus des autres
            const aFocus = isSameRoute(focusedRoute, a) ? 1 : 0;
            const bFocus = isSameRoute(focusedRoute, b) ? 1 : 0;
            return aFocus - bFocus;
          })
          .map((route) => {
          const isFocused = isSameRoute(focusedRoute, route);
          const hasFocus = focusedRoute != null;
          // Style B — contour blanc GPS : focus lisible, autres colorés mais plus fins
          const lineWeight = isFocused ? 4 : hasFocus ? 2.5 : 3;
          const lineOpacity = isFocused ? 0.92 : hasFocus ? 0.45 : 0.6;
          const pointRadius = isFocused ? 7 : 5.5;
          const pointOpacity = isFocused ? 1 : hasFocus ? 0.65 : 0.8;
          const isFixed = isFixedMobileAirSession(route.moving);

          // Mesure fixe (moving=4) : un seul CircleMarker, pas de polyline
          if (isFixed) {
            const displayPoint =
              route.points[route.points.length - 1] ?? route.points[0];
            if (!displayPoint) return null;
            const pollutantKey = getPollutantKey(selectedPollutant);
            const rawValue = displayPoint[
              pollutantKey as keyof MobileAirDataPoint
            ] as number;
            const correctedValue = ensureNonNegativeValue(rawValue) || 0;
            const color = getQualityColor(
              correctedValue,
              selectedPollutant,
              pollutants
            );
            const isHovered =
              hoveredPoint && isSamePoint(hoveredPoint, displayPoint);

            return (
              <React.Fragment key={`${route.sensorId}-${route.sessionId}`}>
                {isHovered && (
                  <CircleMarker
                    pane={MOBILEAIR_POINTS_PANE}
                    center={[displayPoint.lat, displayPoint.lon]}
                    radius={16}
                    pathOptions={{
                      color: "rgba(0, 0, 0, 0.15)",
                      fillColor: "rgba(0, 0, 0, 0.1)",
                      fillOpacity: 0.2,
                      weight: 0,
                    }}
                    interactive={false}
                  />
                )}
                <CircleMarker
                  pane={MOBILEAIR_POINTS_PANE}
                  center={[displayPoint.lat, displayPoint.lon]}
                  radius={isHovered ? 14 : isFocused ? 10 : 8}
                  pathOptions={{
                    color: isHovered
                      ? "#FFFF00"
                      : isFocused
                        ? "#ffffff"
                        : color,
                    fillColor: color,
                    fillOpacity: 1,
                    weight: isHovered ? 3 : isFocused ? 2.5 : 2,
                    opacity: 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      onPointClick?.(route, displayPoint);
                      onRouteClick?.(route);
                    },
                    mouseover: () => onPointHover?.(displayPoint),
                    mouseout: () => onPointHover?.(null),
                  }}
                />
              </React.Fragment>
            );
          }

          const segments = createColoredSegments(route);

          return (
            <React.Fragment key={`${route.sensorId}-${route.sessionId}`}>
              {/* Contour blanc sous le trajet focus (lecture type GPS) */}
              {isFocused &&
                segments.map((segment, index) => (
                  <Polyline
                    key={`${route.sensorId}-${route.sessionId}-outline-${index}`}
                    pane={MOBILEAIR_LINES_PANE}
                    positions={segment.positions}
                    pathOptions={{
                      color: "#ffffff",
                      weight: lineWeight + 3,
                      opacity: 0.9,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                    interactive={false}
                  />
                ))}

              {/* Lignes de connexion entre les points */}
              {segments.map((segment, index) => (
                <Polyline
                  key={`${route.sensorId}-${route.sessionId}-${index}`}
                  pane={MOBILEAIR_LINES_PANE}
                  positions={segment.positions}
                  color={segment.color}
                  weight={lineWeight}
                  opacity={lineOpacity}
                  smoothFactor={1}
                  eventHandlers={
                    onRouteClick
                      ? {
                          click: () => onRouteClick(route),
                        }
                      : undefined
                  }
                />
              ))}

              {/* Points cliquables — pane au-dessus du trait */}
              {route.points.map((point, index) => {
                const pollutantKey = getPollutantKey(selectedPollutant);
                const rawValue = point[
                  pollutantKey as keyof MobileAirDataPoint
                ] as number;
                const correctedValue = ensureNonNegativeValue(rawValue) || 0;
                const color = getQualityColor(
                  correctedValue,
                  selectedPollutant,
                  pollutants
                );

                const isHovered =
                  hoveredPoint && isSamePoint(hoveredPoint, point);

                return (
                  <React.Fragment
                    key={`${route.sensorId}-${route.sessionId}-point-${index}`}
                  >
                    {isHovered && (
                      <>
                        <CircleMarker
                          pane={MOBILEAIR_POINTS_PANE}
                          center={[point.lat, point.lon]}
                          radius={18}
                          pathOptions={{
                            color: "rgba(0, 0, 0, 0.15)",
                            fillColor: "rgba(0, 0, 0, 0.1)",
                            fillOpacity: 0.2,
                            weight: 0,
                            opacity: 0.6,
                          }}
                          interactive={false}
                        />
                        <CircleMarker
                          pane={MOBILEAIR_POINTS_PANE}
                          center={[point.lat, point.lon]}
                          radius={14}
                          pathOptions={{
                            color: "rgba(0, 0, 0, 0.2)",
                            fillColor: "rgba(0, 0, 0, 0.15)",
                            fillOpacity: 0.25,
                            weight: 0,
                            opacity: 0.7,
                          }}
                          interactive={false}
                        />
                        <CircleMarker
                          pane={MOBILEAIR_POINTS_PANE}
                          center={[point.lat, point.lon]}
                          radius={12}
                          pathOptions={{
                            color: "#374151",
                            fillColor: "#374151",
                            fillOpacity: 0.2,
                            weight: 2,
                            opacity: 0.8,
                          }}
                          interactive={false}
                        />
                      </>
                    )}

                    <CircleMarker
                      pane={MOBILEAIR_POINTS_PANE}
                      center={[point.lat, point.lon]}
                      radius={isHovered ? 12 : pointRadius}
                      pathOptions={{
                        color: isHovered
                          ? "#FFFF00"
                          : isFocused
                            ? "#ffffff"
                            : color,
                        fillColor: color,
                        fillOpacity: isHovered ? 1 : pointOpacity,
                        weight: isHovered ? 3 : isFocused ? 2.5 : 1.5,
                        opacity: 1,
                      }}
                      eventHandlers={{
                        click: () => {
                          if (onPointClick) {
                            onPointClick(route, point);
                          }
                        },
                        mouseover: () => {
                          if (onPointHover) {
                            onPointHover(point);
                          }
                        },
                        mouseout: () => {
                          if (onPointHover) {
                            onPointHover(null);
                          }
                        },
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </>
    );
  }
);

MobileAirRoutes.displayName = "MobileAirRoutes";

export default MobileAirRoutes;
