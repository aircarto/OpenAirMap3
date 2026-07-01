import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "geoportal-extensions-leaflet";
import "leaflet-velocity";
import "leaflet-velocity/dist/leaflet-velocity.css";

// Déclaration de type pour l'extension Geoportal
declare module "leaflet" {
  namespace L {
    namespace geoportalControl {
      function SearchEngine(options?: any): any;
    }
  }
}
import {
  MeasurementDevice,
  SignalAirReport,
  StationInfo,
  WildfireReport,
  BoatTrack,
  PlaneTrack,
} from "../../types";
import { BaseLayerKey, ModelingLayerType } from "../../constants/mapLayers";
import { MAX_COMPARISON_STATIONS } from "../../constants/comparison";
import BaseLayerControl from "../controls/BaseLayerControl";
import CustomSearchControl from "../controls/CustomSearchControl";
import ScaleControl from "../controls/ScaleControl";
import NorthArrow from "../controls/NorthArrow";
import Legend from "./Legend";
import MobileAirRoutes from "./MobileAirRoutes";
import BoatTracks from "./BoatTracks";
import PlaneTracks from "./PlaneTracks";
import PlaneRouteLine from "./PlaneRouteLine";
import ZoneOverlays from "./ZoneOverlays";
import SignalementMarkers, {
  SignalementRightClickHandler,
} from "./SignalementMarkers";
import CustomSpiderfiedMarkers from "./CustomSpiderfiedMarkers";
import CustomSpiderfiedSignalAirMarkers from "./CustomSpiderfiedSignalAirMarkers";
import MarkerWithTooltip from "./MarkerWithTooltip";
import DeviceStatistics from "./DeviceStatistics";
import MapFloatingActions from "./MapFloatingActions";
import MapPanelsContainer from "./MapPanelsContainer";
import MapDataMarkers from "./MapDataMarkers";
import MapOverlays from "./MapOverlays";
import { AtmoRefService } from "../../services/AtmoRefService";
import { AtmoMicroService } from "../../services/AtmoMicroService";
import { NebuleAirService } from "../../services/NebuleAirService";
import { DataServiceFactory } from "../../services/DataServiceFactory";
// Hooks personnalisés
import { useMapView } from "./hooks/useMapView";
import { useMapLayers } from "./hooks/useMapLayers";
import { useWildfireLayer } from "./hooks/useWildfireLayer";
import { useBoatLayer } from "./hooks/useBoatLayer";
import { usePlaneLayer } from "./hooks/usePlaneLayer";
import { useZonesLayer } from "./hooks/useZonesLayer";
import { useSignalements } from "./hooks/useSignalements";
import { useMapAttribution } from "./hooks/useMapAttribution";
import { useSidePanels } from "./hooks/useSidePanels";
import { useSignalAir } from "./hooks/useSignalAir";
import { useMobileAir } from "./hooks/useMobileAir";
import { useMarkerTooltip } from "./hooks/useMarkerTooltip";
import { useVisibleDevices } from "./hooks/useVisibleDevices";

// Utilitaires
import {
  createCustomIcon,
  createSignalIcon,
  createWildfireIcon,
  formatWildfireDate,
  getMarkerKey,
  isDeviceSelected,
  sortDevicesByPriority,
  calculateZIndexOffset,
} from "./utils/mapIconUtils";
import { getOptimalZoomLevel } from "./utils/mapMarkerUtils";
import {
  createLoadComparisonDataHandler,
  createRemoveStationFromComparisonHandler,
} from "./handlers/comparisonHandlers";
import { trackEvent, trackFeatureUsage } from "../../services/analyticsService";

// Correction pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface AirQualityMapProps {
  devices: MeasurementDevice[];
  reports: SignalAirReport[];
  center: [number, number];
  zoom: number;
  selectedPollutant: string;
  selectedSources: string[];
  selectedTimeStep: string;
  currentModelingLayer: ModelingLayerType | null;
  loading?: boolean;
  signalAirPeriod: { startDate: string; endDate: string };
  signalAirSelectedTypes: string[];
  onSignalAirPeriodChange: (startDate: string, endDate: string) => void;
  onSignalAirTypesChange: (types: string[]) => void;
  onSignalAirLoadRequest: () => void;
  isSignalAirLoading?: boolean;
  signalAirHasLoaded?: boolean;
  signalAirReportsCount?: number;
  /** Mode historique avec des signalements chargés (0 dans fenêtre courante ≠ aucune donnée) */
  isHistoricalModeWithSignalAirData?: boolean;
  onSignalAirSourceDeselected?: () => void;
  onMobileAirSensorSelected?: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  onMobileAirSourceDeselected?: () => void;
  isHistoricalModeActive?: boolean;
  // Nouveaux props pour gérer SignalAir et MobileAir indépendamment
  isSignalAirEnabled?: boolean;
  isMobileAirEnabled?: boolean;
  isSignalAirVisible?: boolean;
  isMobileAirVisible?: boolean;
  onSignalAirToggle?: (visible: boolean) => void;
  onMobileAirToggle?: (visible: boolean) => void;
  onSignalAirPanelOpen?: () => void;
  onMobileAirPanelOpen?: () => void;
  /** Incrémenter pour demander l'ouverture du panel SignalAir (depuis le header) */
  openSignalAirPanelRequest?: number;
  /** Incrémenter pour demander l'ouverture du panel MobileAir (depuis le header) */
  openMobileAirPanelRequest?: number;
  /** Date actuellement affichée en mode historique (pour la période dans DeviceStatistics) */
  historicalCurrentDate?: string;
}

const defaultSpiderfyConfig = {
  enabled: true, // active/desactive le spiderfier par defaut
  autoSpiderfy: true, // activation automatique du spiderfier au zoom
  autoSpiderfyZoomThreshold: 12, // seuil de zoom pour activer/désactiver le spiderfier
};

// Composant interne pour gérer les événements de la carte
const MapClickHandler: React.FC<{ onMapClick: () => void }> = ({
  onMapClick,
}) => {
  useMapEvents({
    click: (e) => {
      // Ne masquer le tooltip que si on clique directement sur la carte (pas sur un marqueur)
      // Les clics sur les marqueurs ont leur propre handler qui masque le tooltip
      const target = e.originalEvent?.target as HTMLElement;
      // Si le clic est sur un marqueur ou un élément de marqueur, ne pas masquer le tooltip ici
      // (il sera masqué par le handler du marqueur)
      if (
        target &&
        (target.closest(".leaflet-marker-icon") ||
          target.closest(".leaflet-marker-pane"))
      ) {
        return;
      }
      onMapClick();
    },
  });
  return null;
};

const AirQualityMap: React.FC<AirQualityMapProps> = ({
  devices,
  reports,
  center,
  zoom,
  selectedPollutant,
  selectedSources,
  selectedTimeStep,
  currentModelingLayer,
  loading,
  signalAirPeriod,
  signalAirSelectedTypes,
  onSignalAirPeriodChange,
  onSignalAirTypesChange,
  onSignalAirLoadRequest,
  isSignalAirLoading = false,
  signalAirHasLoaded = false,
  signalAirReportsCount = 0,
  isHistoricalModeWithSignalAirData = false,
  onSignalAirSourceDeselected,
  onMobileAirSensorSelected,
  onMobileAirSourceDeselected,
  isHistoricalModeActive = false,
  isSignalAirEnabled = false,
  isMobileAirEnabled = false,
  isSignalAirVisible = true,
  isMobileAirVisible = true,
  onSignalAirToggle,
  onMobileAirToggle,
  onSignalAirPanelOpen,
  onMobileAirPanelOpen,
  openSignalAirPanelRequest = 0,
  openMobileAirPanelRequest = 0,
  historicalCurrentDate,
}) => {
  const { t } = useTranslation();
  // Configuration du spiderfier
  const [spiderfyConfig, setSpiderfyConfig] = useState(defaultSpiderfyConfig);
  const [currentBaseLayer, setCurrentBaseLayer] =
    useState<BaseLayerKey>("Carte standard");
  const [isCommunalLayerEnabled, setIsCommunalLayerEnabled] = useState(false);

  // Position du pinpoint affiché après une recherche de localisation (null = masqué)
  const [searchPinPosition, setSearchPinPosition] = useState<
    [number, number] | null
  >(null);

  // État pour les données PurpleAir (stockées par ID de station)
  const [purpleAirDeviceData, setPurpleAirDeviceData] = useState<
    Record<
      string,
      {
        rssi: number;
        uptime: number;
        confidence: number;
        temperature: number;
        humidity: number;
        pm1Value: number;
        pm25Value: number;
        pm10Value: number;
      }
    >
  >({});

  // Hooks personnalisés
  const mapView = useMapView({
    center,
    zoom,
    spiderfyConfig,
  });

  const mapLayers = useMapLayers({
    mapRef: mapView.mapRef,
    currentBaseLayer,
    selectedTimeStep,
    selectedPollutant,
    currentModelingLayer,
    isCommunalLayerEnabled,
  });

  const wildfire = useWildfireLayer();

  const boats = useBoatLayer(selectedTimeStep);

  const planes = usePlaneLayer(selectedTimeStep);

  const zones = useZonesLayer();

  const signalements = useSignalements();

  // Mode ajout de signalement : curseur en croix sur la carte pour signaler
  // qu'un clic va poser un point.
  useEffect(() => {
    const el = mapView.mapRef.current?.getContainer();
    if (!el) return;
    el.classList.toggle("oam-placing", signalements.placingMode);
  }, [signalements.placingMode, mapView.mapRef]);

  const sidePanels = useSidePanels({
    initialSelectedPollutant: selectedPollutant,
  });

  const signalAir = useSignalAir({
    signalAirHasLoaded,
    signalAirReportsCount,
    isSignalAirLoading,
    reports,
    mapRef: mapView.mapRef,
    onSignalAirLoadRequest,
    isEnabled: isSignalAirEnabled,
    isHistoricalModeWithSignalAirData,
  });

  const mobileAir = useMobileAir({
    devices,
    mapRef: mapView.mapRef,
    onMobileAirSensorSelected,
    isEnabled: isMobileAirEnabled,
  });

  // Ouvrir les panels SignalAir / MobileAir quand le header demande (bouton "Sources spéciales")
  useEffect(() => {
    // Important: on ne traite qu'une nouvelle requête d'ouverture.
    // Sans ce garde-fou, un rerender peut rouvrir le panneau juste
    // après que l'utilisateur l'a fermé via la croix.
    if (
      openSignalAirPanelRequest > 0 &&
      openSignalAirPanelRequest !== lastHandledSignalAirOpenRequestRef.current
    ) {
      signalAir.handleOpenSignalAirPanel();
      lastHandledSignalAirOpenRequestRef.current = openSignalAirPanelRequest;
    }
    // Pourquoi cette dépendance ?
    // React "capture" les valeurs au moment du render. En listant le handler,
    // on garantit que l'effet utilisera toujours la version la plus récente.
  }, [openSignalAirPanelRequest, signalAir]);

  useEffect(() => {
    // Même logique pour MobileAir: ignorer les rerenders et ne réagir
    // qu'à un nouvel identifiant de requête d'ouverture.
    if (
      openMobileAirPanelRequest > 0 &&
      openMobileAirPanelRequest !== lastHandledMobileAirOpenRequestRef.current
    ) {
      mobileAir.handleOpenMobileAirSelectionPanel();
      lastHandledMobileAirOpenRequestRef.current = openMobileAirPanelRequest;
    }
    // Même principe ici : on évite un "stale closure" si le handler change.
  }, [openMobileAirPanelRequest, mobileAir]);

  // Hook pour gérer le tooltip au hover sur les marqueurs (désactivé - on utilise les tooltips Leaflet natifs maintenant)
  // const { tooltip, showTooltip, hideTooltip, isHidden } = useMarkerTooltip({
  //   minZoom: 11,
  //   mapRef: mapView.mapRef,
  // });

  // Hook pour filtrer les appareils visibles dans le viewport
  // OPTIMISATION : Récupère aussi les statistiques pré-calculées
  const { visibleDevices, visibleReports, statistics, sourceStatistics } =
    useVisibleDevices({
      mapRef: mapView.mapRef,
      devices,
      reports,
      debounceMs: 100,
    });

  // Trier les devices par priorité pour mettre en avant les valeurs hautes des sources fiables
  const sortedDevices = useMemo(() => {
    return sortDevicesByPriority(devices);
  }, [devices]);
  // Les métadonnées sont maintenant chargées directement dans MarkerWithTooltip
  // Plus besoin de charger les métadonnées ici

  const shouldShowStandardLegend =
    selectedSources.length > 0 || mapLayers.currentModelingWMTSLayer === null;

  const isComparisonPanelVisible =
    sidePanels.comparisonState.isComparisonMode &&
    sidePanels.comparisonState.comparedStations.length > 0;

  // Référence pour suivre l'état précédent du mode historique
  const prevHistoricalModeRef = useRef(isHistoricalModeActive);
  // Ces refs mémorisent la dernière requête d'ouverture déjà traitée.
  // Elles évitent les réouvertures involontaires des panels lors des rerenders.
  const lastHandledSignalAirOpenRequestRef = useRef(0);
  const lastHandledMobileAirOpenRequestRef = useRef(0);

  // Refs pour empêcher les clics multiples rapides
  const isProcessingClickRef = useRef(false);
  const lastClickedDeviceIdRef = useRef<string | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickStartTimeRef = useRef<number | null>(null);

  // Réinitialiser le flag après un délai maximum pour éviter qu'il reste bloqué
  useEffect(() => {
    const checkAndReset = setInterval(() => {
      if (isProcessingClickRef.current && clickStartTimeRef.current) {
        const elapsed = Date.now() - clickStartTimeRef.current;
        // Si le flag est bloqué depuis plus de 3 secondes, le réinitialiser
        if (elapsed > 3000) {
          console.warn(
            "⚠️ [Map] Flag de traitement bloqué depuis trop longtemps, réinitialisation forcée",
            {
              elapsed: `${elapsed}ms`,
              lastClicked: lastClickedDeviceIdRef.current,
            }
          );
          isProcessingClickRef.current = false;
          lastClickedDeviceIdRef.current = null;
          clickStartTimeRef.current = null;
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }
        }
      }
    }, 500); // Vérifier toutes les 500ms pour une réactivité plus rapide

    return () => clearInterval(checkAndReset);
  }, []);

  // Effet pour fermer tous les side panels quand le mode historique est activé
  useEffect(() => {
    // Ne fermer les panels que lors du passage de false à true
    if (isHistoricalModeActive && !prevHistoricalModeRef.current) {
      // Fermer complètement tous les side panels (pas juste rabattus)
      sidePanels.handleCloseSidePanel();

      // Fermer les panels SignalAir
      signalAir.handleCloseSignalAirPanel();
      signalAir.handleCloseSignalAirDetailPanel();

      // Fermer les panels MobileAir
      mobileAir.handleCloseMobileAirSelectionPanel();
      mobileAir.handleCloseMobileAirDetailPanel();

      // Fermer le panel bateau
      boats.handleCloseBoatPanel();

      // Fermer le panel avion
      planes.handleClosePlanePanel();

      // Fermer le panel zone
      zones.closePanel();

      // Annuler un éventuel brouillon de signalement
      signalements.cancelDraft();
    }

    // Mettre à jour la référence
    prevHistoricalModeRef.current = isHistoricalModeActive;
    // On inclut les objets utilisés dans l'effet pour rester synchronisé
    // avec leur état courant (règle exhaustive-deps).
  }, [isHistoricalModeActive, sidePanels, signalAir, mobileAir, boats, planes, zones, signalements]);

  // Gestion de l'attribution Leaflet
  useMapAttribution({
    shouldHide:
      (sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden") ||
      (isComparisonPanelVisible && sidePanels.panelSize !== "hidden") ||
      (mobileAir.isMobileAirSelectionPanelOpen &&
        mobileAir.mobileAirSelectionPanelSize !== "hidden") ||
      (mobileAir.isMobileAirDetailPanelOpen &&
        mobileAir.mobileAirDetailPanelSize !== "hidden") ||
      (signalAir.isSignalAirPanelOpen &&
        signalAir.signalAirPanelSize !== "hidden") ||
      (signalAir.isSignalAirDetailPanelOpen &&
        signalAir.signalAirDetailPanelSize !== "hidden") ||
      (Boolean(boats.selectedBoat) && boats.boatPanelSize !== "hidden") ||
      (Boolean(planes.selectedPlane) && planes.planePanelSize !== "hidden"),
  });

  // Effet pour redimensionner la carte quand les panneaux latéraux changent de taille
  useEffect(() => {
    // Pour un développeur non familier React :
    // on "fige" l'instance de carte au début de l'effet pour que les timeouts
    // et le cleanup manipulent toujours la même référence.
    const mapInstance = mapView.mapRef.current;
    if (!mapInstance) return;

    // Appel immédiat pour les changements rapides
    const immediateTimeout = setTimeout(() => {
      mapInstance.invalidateSize();
    }, 0);

    // Appel après la transition CSS (300ms + marge)
    const transitionTimeout = setTimeout(() => {
      mapInstance.invalidateSize();
    }, 350);

    // Appel supplémentaire pour s'assurer que tout est bien redimensionné
    const finalTimeout = setTimeout(() => {
      mapInstance.invalidateSize();
    }, 500);

    return () => {
      clearTimeout(immediateTimeout);
      clearTimeout(transitionTimeout);
      clearTimeout(finalTimeout);
    };
  }, [
    mapView.mapRef,
    sidePanels.panelSize,
    sidePanels.isSidePanelOpen,
    mobileAir.mobileAirSelectionPanelSize,
    mobileAir.mobileAirDetailPanelSize,
    mobileAir.isMobileAirSelectionPanelOpen,
    mobileAir.isMobileAirDetailPanelOpen,
    signalAir.signalAirPanelSize,
    signalAir.isSignalAirPanelOpen,
    signalAir.signalAirDetailPanelSize,
    signalAir.isSignalAirDetailPanelOpen,
    isComparisonPanelVisible,
    boats.selectedBoat,
    boats.boatPanelSize,
    planes.selectedPlane,
    planes.planePanelSize,
  ]);

  const handleBaseLayerChange = (layerKey: BaseLayerKey) => {
    setCurrentBaseLayer(layerKey);
  };

  // Handlers pour la comparaison
  const handleLoadComparisonData = createLoadComparisonDataHandler(
    sidePanels.setComparisonState
  );
  const removeStationFromComparisonBase = createRemoveStationFromComparisonHandler(
    sidePanels.comparisonState,
    sidePanels.setComparisonState,
    sidePanels.setIsSidePanelOpen,
    sidePanels.setSelectedStation
  );
  const handleRemoveStationFromComparison = useCallback(
    (stationId: string) => {
      const removedStation = sidePanels.comparisonState.comparedStations.find(
        (station) => station.id === stationId
      );
      removeStationFromComparisonBase(stationId);
      trackEvent(
        "comparison",
        "remove_station",
        removedStation?.source ?? "unknown"
      );
      trackFeatureUsage("comparison_station_removed", {
        source: removedStation?.source ?? "unknown",
        remainingStations: Math.max(
          sidePanels.comparisonState.comparedStations.length - 1,
          0
        ),
      });
    },
    [sidePanels.comparisonState.comparedStations, removeStationFromComparisonBase]
  );

  // Handler pour ajouter une station à la comparaison
  // useCallback rend la fonction stable entre renders.
  // Cela évite que les callbacks dépendants se recréent inutilement.
  const handleAddStationToComparison = useCallback(async (device: MeasurementDevice) => {
    // Vérifier que la station n'est pas déjà dans la liste
    const isAlreadyAdded = sidePanels.comparisonState.comparedStations.some(
      (station) => station.id === device.id
    );

    // Si la station est déjà ajoutée, la retirer (désélection)
    if (isAlreadyAdded) {
      handleRemoveStationFromComparison(device.id);
      return;
    }

    // Vérifier les limites (max N stations) seulement si on ajoute une nouvelle station
    if (sidePanels.comparisonState.comparedStations.length >= MAX_COMPARISON_STATIONS) {
      console.warn(`Maximum ${MAX_COMPARISON_STATIONS} stations autorisées en comparaison`);
      return;
    }

    try {
      let variables: Record<
        string,
        { label: string; code_iso: string; en_service: boolean }
      > = {};

      // Récupérer les informations détaillées selon la source
      let sensorModel: string | undefined;
      let lastSeenSec: number | undefined;

      if (device.source === "atmoRef") {
        const atmoRefService = DataServiceFactory.getService('atmoRef') as AtmoRefService;
        variables = await atmoRefService.fetchStationVariables(device.id);
      } else if (device.source === "atmoMicro") {
        const atmoMicroService = DataServiceFactory.getService('atmoMicro') as AtmoMicroService;
        const siteInfo = await atmoMicroService.fetchSiteVariables(device.id);
        variables = siteInfo.variables;
        sensorModel = siteInfo.sensorModel;
      } else if (device.source === "nebuleair") {
        const nebuleAirService = new NebuleAirService();
        const siteInfo = await nebuleAirService.fetchSiteInfo(device.id);
        variables = siteInfo.variables;
        lastSeenSec = siteInfo.lastSeenSec;
      }

      const stationInfo: StationInfo = {
        id: device.id,
        name: device.name,
        address: device.address || "",
        departmentId: device.departmentId || "",
        source: device.source,
        variables,
        sensorModel,
        ...(lastSeenSec !== undefined && { lastSeenSec }),
      };

      sidePanels.setComparisonState((prev) => ({
        ...prev,
        comparedStations: [...prev.comparedStations, stationInfo],
      }));
      trackEvent("comparison", "add_station", device.source);
      trackFeatureUsage("comparison_station_added", {
        source: device.source,
        stationCount: sidePanels.comparisonState.comparedStations.length + 1,
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'ajout de la station à la comparaison:",
        error
      );
    }
  }, [sidePanels, handleRemoveStationFromComparison]);

  // Wrapper pour createCustomIcon avec les états du composant
  // Wrappers pour les fonctions utilitaires avec les états du composant
  const createCustomIconWrapper = (device: MeasurementDevice) => {
    return createCustomIcon(device, {
      loading,
      comparisonState: sidePanels.comparisonState,
      selectedStation: sidePanels.selectedStation,
    });
  };

  const createSignalIconWrapper = (report: SignalAirReport) => {
    return createSignalIcon(report, loading);
  };

  const createWildfireIconWrapper = (report: WildfireReport) => {
    return createWildfireIcon(
      report,
      wildfire.wildfireLoading,
      wildfire.wildfireReports.length
    );
  };

  const getMarkerKeyWrapper = (device: MeasurementDevice) => {
    return getMarkerKey(
      device,
      sidePanels.comparisonState,
      sidePanels.selectedStation
    );
  };

  // Wrapper : en mode historique les signalements restent cliquables pour ouvrir le détail
  const handleSignalAirMarkerClickWrapper = (report: SignalAirReport) => {
    signalAir.handleSignalAirMarkerClick(report);
  };

  // Wrappers pour désactiver les clics MobileAir en mode historique
  const handleMobileAirPointClickWrapper = (route: any, point: any) => {
    if (isHistoricalModeActive) {
      return;
    }
    mobileAir.handleMobileAirPointClick(route, point);
  };

  const handleMobileAirRouteClickWrapper = (route: any) => {
    if (isHistoricalModeActive) {
      return;
    }
    mobileAir.handleMobileAirRouteClick(route);
  };

  const handleMarkerClick = useCallback(
    async (device: MeasurementDevice) => {
      // Empêcher uniquement les clics multiples rapides sur le même device
      // Permettre les clics sur d'autres devices même si un traitement est en cours
      if (
        isProcessingClickRef.current &&
        lastClickedDeviceIdRef.current === device.id
      ) {
        return;
      }

      // Si on clique sur un autre device, réinitialiser le flag immédiatement
      if (
        isProcessingClickRef.current &&
        lastClickedDeviceIdRef.current !== device.id
      ) {
        // Nettoyer le timeout précédent
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        isProcessingClickRef.current = false;
        lastClickedDeviceIdRef.current = null;
        clickStartTimeRef.current = null;
      }

      // Les tooltips sont maintenant gérés par Leaflet, pas besoin de les masquer manuellement

      // Désactiver les clics sur les marqueurs en mode historique
      if (isHistoricalModeActive) {
        return;
      }

      // Exclure SignalAir
      if (device.source === "signalair") {
        return;
      }

      // Un seul panneau à la fois : fermer bateau / avion / zone à l'ouverture
      // d'un panneau capteur.
      boats.handleCloseBoatPanel();
      planes.handleClosePlanePanel();
      zones.closePanel();

      // Marquer comme en cours de traitement
      isProcessingClickRef.current = true;
      lastClickedDeviceIdRef.current = device.id;
      clickStartTimeRef.current = Date.now();

      try {
        // Gérer PurpleAir avec side panel
        if (device.source === "purpleair") {
          const purpleAirDevice = device as any;

          // Extraire les données PurpleAir
          const deviceData = {
            rssi: purpleAirDevice.rssi,
            uptime: purpleAirDevice.uptime,
            confidence: purpleAirDevice.confidence,
            temperature: purpleAirDevice.temperature,
            humidity: purpleAirDevice.humidity,
            pm1Value: purpleAirDevice.pm1Value,
            pm25Value: purpleAirDevice.pm25Value,
            pm10Value: purpleAirDevice.pm10Value,
          };

          // Stocker les données PurpleAir
          setPurpleAirDeviceData((prev) => ({
            ...prev,
            [device.id]: deviceData,
          }));

          const stationInfo: StationInfo = {
            id: device.id,
            name: device.name,
            address: device.address || "",
            departmentId: device.departmentId || "",
            source: device.source,
            variables: {}, // PurpleAir ne fournit pas de variables contrôlables
          };

          sidePanels.setSelectedStation(stationInfo);
          sidePanels.setIsSidePanelOpen(true);

          // Si le panneau est caché, le rouvrir automatiquement
          if (sidePanels.panelSize === "hidden") {
            sidePanels.setPanelSize("normal");
          }
          return;
        }

        // Gérer Sensor Community avec side panel
        if (device.source === "sensorCommunity") {
          // Extraire l'ID du capteur depuis l'ID du device (format: sensorId_locationId)
          // On stocke l'ID complet pour pouvoir l'afficher, mais le sensorId sera extrait dans le side panel
          const stationInfo: StationInfo = {
            id: device.id, // Format: sensorId_locationId ou sensorId directement
            name: device.name,
            address: device.address || "",
            departmentId: device.departmentId || "",
            source: device.source,
            variables: {}, // SensorCommunity ne fournit pas de variables contrôlables
          };

          sidePanels.setSelectedStation(stationInfo);
          sidePanels.setIsSidePanelOpen(true);

          // Si le panneau est caché, le rouvrir automatiquement
          if (sidePanels.panelSize === "hidden") {
            sidePanels.setPanelSize("normal");
          }
          return;
        }

        // En mode comparaison, gérer AtmoRef, AtmoMicro et NebuleAir
        if (sidePanels.comparisonState.isComparisonMode) {
          if (
            device.source === "atmoRef" ||
            device.source === "atmoMicro" ||
            device.source === "nebuleair"
          ) {
            await handleAddStationToComparison(device);
          }
          return;
        }

        // Supporter AtmoRef, AtmoMicro et NebuleAir en mode normal
        if (
          device.source !== "atmoRef" &&
          device.source !== "atmoMicro" &&
          device.source !== "nebuleair"
        ) {
          return;
        }

        // Initialiser les variables par défaut
        let variables: Record<
          string,
          { label: string; code_iso: string; en_service: boolean }
        > = {};
        let sensorModel: string | undefined;
        let lastSeenSec: number | undefined;

        try {
          // Récupérer les informations détaillées selon la source
          if (device.source === "atmoRef") {
            const atmoRefService = DataServiceFactory.getService('atmoRef') as AtmoRefService;
            variables = await atmoRefService.fetchStationVariables(device.id);
          } else if (device.source === "atmoMicro") {
            const atmoMicroService = DataServiceFactory.getService('atmoMicro') as AtmoMicroService;
            const siteInfo = await atmoMicroService.fetchSiteVariables(
              device.id
            );
            variables = siteInfo.variables;
            sensorModel = siteInfo.sensorModel;
          } else if (device.source === "nebuleair") {
            const nebuleAirService = DataServiceFactory.getService('nebuleair') as NebuleAirService;
            const siteInfo = await nebuleAirService.fetchSiteInfo(device.id);
            variables = siteInfo.variables;
            lastSeenSec = siteInfo.lastSeenSec;
          }
        } catch (error) {
          console.error(
            `❌ [Map] Erreur lors de la récupération des informations de la station ${device.id}:`,
            error
          );
          // Continuer avec des variables vides - le sidepanel s'ouvrira quand même
        }

        // Toujours ouvrir le sidepanel, même en cas d'erreur
        const stationInfo: StationInfo = {
          id: device.id,
          name: device.name,
          address: device.address || "",
          departmentId: device.departmentId || "",
          source: device.source,
          variables,
          sensorModel,
          ...(lastSeenSec !== undefined && { lastSeenSec }),
        };

        sidePanels.setSelectedStation(stationInfo);
        sidePanels.setIsSidePanelOpen(true);

        // Si le panneau est caché, le rouvrir automatiquement
        if (sidePanels.panelSize === "hidden") {
          sidePanels.setPanelSize("normal");
        }
      } catch (error) {
        console.error(
          `❌ [Map] Erreur lors du traitement du clic pour ${device.id}:`,
          error
        );
        // Même en cas d'erreur, réinitialiser le flag pour permettre de nouveaux clics
      } finally {
        // Nettoyer le timeout précédent s'il existe
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
        }

        // Réinitialiser le flag après un court délai pour permettre les clics sur d'autres devices
        clickTimeoutRef.current = setTimeout(() => {
          isProcessingClickRef.current = false;
          // Ne réinitialiser lastClickedDeviceIdRef que si c'est toujours le même device
          if (lastClickedDeviceIdRef.current === device.id) {
            lastClickedDeviceIdRef.current = null;
          }
          clickStartTimeRef.current = null;
          clickTimeoutRef.current = null;
        }, 300); // Délai réduit à 300ms pour une meilleure réactivité
      }
    },
    [isHistoricalModeActive, sidePanels, handleAddStationToComparison, boats, planes, zones]
  );

  // Sélection d'un bateau : traîne complète + side panel (désactivé en mode historique)
  const handleBoatSelect = useCallback(
    (track: BoatTrack) => {
      if (isHistoricalModeActive) {
        return;
      }
      // Un seul panneau à la fois : fermer capteur / avion / zone
      sidePanels.handleCloseSidePanel();
      planes.handleClosePlanePanel();
      zones.closePanel();
      boats.handleSelectBoat(track);
      trackFeatureUsage("boat_selected", {
        shipType: track.shipType ?? "unknown",
      });
    },
    [isHistoricalModeActive, boats, planes, zones, sidePanels]
  );

  // Centrage de la carte sur un bateau depuis son side panel
  const handleCenterOnBoat = useCallback(
    (track: BoatTrack) => {
      const mapInstance = mapView.mapRef.current;
      if (!mapInstance) return;
      mapInstance.setView(
        [track.lastPoint.lat, track.lastPoint.lon],
        Math.max(mapInstance.getZoom(), 13),
        { animate: true, duration: 1 }
      );
    },
    [mapView.mapRef]
  );

  // Sélection / centrage d'un avion (mêmes principes que les bateaux)
  const handlePlaneSelect = useCallback(
    (track: PlaneTrack) => {
      if (isHistoricalModeActive) return;
      // Un seul panneau à la fois : fermer capteur / bateau / zone
      sidePanels.handleCloseSidePanel();
      boats.handleCloseBoatPanel();
      zones.closePanel();
      planes.handleSelectPlane(track);
      trackFeatureUsage("plane_selected", { type: track.type ?? "unknown" });
    },
    [isHistoricalModeActive, planes, boats, zones, sidePanels]
  );

  const handleCenterOnPlane = useCallback(
    (track: PlaneTrack) => {
      const mapInstance = mapView.mapRef.current;
      if (!mapInstance) return;
      mapInstance.setView(
        [track.lastPoint.lat, track.lastPoint.lon],
        Math.max(mapInstance.getZoom(), 11),
        { animate: true, duration: 1 }
      );
    },
    [mapView.mapRef]
  );

  // Sélection d'une zone (clic) : ouvre le side panel (sauf mode historique)
  const handleZoneSelect = useCallback(
    (selection: { props: unknown; lat: number; lon: number }) => {
      if (isHistoricalModeActive) return;
      // Un seul panneau à la fois : fermer capteur / bateau / avion
      sidePanels.handleCloseSidePanel();
      boats.handleCloseBoatPanel();
      planes.handleClosePlanePanel();
      zones.selectZone(selection as never);
    },
    [isHistoricalModeActive, zones, boats, planes, sidePanels]
  );

  // Centrage de la carte sur une zone depuis son side panel
  const handleCenterOnZone = useCallback(
    (selection: { lat: number; lon: number }) => {
      const mapInstance = mapView.mapRef.current;
      if (!mapInstance) return;
      mapInstance.setView(
        [selection.lat, selection.lon],
        Math.max(mapInstance.getZoom(), 12),
        { animate: true, duration: 1 }
      );
    },
    [mapView.mapRef]
  );

  // Callback pour la sélection d'un capteur depuis la recherche
  const handleSensorSelected = useCallback(
    (device: MeasurementDevice) => {
      // Centrer la carte sur le capteur
      if (mapView.mapRef.current) {
        mapView.mapRef.current.setView(
          [device.latitude, device.longitude],
          16,
          {
            animate: true,
            duration: 1.5,
          }
        );
      }

      // Sélectionner le capteur et ouvrir le sidepanel
      handleMarkerClick(device);
    },
    // mapView.mapRef est utilisé dans le callback: on le déclare explicitement.
    [handleMarkerClick, mapView.mapRef]
  );

  // Les handlers SignalAir et MobileAir sont maintenant dans leurs hooks respectifs
  // Utiliser signalAir.* et mobileAir.* pour accéder aux handlers

  return (
    <div className="w-full h-full flex items-stretch relative">
      <MapPanelsContainer
        sidePanels={sidePanels}
        signalAir={signalAir}
        mobileAir={mobileAir}
        boats={boats}
        planes={planes}
        zones={zones}
        onCenterOnBoat={handleCenterOnBoat}
        onCenterOnPlane={handleCenterOnPlane}
        onCenterOnZone={handleCenterOnZone}
        selectedPollutant={selectedPollutant}
        signalAirSelectedTypes={signalAirSelectedTypes}
        signalAirPeriod={signalAirPeriod}
        onSignalAirTypesChange={onSignalAirTypesChange}
        onSignalAirPeriodChange={onSignalAirPeriodChange}
        isSignalAirLoading={isSignalAirLoading}
        signalAirHasLoaded={signalAirHasLoaded}
        signalAirReportsCount={signalAirReportsCount}
        isComparisonPanelVisible={isComparisonPanelVisible}
        handleRemoveStationFromComparison={handleRemoveStationFromComparison}
        handleLoadComparisonData={handleLoadComparisonData}
        purpleAirDeviceData={purpleAirDeviceData}
      />

      {/* Conteneur de la carte */}
      <div
        className="flex-1 relative"
        role="region"
        aria-label={t("app.mapAriaLabel")}
      >
        {/* Contrôle de recherche personnalisé */}
        <CustomSearchControl
          devices={devices}
          mapRef={mapView.mapRef}
          onSensorSelected={handleSensorSelected}
          onSearchLocationValidated={(lat, lng) =>
            setSearchPinPosition([lat, lng])
          }
        />

        <MapContainer
          center={center}
          zoom={zoom}
          style={{
            height: "100%",
            width: "100%",
            minHeight: "100%",
          }}
          ref={mapView.mapRef}
          zoomControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          touchZoom={true}
          minZoom={1}
          maxZoom={18}
        >
          {/* Gestionnaire d'événements pour les clics sur la carte */}
          <MapClickHandler
            onMapClick={() => setSearchPinPosition(null)}
          />
          {/* Fond de carte initial */}
          <TileLayer
            attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            minZoom={0}
            maxZoom={20}
          />

          {/* Contrôle d'échelle */}
          <ScaleControl
            isSidePanelOpen={sidePanels.isSidePanelOpen}
            panelSize={sidePanels.panelSize}
          />

          {/* Flèche du nord */}
          <NorthArrow
            isSidePanelOpen={sidePanels.isSidePanelOpen}
            panelSize={sidePanels.panelSize}
          />

          {/* Pinpoint de recherche (disparaît au clic sur la carte) */}
          {searchPinPosition && (
            <Marker
              position={searchPinPosition}
              zIndexOffset={2000}
              eventHandlers={{
                click: () => setSearchPinPosition(null),
              }}
            />
          )}

          <MapDataMarkers
            sortedDevices={sortedDevices}
            spiderfyConfig={spiderfyConfig}
            createCustomIconWrapper={createCustomIconWrapper}
            handleMarkerClick={handleMarkerClick}
            getMarkerKeyWrapper={getMarkerKeyWrapper}
            mapRef={mapView.mapRef}
            calculateZIndexOffset={calculateZIndexOffset}
            isMobileAirVisible={isMobileAirVisible}
            mobileAir={mobileAir}
            selectedPollutant={selectedPollutant}
            handleMobileAirPointClickWrapper={handleMobileAirPointClickWrapper}
            handleMobileAirRouteClickWrapper={handleMobileAirRouteClickWrapper}
            isSignalAirVisible={isSignalAirVisible}
            reports={reports}
            createSignalIconWrapper={createSignalIconWrapper}
            handleSignalAirMarkerClickWrapper={handleSignalAirMarkerClickWrapper}
          />

          {/* Marqueurs pour les incendies en cours */}
          {wildfire.isWildfireLayerEnabled &&
            wildfire.wildfireReports.map((incident) => (
              <Marker
                key={`wildfire-${incident.id}`}
                position={[incident.latitude, incident.longitude]}
                icon={createWildfireIconWrapper(incident)}
              >
                <Popup>
                  <div className="device-popup min-w-[280px]">
                    <h3 className="font-bold text-lg mb-2">{incident.title}</h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Commune:</strong> {incident.commune}
                      </p>
                      <p>
                        <strong>Type:</strong> {incident.type || "Non spécifié"}
                      </p>
                      <p>
                        <strong>Statut:</strong> {incident.status || "Inconnu"}
                      </p>
                      {incident.fireState && (
                        <p>
                          <strong>État du feu:</strong> {incident.fireState}
                        </p>
                      )}
                      <p>
                        <strong>Déclaré:</strong> {formatWildfireDate(incident)}
                      </p>
                      {incident.description && (
                        <p className="whitespace-pre-line">
                          <strong>Description:</strong> {incident.description}
                        </p>
                      )}
                      <p>
                        <a
                          href={incident.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          Voir le signalement complet
                        </a>
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Zones : contours aéroports / ports / Seveso (GeoJSON pré-générés).
              Clic sur une zone -> side panel de détails (photo + infos). */}
          <ZoneOverlays
            visible={zones.visible}
            data={zones.data}
            onSelect={handleZoneSelect}
          />

          {/* Signalements GPS : clic droit pour créer, marqueurs + fil de discussion */}
          {signalements.enabled && (
            <>
              <SignalementRightClickHandler
                onPlace={(lat, lon) => {
                  if (!isHistoricalModeActive) signalements.startDraft(lat, lon);
                }}
                placingMode={signalements.placingMode}
                disabled={isHistoricalModeActive}
              />
              <SignalementMarkers
                signalements={signalements.signalements}
                draft={signalements.draft}
                onReply={signalements.addReply}
                onCreate={signalements.createSignalement}
                onCancelDraft={signalements.cancelDraft}
              />
            </>
          )}

          {/* Suivi des bateaux (AIS) : marqueurs orientés + traîne des trajectoires.
              Traîne courte et discrète par défaut ; clic = sélection, traîne
              complète mise en avant + side panel de détails. */}
          {boats.isBoatLayerEnabled &&
            boats.isBoatLayerVisible &&
            selectedTimeStep === "instantane" && (
              <BoatTracks
                tracks={boats.boatTracks}
                selectedBoatId={boats.selectedBoatId}
                onBoatSelect={handleBoatSelect}
                previewMaxAgeMs={boats.previewMaxAgeMs}
              />
            )}

          {/* Suivi des avions (ADS-B) : sillage + silhouette orientée au cap.
              Affichés uniquement en mode Scan (comme les bateaux). */}
          {planes.isPlaneLayerEnabled &&
            planes.isPlaneLayerVisible &&
            selectedTimeStep === "instantane" && (
            <>
              <PlaneTracks
                tracks={planes.planeTracks}
                selectedPlaneId={planes.selectedPlaneId}
                onPlaneSelect={handlePlaneSelect}
                previewMaxAgeMs={planes.previewMaxAgeMs}
              />
              {/* Route de l'avion sélectionné : origine ✈ destination */}
              <PlaneRouteLine plane={planes.selectedPlane} />
            </>
          )}

        </MapContainer>

        <MapOverlays
          signalAir={signalAir}
          signalements={signalements}
          t={t}
          sidePanels={sidePanels}
          currentBaseLayer={currentBaseLayer}
          setCurrentBaseLayer={setCurrentBaseLayer}
          isCommunalLayerEnabled={isCommunalLayerEnabled}
          setIsCommunalLayerEnabled={setIsCommunalLayerEnabled}
          shouldShowStandardLegend={shouldShowStandardLegend}
          selectedPollutant={selectedPollutant}
          isComparisonPanelVisible={isComparisonPanelVisible}
          mapLayers={mapLayers}
          wildfire={wildfire}
          boats={boats}
          planes={planes}
          zones={zones}
          isScanMode={selectedTimeStep === "instantane"}
          visibleDevices={visibleDevices}
          visibleReports={visibleReports}
          totalDevices={devices.length}
          totalReports={reports.length}
          selectedSources={selectedSources}
          selectedTimeStep={selectedTimeStep}
          historicalCurrentDate={historicalCurrentDate}
          statistics={statistics}
          sourceStatistics={sourceStatistics}
        />
      </div>

      <MapFloatingActions
        sidePanels={sidePanels}
        signalAir={signalAir}
        mobileAir={mobileAir}
        isComparisonPanelVisible={isComparisonPanelVisible}
        selectedSources={selectedSources}
        t={t}
      />
    </div>
  );
};

export default AirQualityMap;
