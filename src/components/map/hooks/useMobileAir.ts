import { useState, useEffect, useCallback, useRef } from "react";
import {
  MobileAirRoute,
  MobileAirDataPoint,
  MeasurementDevice,
} from "../../../types";
import { DataServiceFactory } from "../../../services/DataServiceFactory";
import { MobileAirService } from "../../../services/MobileAirService";
import L from "leaflet";

interface UseMobileAirProps {
  devices: MeasurementDevice[];
  mapRef: React.RefObject<L.Map | null>;
  onMobileAirSensorSelected?: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  isEnabled?: boolean; // Nouveau prop pour contrôler si MobileAir est activé
}

export const useMobileAir = ({
  devices,
  mapRef,
  onMobileAirSensorSelected,
  isEnabled = false,
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
  const [activeMobileAirRoute, setActiveMobileAirRoute] =
    useState<MobileAirRoute | null>(null);
  const [userClosedDetailPanel, setUserClosedDetailPanel] = useState(false);
  const [forceNewChoice, setForceNewChoice] = useState(false);
  const prevMobileAirRoutesLengthRef = useRef<number>(0);
  const [routesJustLoaded, setRoutesJustLoaded] = useState<boolean>(false);

  // Effet pour extraire les routes MobileAir des devices
  useEffect(() => {
    if (!isEnabled) {
      setMobileAirRoutes([]);
      setForceNewChoice(false);
      return;
    }

    // Si on force un nouveau choix, ne pas créer de routes
    if (forceNewChoice) {
      setMobileAirRoutes([]);
      return;
    }

    const routes: MobileAirRoute[] = [];

    devices.forEach((device) => {
      if (device.source === "mobileair" && (device as any).mobileAirRoute) {
        routes.push((device as any).mobileAirRoute);
      }
    });

    // Détecter si de nouvelles routes viennent d'être chargées
    // (passage de 0 routes à >0 routes)
    const hadNoRoutes = prevMobileAirRoutesLengthRef.current === 0;
    const hasRoutesNow = routes.length > 0;
    const routesJustLoaded = hadNoRoutes && hasRoutesNow;

    // Si de nouvelles routes viennent d'être chargées, réinitialiser les flags
    // pour permettre le comportement automatique des panels
    if (routesJustLoaded) {
      setUserClosedDetailPanel(false);
      setRoutesJustLoaded(true);
    }
    // Ne pas mettre routesJustLoaded à false ici, il sera réinitialisé
    // dans l'effet qui ouvre le panel de détail

    setMobileAirRoutes(routes);

    // Mettre à jour la référence pour la prochaine fois
    prevMobileAirRoutesLengthRef.current = routes.length;

    // Définir automatiquement la route la plus récente comme active
    // UNIQUEMENT lors du chargement initial ou si le capteur a changé
    // Ne PAS écraser la sélection manuelle de l'utilisateur pour une autre session
    if (routes.length > 0) {
      const mostRecentRoute = routes.reduce((latest, current) => {
        return new Date(current.startTime) > new Date(latest.startTime)
          ? current
          : latest;
      });

      // Vérifier si on doit définir automatiquement la route active :
      // 1. Aucune route n'est active (chargement initial)
      // 2. Le capteur a changé (la route active actuelle n'existe plus dans les routes ou a un sensorId différent)
      // Mais PAS si l'utilisateur a sélectionné manuellement une autre session du même capteur
      const shouldSetActive =
        !activeMobileAirRoute ||
        activeMobileAirRoute.sensorId !== mostRecentRoute.sensorId ||
        !routes.some(
          (r) =>
            r.sensorId === activeMobileAirRoute.sensorId &&
            r.sessionId === activeMobileAirRoute.sessionId
        );

      if (shouldSetActive) {
        setActiveMobileAirRoute(mostRecentRoute);
        // Réinitialiser aussi la route sélectionnée si elle était liée à l'ancienne route active
        if (
          selectedMobileAirRoute &&
          selectedMobileAirRoute.sensorId !== mostRecentRoute.sensorId
        ) {
          setSelectedMobileAirRoute(null);
        }
      }
    }
  }, [
    devices,
    isEnabled,
    forceNewChoice,
    activeMobileAirRoute,
    selectedMobileAirRoute,
  ]);

  // Effet pour ouvrir automatiquement le side panel de détail quand les routes sont chargées
  useEffect(() => {
    // Ouvrir le panel de détail si :
    // 1. MobileAir est activé
    // 2. Il y a des routes
    // 3. Il y a une route active
    // 4. Le panel n'est pas déjà ouvert OU de nouvelles routes viennent d'être chargées (pour forcer la réouverture)
    // 5. L'utilisateur n'a pas fermé manuellement le panel (sauf si de nouvelles routes viennent d'être chargées)
    const shouldOpen =
      isEnabled &&
      mobileAirRoutes.length > 0 &&
      activeMobileAirRoute &&
      (!isMobileAirDetailPanelOpen || routesJustLoaded) &&
      (!userClosedDetailPanel || routesJustLoaded);

    if (shouldOpen) {
      const timer = setTimeout(() => {
        setIsMobileAirDetailPanelOpen(true);
        setMobileAirDetailPanelSize("normal");
        // Réinitialiser le flag après l'ouverture
        setRoutesJustLoaded(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [
    isEnabled,
    mobileAirRoutes.length,
    activeMobileAirRoute,
    isMobileAirDetailPanelOpen,
    userClosedDetailPanel,
    routesJustLoaded,
  ]);

  // Effet pour centrer la carte sur la route active
  useEffect(() => {
    if (
      activeMobileAirRoute &&
      activeMobileAirRoute.points.length > 0 &&
      mapRef.current
    ) {
      const bounds = activeMobileAirRoute.points.map(
        (point) => [point.lat, point.lon] as [number, number]
      );
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [activeMobileAirRoute, mapRef]);

  // Effet pour réinitialiser les états de fermeture manuelle quand l'activation change
  useEffect(() => {
    if (!isEnabled) {
      // Nettoyer IMMÉDIATEMENT les routes pour éviter les conflits
      setActiveMobileAirRoute(null);
      setSelectedMobileAirRoute(null);
      setHoveredMobileAirPoint(null);
      setHighlightedMobileAirPoint(null);
      setMobileAirRoutes([]);
      setUserClosedDetailPanel(false);
      setIsMobileAirDetailPanelOpen(false);
      prevMobileAirRoutesLengthRef.current = 0;
    } else {
      // Réinitialiser les états pour permettre à l'utilisateur de choisir à nouveau
      setActiveMobileAirRoute(null);
      setSelectedMobileAirRoute(null);
      setHoveredMobileAirPoint(null);
      setHighlightedMobileAirPoint(null);
      setUserClosedDetailPanel(false);
      setIsMobileAirDetailPanelOpen(false);
      setMobileAirRoutes([]);
      setForceNewChoice(true);
      prevMobileAirRoutesLengthRef.current = 0;
    }
  }, [isEnabled]);

  // Handlers
  const handleMobileAirSensorsSelected = (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => {
    // Nettoyer les routes existantes pour permettre le rechargement avec remplacement
    try {
      const mobileAirService = DataServiceFactory.getService(
        "mobileair"
      ) as MobileAirService;
      mobileAirService.clearRoutes();
    } catch (error) {
      console.error("Erreur lors du nettoyage des routes MobileAir:", error);
    }

    // Nettoyer les routes et la route active dans le composant
    setMobileAirRoutes([]);
    setActiveMobileAirRoute(null);
    setSelectedMobileAirRoute(null);
    
    // Réinitialiser la référence pour détecter le prochain chargement de routes
    prevMobileAirRoutesLengthRef.current = 0;

    // Réinitialiser les flags pour permettre l'ouverture automatique du panneau
    // de détail lors du chargement des nouvelles données
    setUserClosedDetailPanel(false);
    setRoutesJustLoaded(false);

    // Désactiver le flag de forçage de nouveau choix quand l'utilisateur fait un choix
    setForceNewChoice(false);

    if (onMobileAirSensorSelected) {
      onMobileAirSensorSelected(sensorId, period);
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

  const openMobileAirDetailPanelForRoute = (
    route: MobileAirRoute,
    options?: { highlightedPoint?: MobileAirDataPoint | null }
  ) => {
    setActiveMobileAirRoute(route);
    setSelectedMobileAirRoute(route);
    setHighlightedMobileAirPoint(options?.highlightedPoint ?? null);
    setUserClosedDetailPanel(false);
    setMobileAirDetailPanelSize("normal");
    setIsMobileAirDetailPanelOpen(true);
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

      // Centrer la carte sur le point mis en surbrillance sans changer le zoom
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

    // Centrer la carte sur la route sélectionnée
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

  return {
    // États
    mobileAirRoutes,
    isMobileAirDetailPanelOpen,
    mobileAirDetailPanelSize,
    selectedMobileAirRoute,
    hoveredMobileAirPoint,
    highlightedMobileAirPoint,
    activeMobileAirRoute,

    // Handlers
    handleMobileAirSensorsSelected,
    handleCloseMobileAirDetailPanel,
    handleMobileAirDetailPanelSizeChange,
    openMobileAirDetailPanelForRoute,
    handleMobileAirPointClick,
    handleMobileAirPointHover,
    handleMobileAirPointHighlight,
    handleMobileAirRouteClick,
    handleOpenMobileAirDetailPanel,
  };
};
