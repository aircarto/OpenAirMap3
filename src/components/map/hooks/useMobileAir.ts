import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MobileAirRoute,
  MobileAirDataPoint,
  MobileAirMatchedReport,
  MeasurementDevice,
} from "../../../types";
import { DataServiceFactory } from "../../../services/DataServiceFactory";
import { MobileAirService } from "../../../services/MobileAirService";
import { mobileAirRouteKey, pickMostRecentMobileAirRoute } from "../../../constants/mobileAir";
import { matchContextsToRoutes } from "../../../utils/mobileAirContextMatch";
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
  /**
   * Session à privilégier au seed (ex. sessionId du point live cliqué).
   * Clé = sensorId, valeur = sessionId.
   */
  preferredSessionsBySensor?: Record<string, number>;
}

const mostRecentRoute = (
  routes: MobileAirRoute[]
): MobileAirRoute | null => pickMostRecentMobileAirRoute(routes);

/**
 * Clés de session à afficher au chargement : préférée si connue, sinon la plus récente.
 */
const seedSessionKeys = (
  routes: MobileAirRoute[],
  preferredSessionsBySensor: Record<string, number> = {}
): Set<string> => {
  const bySensor = new Map<string, MobileAirRoute[]>();
  for (const route of routes) {
    const list = bySensor.get(route.sensorId) ?? [];
    list.push(route);
    bySensor.set(route.sensorId, list);
  }
  const keys = new Set<string>();
  for (const [sensorId, sensorRoutes] of bySensor) {
    const preferredId = preferredSessionsBySensor[sensorId];
    const preferred =
      preferredId != null
        ? sensorRoutes.find((r) => Number(r.sessionId) === Number(preferredId))
        : null;
    const chosen = preferred ?? mostRecentRoute(sensorRoutes);
    if (chosen) {
      keys.add(mobileAirRouteKey(chosen.sensorId, chosen.sessionId));
    }
  }
  return keys;
};

/**
 * Libre choix des sessions sur la carte : un Set de clés visibles.
 * Au chargement, on seed la session la plus récente par capteur et on aligne
 * le focus graphique / contour carte sur la session globale la plus récente.
 */
export const useMobileAir = ({
  devices,
  mapRef,
  onMobileAirSensorSelected,
  isEnabled = false,
  sensorVisibility = {},
  preferredSessionsBySensor = {},
}: UseMobileAirProps) => {
  const [mobileAirRoutes, setMobileAirRoutes] = useState<MobileAirRoute[]>([]);
  const [matchedReports, setMatchedReports] = useState<MobileAirMatchedReport[]>(
    []
  );
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
  const preferredSessionsRef = useRef(preferredSessionsBySensor);
  preferredSessionsRef.current = preferredSessionsBySensor;

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
      setSelectedMobileAirRoute(null);
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

    // Premier arrivée de données : forcer 1 session (préférée ou récente) / capteur + focus.
    if (justLoaded) {
      const preferred = preferredSessionsRef.current;
      const seeded = seedSessionKeys(routes, preferred);
      setVisibleSessionKeys(seeded);
      for (const id of bySensor.keys()) {
        seededSensorIdsRef.current.add(id);
      }
      // Focus : session préférée du 1er capteur, sinon globale la plus récente
      let focus: MobileAirRoute | null = null;
      for (const [sensorId, sensorRoutes] of bySensor) {
        const prefId = preferred[sensorId];
        if (prefId != null) {
          focus =
            sensorRoutes.find((r) => Number(r.sessionId) === Number(prefId)) ??
            null;
          if (focus) break;
        }
      }
      setSelectedMobileAirRoute(focus ?? mostRecentRoute(routes));
      return;
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

  // Si le focus pointe une session absente des données, le recentrer.
  useEffect(() => {
    if (!selectedMobileAirRoute || mobileAirRoutes.length === 0) return;
    const stillThere = mobileAirRoutes.some(
      (r) =>
        r.sensorId === selectedMobileAirRoute.sensorId &&
        r.sessionId === selectedMobileAirRoute.sessionId
    );
    if (!stillThere) {
      setSelectedMobileAirRoute(mostRecentRoute(mobileAirRoutes));
    }
  }, [mobileAirRoutes, selectedMobileAirRoute]);

  const visibleRoutes = useMemo(() => {
    return mobileAirRoutes.filter((route) => {
      if (sensorVisibility[route.sensorId] === false) return false;
      return visibleSessionKeys.has(
        mobileAirRouteKey(route.sensorId, route.sessionId)
      );
    });
  }, [mobileAirRoutes, visibleSessionKeys, sensorVisibility]);

  // Focus graphique : session sélectionnée seulement si encore cochée,
  // sinon dernière session cochée (par date de fin), sinon rien.
  const focusRoute = useMemo(() => {
    if (visibleRoutes.length === 0) return null;

    if (selectedMobileAirRoute) {
      const stillVisible = visibleRoutes.some(
        (r) =>
          String(r.sensorId) === String(selectedMobileAirRoute.sensorId) &&
          String(r.sessionId) === String(selectedMobileAirRoute.sessionId)
      );
      if (stillVisible) return selectedMobileAirRoute;
    }
    return mostRecentRoute(visibleRoutes);
  }, [selectedMobileAirRoute, visibleRoutes]);

  // Si la session affichée est décochée : basculer sur la dernière cochée, sinon rien.
  useEffect(() => {
    if (!selectedMobileAirRoute) return;
    const stillVisible = visibleRoutes.some(
      (r) =>
        String(r.sensorId) === String(selectedMobileAirRoute.sensorId) &&
        String(r.sessionId) === String(selectedMobileAirRoute.sessionId)
    );
    if (stillVisible) return;
    setSelectedMobileAirRoute(focusRoute);
  }, [selectedMobileAirRoute, visibleRoutes, focusRoute]);

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
    setMatchedReports([]);
    setUserClosedDetailPanel(false);
    setIsMobileAirDetailPanelOpen(false);
    prevMobileAirRoutesLengthRef.current = 0;
    hasFittedBoundsRef.current = false;
  }, [isEnabled]);

  // Charger get_context pour les capteurs des routes chargées
  useEffect(() => {
    if (!isEnabled || mobileAirRoutes.length === 0) {
      setMatchedReports([]);
      return;
    }

    let cancelled = false;
    const sensorIds = [...new Set(mobileAirRoutes.map((r) => r.sensorId))];

    const loadContexts = async () => {
      try {
        const service = DataServiceFactory.getService(
          "mobileair"
        ) as MobileAirService;

        // Enveloppe temporelle des sessions chargées
        let minStart = Infinity;
        let maxEnd = -Infinity;
        for (const route of mobileAirRoutes) {
          const s = Date.parse(route.startTime);
          const e = Date.parse(route.endTime);
          if (!Number.isNaN(s)) minStart = Math.min(minStart, s);
          if (!Number.isNaN(e)) maxEnd = Math.max(maxEnd, e);
        }
        const period =
          Number.isFinite(minStart) && Number.isFinite(maxEnd)
            ? {
                startDate: new Date(minStart).toISOString(),
                endDate: new Date(maxEnd).toISOString(),
              }
            : undefined;

        const allRaw = (
          await Promise.all(
            sensorIds.map((id) => service.fetchContext(id, period))
          )
        ).flat();

        if (cancelled) return;
        setMatchedReports(matchContextsToRoutes(allRaw, mobileAirRoutes));
      } catch (error) {
        console.error("Erreur get_context MobileAir:", error);
        if (!cancelled) setMatchedReports([]);
      }
    };

    void loadContexts();
    return () => {
      cancelled = true;
    };
  }, [isEnabled, mobileAirRoutes]);

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
    matchedReports,
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
