import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MobileAirRoute,
  MobileAirDataPoint,
  MeasurementDevice,
} from "../../../types";
import { DataServiceFactory } from "../../../services/DataServiceFactory";
import { MobileAirService } from "../../../services/MobileAirService";
import { mobileAirRouteKey } from "../../../constants/mobileAir";
import L from "leaflet";

interface UseMobileAirProps {
  devices: MeasurementDevice[];
  mapRef: React.RefObject<L.Map | null>;
  onMobileAirSensorSelected?: (
    sensorIds: string[],
    period: { startDate: string; endDate: string }
  ) => void;
  isEnabled?: boolean;
  /** Visibilité par capteur (masquer sans retirer les données). */
  sensorVisibility?: Record<string, boolean>;
}

const mostRecentRoute = (routes: MobileAirRoute[]): MobileAirRoute | null => {
  if (routes.length === 0) return null;
  return routes.reduce((latest, current) =>
    new Date(current.startTime) > new Date(latest.startTime) ? current : latest
  );
};

/**
 * Libre choix des sessions sur la carte : un Set de clés visibles.
 * Au chargement, on seed la session la plus récente par capteur.
 */
export const useMobileAir = ({
  devices,
  mapRef,
  onMobileAirSensorSelected,
  isEnabled = false,
  sensorVisibility = {},
}: UseMobileAirProps) => {
  const [mobileAirRoutes, setMobileAirRoutes] = useState<MobileAirRoute[]>([]);
  const [isMobileAirDetailPanelOpen, setIsMobileAirDetailPanelOpen] =
    useState(false);
  const [mobileAirDetailPanelSize, setMobileAirDetailPanelSize] = useState<
    "normal" | "fullscreen" | "hidden"
  >("normal");
  const [selectedMobileAirRoute, setSelectedMobileAirRoute] =
    useState<MobileAirRoute | null>(null);
  const [hoveredMobileAirPoint, setHoveredMobileAirPoint] =
    useState<MobileAirDataPoint | null>(null);
  const [highlightedMobileAirPoint, setHighlightedMobileAirPoint] =
    useState<MobileAirDataPoint | null>(null);
  /** Sessions affichées sur la carte (`sensorId-sessionId`). */
  const [visibleSessionKeys, setVisibleSessionKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [userClosedDetailPanel, setUserClosedDetailPanel] = useState(false);
  const prevMobileAirRoutesLengthRef = useRef<number>(0);
  const [routesJustLoaded, setRoutesJustLoaded] = useState(false);
  const hasFittedBoundsRef = useRef(false);
  /** Capteurs pour lesquels on a déjà seedé une session visible. */
  const seededSensorIdsRef = useRef<Set<string>>(new Set());

  // Extraire les routes des devices + seed / purge des clés visibles
  useEffect(() => {
    if (!isEnabled) {
      setMobileAirRoutes([]);
      return;
    }

    const routes: MobileAirRoute[] = [];
    devices.forEach((device) => {
      if (device.source === "mobileair" && (device as any).mobileAirRoute) {
        routes.push((device as any).mobileAirRoute);
      }
    });

    const hadNoRoutes = prevMobileAirRoutesLengthRef.current === 0;
    const hasRoutesNow = routes.length > 0;
    const justLoaded = hadNoRoutes && hasRoutesNow;

    if (justLoaded) {
      setUserClosedDetailPanel(false);
      setRoutesJustLoaded(true);
      hasFittedBoundsRef.current = false;
      seededSensorIdsRef.current = new Set();
    }

    setMobileAirRoutes(routes);
    prevMobileAirRoutesLengthRef.current = routes.length;

    if (routes.length === 0) {
      setVisibleSessionKeys(new Set());
      seededSensorIdsRef.current = new Set();
      return;
    }

    const validKeys = new Set(
      routes.map((r) => mobileAirRouteKey(r.sensorId, r.sessionId))
    );

    const bySensor = new Map<string, MobileAirRoute[]>();
    for (const route of routes) {
      const list = bySensor.get(route.sensorId) ?? [];
      list.push(route);
      bySensor.set(route.sensorId, list);
    }

    setVisibleSessionKeys((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        if (validKeys.has(key)) next.add(key);
      }

      for (const [sensorId, sensorRoutes] of bySensor) {
        const hasVisible = sensorRoutes.some((r) =>
          next.has(mobileAirRouteKey(r.sensorId, r.sessionId))
        );
        const prefix = `${sensorId}-`;
        const prevHadKeysForSensor = [...prev].some((k) => k.startsWith(prefix));
        const prevKeysStillValid = [...prev].some(
          (k) => k.startsWith(prefix) && validKeys.has(k)
        );

        const isNewSensor = !seededSensorIdsRef.current.has(sensorId);
        // Refetch a remplacé les sessions : anciens choix invalides → re-seed.
        // Si l'utilisateur a tout décoché, prev n'a plus de clés pour ce capteur → ne pas re-seed.
        const lostAllToRefetch =
          !isNewSensor &&
          !hasVisible &&
          prevHadKeysForSensor &&
          !prevKeysStillValid;

        if (isNewSensor || lostAllToRefetch) {
          const recent = mostRecentRoute(sensorRoutes);
          if (recent) {
            next.add(mobileAirRouteKey(recent.sensorId, recent.sessionId));
          }
          seededSensorIdsRef.current.add(sensorId);
        }
      }

      for (const id of [...seededSensorIdsRef.current]) {
        if (!bySensor.has(id)) seededSensorIdsRef.current.delete(id);
      }
      return next;
    });
  }, [devices, isEnabled]);

  const visibleRoutes = useMemo(() => {
    return mobileAirRoutes.filter((route) => {
      if (sensorVisibility[route.sensorId] === false) return false;
      return visibleSessionKeys.has(
        mobileAirRouteKey(route.sensorId, route.sessionId)
      );
    });
  }, [mobileAirRoutes, visibleSessionKeys, sensorVisibility]);

  // Focus graphique : sélection explicite, sinon session visible la plus récente
  const focusRoute = useMemo(() => {
    if (selectedMobileAirRoute) {
      const stillThere = mobileAirRoutes.some(
        (r) =>
          r.sensorId === selectedMobileAirRoute.sensorId &&
          r.sessionId === selectedMobileAirRoute.sessionId
      );
      if (stillThere) return selectedMobileAirRoute;
    }
    return mostRecentRoute(visibleRoutes) ?? mostRecentRoute(mobileAirRoutes);
  }, [selectedMobileAirRoute, mobileAirRoutes, visibleRoutes]);

  const activeMobileAirRoute = focusRoute;

  useEffect(() => {
    const shouldOpen =
      isEnabled &&
      mobileAirRoutes.length > 0 &&
      focusRoute &&
      (!isMobileAirDetailPanelOpen || routesJustLoaded) &&
      (!userClosedDetailPanel || routesJustLoaded);

    if (shouldOpen) {
      const timer = setTimeout(() => {
        setIsMobileAirDetailPanelOpen(true);
        setMobileAirDetailPanelSize("normal");
        setRoutesJustLoaded(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [
    isEnabled,
    mobileAirRoutes.length,
    focusRoute,
    isMobileAirDetailPanelOpen,
    userClosedDetailPanel,
    routesJustLoaded,
  ]);

  useEffect(() => {
    if (
      visibleRoutes.length > 0 &&
      mapRef.current &&
      !hasFittedBoundsRef.current &&
      isEnabled
    ) {
      const bounds: [number, number][] = [];
      for (const route of visibleRoutes) {
        for (const point of route.points) {
          bounds.push([point.lat, point.lon]);
        }
      }
      if (bounds.length > 0) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
        hasFittedBoundsRef.current = true;
      }
    }
  }, [visibleRoutes, mapRef, isEnabled]);

  useEffect(() => {
    if (isEnabled) return;

    setVisibleSessionKeys(new Set());
    seededSensorIdsRef.current = new Set();
    setSelectedMobileAirRoute(null);
    setHoveredMobileAirPoint(null);
    setHighlightedMobileAirPoint(null);
    setMobileAirRoutes([]);
    setUserClosedDetailPanel(false);
    setIsMobileAirDetailPanelOpen(false);
    prevMobileAirRoutesLengthRef.current = 0;
    hasFittedBoundsRef.current = false;
  }, [isEnabled]);

  const handleMobileAirSensorsSelected = (
    sensorIds: string[],
    period: { startDate: string; endDate: string }
  ) => {
    try {
      const mobileAirService = DataServiceFactory.getService(
        "mobileair"
      ) as MobileAirService;
      mobileAirService.clearRoutes();
    } catch (error) {
      console.error("Erreur lors du nettoyage des routes MobileAir:", error);
    }

    setMobileAirRoutes([]);
    setVisibleSessionKeys(new Set());
    seededSensorIdsRef.current = new Set();
    setSelectedMobileAirRoute(null);
    prevMobileAirRoutesLengthRef.current = 0;
    setUserClosedDetailPanel(false);
    setRoutesJustLoaded(false);
    hasFittedBoundsRef.current = false;

    if (onMobileAirSensorSelected) {
      onMobileAirSensorSelected(sensorIds, period);
    }
  };

  const handleCloseMobileAirDetailPanel = () => {
    setUserClosedDetailPanel(true);
    setIsMobileAirDetailPanelOpen(false);
    setMobileAirDetailPanelSize("normal");
    setSelectedMobileAirRoute(null);
  };

  const handleMobileAirDetailPanelSizeChange = (
    newSize: "normal" | "fullscreen" | "hidden"
  ) => {
    setMobileAirDetailPanelSize(newSize);
    if (newSize === "hidden") {
      setUserClosedDetailPanel(true);
    }
  };

  /** Focus détail uniquement — n'impose pas la session sur la carte. */
  const openMobileAirDetailPanelForRoute = (
    route: MobileAirRoute,
    options?: { highlightedPoint?: MobileAirDataPoint | null }
  ) => {
    setSelectedMobileAirRoute(route);
    setHighlightedMobileAirPoint(options?.highlightedPoint ?? null);
    setUserClosedDetailPanel(false);
    setMobileAirDetailPanelSize("normal");
    setIsMobileAirDetailPanelOpen(true);
  };

  const focusRouteForDetail = (route: MobileAirRoute) => {
    openMobileAirDetailPanelForRoute(route);
  };

  const handleMobileAirPointClick = (
    route: MobileAirRoute,
    point: MobileAirDataPoint
  ) => {
    openMobileAirDetailPanelForRoute(route, { highlightedPoint: point });
  };

  const handleMobileAirPointHover = useCallback(
    (point: MobileAirDataPoint | null) => {
      setHoveredMobileAirPoint(point);
    },
    []
  );

  const handleMobileAirPointHighlight = useCallback(
    (point: MobileAirDataPoint | null) => {
      setHighlightedMobileAirPoint(point);
      if (point && mapRef.current) {
        mapRef.current.panTo([point.lat, point.lon], {
          animate: true,
          duration: 0.5,
        });
      }
    },
    [mapRef]
  );

  const handleMobileAirRouteClick = (route: MobileAirRoute) => {
    openMobileAirDetailPanelForRoute(route);
    if (route.points.length > 0 && mapRef.current) {
      const bounds = route.points.map(
        (point) => [point.lat, point.lon] as [number, number]
      );
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  const handleOpenMobileAirDetailPanel = () => {
    setUserClosedDetailPanel(false);
    setIsMobileAirDetailPanelOpen(true);
    setMobileAirDetailPanelSize("normal");
  };

  const setSessionVisible = useCallback(
    (route: MobileAirRoute, visible: boolean) => {
      const key = mobileAirRouteKey(route.sensorId, route.sessionId);
      setVisibleSessionKeys((prev) => {
        const next = new Set(prev);
        if (visible) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    []
  );

  const setSensorSessionsVisible = useCallback(
    (sensorId: string, visible: boolean) => {
      setVisibleSessionKeys((prev) => {
        const next = new Set(prev);
        for (const route of mobileAirRoutes) {
          if (route.sensorId !== sensorId) continue;
          const key = mobileAirRouteKey(route.sensorId, route.sessionId);
          if (visible) next.add(key);
          else next.delete(key);
        }
        return next;
      });
    },
    [mobileAirRoutes]
  );

  const isSessionOnMap = useCallback(
    (route: MobileAirRoute): boolean => {
      return visibleSessionKeys.has(
        mobileAirRouteKey(route.sensorId, route.sessionId)
      );
    },
    [visibleSessionKeys]
  );

  return {
    mobileAirRoutes,
    visibleRoutes,
    isMobileAirDetailPanelOpen,
    mobileAirDetailPanelSize,
    selectedMobileAirRoute,
    hoveredMobileAirPoint,
    highlightedMobileAirPoint,
    activeMobileAirRoute,
    visibleSessionKeys,
    handleMobileAirSensorsSelected,
    handleCloseMobileAirDetailPanel,
    handleMobileAirDetailPanelSizeChange,
    openMobileAirDetailPanelForRoute,
    focusRouteForDetail,
    handleMobileAirPointClick,
    handleMobileAirPointHover,
    handleMobileAirPointHighlight,
    handleMobileAirRouteClick,
    handleOpenMobileAirDetailPanel,
    setSessionVisible,
    setSensorSessionsVisible,
    /** Alias pour le panneau (même API que toggle précédent). */
    toggleSessionOnMap: setSessionVisible,
    isSessionOnMap,
  };
};
