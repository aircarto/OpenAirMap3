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
} from "../../types";
import { BaseLayerKey, ModelingLayerType } from "../../constants/mapLayers";
import { MAX_COMPARISON_STATIONS } from "../../constants/comparison";
import BaseLayerControl from "../controls/BaseLayerControl";
import ClusterControl from "../controls/ClusterControl";
import CustomSearchControl from "../controls/CustomSearchControl";
import ScaleControl from "../controls/ScaleControl";
import NorthArrow from "../controls/NorthArrow";
import Legend from "./Legend";
import StationSidePanel from "../panels/StationSidePanel";
import MicroSidePanel from "../panels/MicroSidePanel";
import NebuleAirSidePanel from "../panels/NebuleAirSidePanel";
import SensorCommunitySidePanel from "../panels/SensorCommunitySidePanel";
import PurpleAirSidePanel from "../panels/PurpleAirSidePanel";
import ComparisonSidePanel from "../panels/ComparisonSidePanel";
import MobileAirSelectionPanel from "../panels/MobileAirSelectionPanel";
import MobileAirDetailPanel from "../panels/MobileAirDetailPanel";
import SignalAirSelectionPanel from "../panels/SignalAirSelectionPanel";
import SignalAirDetailPanel from "../panels/SignalAirDetailPanel";
import MobileAirRoutes from "./MobileAirRoutes";
import CustomSpiderfiedMarkers from "./CustomSpiderfiedMarkers";
import CustomSpiderfiedSignalAirMarkers from "./CustomSpiderfiedSignalAirMarkers";
import MarkerWithTooltip from "./MarkerWithTooltip";
import DeviceStatistics from "./DeviceStatistics";
import { AtmoRefService } from "../../services/AtmoRefService";
import { AtmoMicroService } from "../../services/AtmoMicroService";
import { NebuleAirService } from "../../services/NebuleAirService";
import { DataServiceFactory } from "../../services/DataServiceFactory";
import MarkerClusterGroup from "react-leaflet-cluster";
import { featureFlags } from "../../config/featureFlags";

// Hooks personnalisés
import { useMapView } from "./hooks/useMapView";
import { useMapLayers } from "./hooks/useMapLayers";
import { useWildfireLayer } from "./hooks/useWildfireLayer";
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
}

const defaultClusterConfig = {
  enabled: false, // active/desactive le clustering par defaut
  maxClusterRadius: 60, // rayon de clustering
  spiderfyOnMaxZoom: true, // éclatement des clusters au zoom maximum
  showCoverageOnHover: true, // affichage de la zone du cluster au survol
  zoomToBoundsOnClick: true, // zoom sur la zone du cluster au clic
  animate: true, // animations lors du clustering
  animateAddingMarkers: true, // animations lors de l'ajout de marqueurs
};

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
}) => {
  const { t } = useTranslation();
  // Configuration des clusters et spiderfier
  const [clusterConfig, setClusterConfig] = useState(defaultClusterConfig);
  const [spiderfyConfig, setSpiderfyConfig] = useState(defaultSpiderfyConfig);
  const [currentBaseLayer, setCurrentBaseLayer] =
    useState<BaseLayerKey>("Carte standard");
  const [isCommunalLayerEnabled, setIsCommunalLayerEnabled] = useState(false);

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
    if (openSignalAirPanelRequest > 0) {
      signalAir.handleOpenSignalAirPanel();
    }
  }, [openSignalAirPanelRequest]);

  useEffect(() => {
    if (openMobileAirPanelRequest > 0) {
      mobileAir.handleOpenMobileAirSelectionPanel();
    }
  }, [openMobileAirPanelRequest]);

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
    }

    // Mettre à jour la référence
    prevHistoricalModeRef.current = isHistoricalModeActive;
  }, [isHistoricalModeActive]);

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
        signalAir.signalAirDetailPanelSize !== "hidden"),
  });

  // Effet pour redimensionner la carte quand les panneaux latéraux changent de taille
  useEffect(() => {
    if (!mapView.mapRef.current) return;

    // Appel immédiat pour les changements rapides
    const immediateTimeout = setTimeout(() => {
      if (mapView.mapRef.current) {
        mapView.mapRef.current.invalidateSize();
      }
    }, 0);

    // Appel après la transition CSS (300ms + marge)
    const transitionTimeout = setTimeout(() => {
      if (mapView.mapRef.current) {
        mapView.mapRef.current.invalidateSize();
      }
    }, 350);

    // Appel supplémentaire pour s'assurer que tout est bien redimensionné
    const finalTimeout = setTimeout(() => {
      if (mapView.mapRef.current) {
        mapView.mapRef.current.invalidateSize();
      }
    }, 500);

    return () => {
      clearTimeout(immediateTimeout);
      clearTimeout(transitionTimeout);
      clearTimeout(finalTimeout);
    };
  }, [
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
  ]);

  const handleBaseLayerChange = (layerKey: BaseLayerKey) => {
    setCurrentBaseLayer(layerKey);
  };

  // Handlers pour la comparaison
  const handleLoadComparisonData = createLoadComparisonDataHandler(
    sidePanels.setComparisonState
  );
  const handleRemoveStationFromComparison =
    createRemoveStationFromComparisonHandler(
      sidePanels.comparisonState,
      sidePanels.setComparisonState,
      sidePanels.setIsSidePanelOpen,
      sidePanels.setSelectedStation
    );

  // Handler pour ajouter une station à la comparaison
  const handleAddStationToComparison = async (device: MeasurementDevice) => {
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
    } catch (error) {
      console.error(
        "Erreur lors de l'ajout de la station à la comparaison:",
        error
      );
    }
  };

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
    [isHistoricalModeActive, sidePanels, handleAddStationToComparison]
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
    [handleMarkerClick]
  );

  // Les handlers SignalAir et MobileAir sont maintenant dans leurs hooks respectifs
  // Utiliser signalAir.* et mobileAir.* pour accéder aux handlers

  return (
    <div className="w-full h-full flex items-stretch relative">
      {/* Side Panel - Comparaison */}
      {sidePanels.comparisonState.isComparisonMode &&
        sidePanels.comparisonState.comparedStations.length > 0 &&
        sidePanels.panelSize !== "hidden" && (
          <ComparisonSidePanel
            isOpen={true}
            comparisonState={sidePanels.comparisonState}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            onRemoveStation={handleRemoveStationFromComparison}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            onLoadComparisonData={handleLoadComparisonData}
          />
        )}

      {/* Side Panel - AtmoRef */}
      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "atmoRef" &&
        sidePanels.panelSize !== "hidden" && (
          <StationSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            isComparisonMode={sidePanels.comparisonState.isComparisonMode}
          />
        )}

      {/* Side Panel - AtmoMicro */}
      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "atmoMicro" &&
        sidePanels.panelSize !== "hidden" && (
          <MicroSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
            onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
            isComparisonMode={sidePanels.comparisonState.isComparisonMode}
          />
        )}

      {/* Side Panel - NebuleAir */}
      {(() => {
        const shouldShowNebuleAir =
          !sidePanels.comparisonState.isComparisonMode &&
          sidePanels.selectedStation?.source === "nebuleair" &&
          sidePanels.panelSize !== "hidden";

        return shouldShowNebuleAir;
      })() && (
        <NebuleAirSidePanel
          isOpen={sidePanels.isSidePanelOpen}
          selectedStation={sidePanels.selectedStation}
          onClose={sidePanels.handleCloseSidePanel}
          onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
          onSizeChange={sidePanels.handleSidePanelSizeChange}
          panelSize={sidePanels.panelSize}
          initialPollutant={selectedPollutant}
          onComparisonModeToggle={sidePanels.handleComparisonModeToggle}
          isComparisonMode={sidePanels.comparisonState.isComparisonMode}
        />
      )}

      {/* Side Panel - Sensor Community */}
      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "sensorCommunity" &&
        sidePanels.panelSize !== "hidden" && (
          <SensorCommunitySidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation}
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
          />
        )}

      {/* Side Panel - PurpleAir */}
      {!sidePanels.comparisonState.isComparisonMode &&
        sidePanels.selectedStation?.source === "purpleair" &&
        sidePanels.panelSize !== "hidden" && (
          <PurpleAirSidePanel
            isOpen={sidePanels.isSidePanelOpen}
            selectedStation={sidePanels.selectedStation}
            deviceData={
              sidePanels.selectedStation
                ? purpleAirDeviceData[sidePanels.selectedStation.id]
                : undefined
            }
            onClose={sidePanels.handleCloseSidePanel}
            onHidden={() => sidePanels.handleSidePanelSizeChange("hidden")}
            onSizeChange={sidePanels.handleSidePanelSizeChange}
            panelSize={sidePanels.panelSize}
            initialPollutant={selectedPollutant}
          />
        )}

      {/* Side Panel - SignalAir Detail */}
      <SignalAirDetailPanel
        isOpen={signalAir.isSignalAirDetailPanelOpen}
        report={signalAir.selectedSignalAirReport}
        onClose={signalAir.handleCloseSignalAirDetailPanel}
        onSizeChange={signalAir.handleSignalAirDetailPanelSizeChange}
        panelSize={signalAir.signalAirDetailPanelSize}
        onCenterMap={signalAir.handleCenterOnSignalAirReport}
      />

      {/* Side Panel - SignalAir Selection */}
      <SignalAirSelectionPanel
        isOpen={signalAir.isSignalAirPanelOpen}
        selectedPollutant={selectedPollutant}
        selectedTypes={signalAirSelectedTypes}
        period={signalAirPeriod}
        onClose={signalAir.handleCloseSignalAirPanel}
        onTypesChange={onSignalAirTypesChange}
        onPeriodChange={onSignalAirPeriodChange}
        onLoadReports={signalAir.handleSignalAirLoad}
        onSizeChange={signalAir.handleSignalAirPanelSizeChange}
        onHidden={signalAir.handleSignalAirPanelHidden}
        panelSize={signalAir.signalAirPanelSize}
        isLoading={isSignalAirLoading}
        hasLoaded={signalAirHasLoaded}
        reportsCount={signalAirReportsCount}
      />

      {/* Side Panel - MobileAir Selection (droite) */}
      <MobileAirSelectionPanel
        isOpen={mobileAir.isMobileAirSelectionPanelOpen}
        initialPollutant={selectedPollutant}
        onClose={mobileAir.handleCloseMobileAirSelectionPanel}
        onHidden={() =>
          mobileAir.handleMobileAirSelectionPanelSizeChange("hidden")
        }
        onSizeChange={mobileAir.handleMobileAirSelectionPanelSizeChange}
        panelSize={mobileAir.mobileAirSelectionPanelSize}
        onSensorSelected={mobileAir.handleMobileAirSensorsSelected}
      />

      {/* Side Panel - MobileAir Detail (gauche) */}
      <MobileAirDetailPanel
        isOpen={mobileAir.isMobileAirDetailPanelOpen}
        selectedRoute={mobileAir.selectedMobileAirRoute}
        activeRoute={mobileAir.activeMobileAirRoute}
        allRoutes={mobileAir.mobileAirRoutes}
        initialPollutant={selectedPollutant}
        highlightedPoint={mobileAir.highlightedMobileAirPoint}
        onClose={mobileAir.handleCloseMobileAirDetailPanel}
        onHidden={() =>
          mobileAir.handleMobileAirDetailPanelSizeChange("hidden")
        }
        onSizeChange={mobileAir.handleMobileAirDetailPanelSizeChange}
        panelSize={mobileAir.mobileAirDetailPanelSize}
        onPointHover={mobileAir.handleMobileAirPointHover}
        onPointHighlight={mobileAir.handleMobileAirPointHighlight}
        onRouteSelect={mobileAir.openMobileAirDetailPanelForRoute}
      />

      {/* Conteneur de la carte */}
      <div className="flex-1 relative">
        {/* Contrôle de recherche personnalisé */}
        <CustomSearchControl
          devices={devices}
          mapRef={mapView.mapRef}
          onSensorSelected={handleSensorSelected}
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
          <MapClickHandler onMapClick={() => {}} />
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

          {/* Marqueurs pour les appareils de mesure */}
          {clusterConfig.enabled ? (
            <MarkerClusterGroup
              maxClusterRadius={clusterConfig.maxClusterRadius}
              spiderfyOnMaxZoom={
                mapView.isSpiderfyActive || clusterConfig.spiderfyOnMaxZoom
              }
              showCoverageOnHover={clusterConfig.showCoverageOnHover}
              zoomToBoundsOnClick={clusterConfig.zoomToBoundsOnClick}
              animate={clusterConfig.animate}
              animateAddingMarkers={clusterConfig.animateAddingMarkers}
            >
              {sortedDevices
                .filter((device) => {
                  // Filtrer complètement les devices MobileAir (gérés par MobileAirRoutes)
                  if (device.source === "mobileair") {
                    return false;
                  }
                  return true;
                })
                .map((device) => (
                  <MarkerWithTooltip
                    key={getMarkerKeyWrapper(device)}
                    device={device}
                    position={[device.latitude, device.longitude]}
                    icon={createCustomIconWrapper(device)}
                    interactive={true}
                    bubblingMouseEvents={true}
                    minZoom={11}
                    mapRef={mapView.mapRef as React.RefObject<L.Map>}
                    zIndexOffset={calculateZIndexOffset(device)}
                    eventHandlers={{
                      click: (e: L.LeafletMouseEvent) => {
                        handleMarkerClick(device);
                      },
                    }}
                  />
                ))}
            </MarkerClusterGroup>
          ) : // Spiderfier automatique personnalisé - éclatement automatique des marqueurs qui se chevauchent
          spiderfyConfig.enabled ? (
            <CustomSpiderfiedMarkers
              devices={sortedDevices.filter((device) => {
                // Filtrer complètement les devices MobileAir (gérés par MobileAirRoutes)
                if (device.source === "mobileair") {
                  return false;
                }
                return true;
              })}
              createCustomIcon={createCustomIconWrapper}
              handleMarkerClick={handleMarkerClick}
              enabled={spiderfyConfig.enabled}
              nearbyDistance={10} // Distance en pixels pour considérer les marqueurs comme se chevauchant
              zoomThreshold={spiderfyConfig.autoSpiderfyZoomThreshold} // Seuil de zoom pour activer/désactiver le spiderfier
              getMarkerKey={getMarkerKeyWrapper}
              mapRef={mapView.mapRef}
            />
          ) : (
            sortedDevices
              .filter((device) => {
                // Filtrer complètement les devices MobileAir (gérés par MobileAirRoutes)
                if (device.source === "mobileair") {
                  return false;
                }
                return true;
              })
              .map((device) => (
                <MarkerWithTooltip
                  key={getMarkerKeyWrapper(device)}
                  device={device}
                  position={[device.latitude, device.longitude]}
                  icon={createCustomIconWrapper(device)}
                  interactive={true}
                  bubblingMouseEvents={true}
                  minZoom={11}
                  mapRef={mapView.mapRef as React.RefObject<L.Map>}
                  zIndexOffset={calculateZIndexOffset(device)}
                  eventHandlers={{
                    click: (e: L.LeafletMouseEvent) => {
                      handleMarkerClick(device);
                    },
                  }}
                />
              ))
          )}

          {/* Parcours MobileAir - Afficher seulement la route active si visible */}
          {isMobileAirVisible && (
            <MobileAirRoutes
              routes={
                mobileAir.activeMobileAirRoute
                  ? [mobileAir.activeMobileAirRoute]
                  : []
              }
              selectedPollutant={selectedPollutant}
              onPointClick={handleMobileAirPointClickWrapper}
              onPointHover={mobileAir.handleMobileAirPointHover}
              onRouteClick={handleMobileAirRouteClickWrapper}
              highlightedPoint={mobileAir.highlightedMobileAirPoint}
              hoveredPoint={mobileAir.hoveredMobileAirPoint}
            />
          )}

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

          {/* Marqueurs pour les signalements SignalAir avec spiderfier - Afficher seulement si visible */}
          {isSignalAirVisible && (
            <CustomSpiderfiedSignalAirMarkers
              reports={reports}
              createSignalIcon={createSignalIconWrapper}
              handleMarkerClick={handleSignalAirMarkerClickWrapper}
              enabled={spiderfyConfig.enabled}
              zoomThreshold={spiderfyConfig.autoSpiderfyZoomThreshold}
            />
          )}
        </MapContainer>

        {signalAir.signalAirFeedback && (
          <div className="absolute top-24 right-4 z-[1000] max-w-sm bg-white border border-blue-200 text-blue-800 text-sm px-3 py-2 rounded-lg shadow-lg">
            <div className="flex items-start space-x-2">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p>{signalAir.signalAirFeedback}</p>
              </div>
              <button
                type="button"
                onClick={signalAir.handleDismissSignalAirFeedback}
                className="text-blue-600 hover:text-blue-800"
                aria-label={t("panels.closeSignalAirMessage")}
              >
                <svg
                  className="w-4 h-4"
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
        )}

        {/* Contrôles de la carte */}
        <div
          className={`absolute bottom-20 left-4 z-[1000] flex flex-col space-y-2 transition-all duration-300 ${
            sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden"
              ? "hidden md:flex"
              : "flex"
          }`}
        >
          {/* Contrôle du clustering */}
          {featureFlags.displayClusteringToggle && (
            <ClusterControl
              config={clusterConfig}
              onConfigChange={setClusterConfig}
            />
          )}

          {/* Contrôle du fond de carte */}
          <BaseLayerControl
            currentBaseLayer={currentBaseLayer}
            onBaseLayerChange={setCurrentBaseLayer}
            isCommunalLayerEnabled={isCommunalLayerEnabled}
            onCommunalLayerToggle={setIsCommunalLayerEnabled}
          />
        </div>

        {/* Légende */}
        {shouldShowStandardLegend && (
          <Legend
            selectedPollutant={selectedPollutant}
            isSidePanelOpen={sidePanels.isSidePanelOpen}
            panelSize={sidePanels.panelSize}
            isComparisonPanelVisible={
              isComparisonPanelVisible && sidePanels.panelSize !== "hidden"
            }
          />
        )}

        {mapLayers.currentModelingLegendUrl && (
          <div
            className={`absolute hidden lg:block ${
              sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden"
                ? "bottom-28 right-4"
                : "bottom-24 right-0"
            } z-[1000] transition-all duration-300`}
          >
            <div className="bg-white px-3 py-2 rounded-md shadow-lg border border-gray-200/70">
              <p className="text-xs text-gray-600 font-medium mb-1 whitespace-pre-line">
                {mapLayers.currentModelingLegendTitle ?? "Légende modélisation"}
              </p>
              <img
                src={mapLayers.currentModelingLegendUrl}
                alt="Légende de la couche de modélisation"
                className="max-h-32 w-auto"
              />
            </div>
          </div>
        )}

        {wildfire.isWildfireLayerEnabled &&
          wildfire.wildfireLoading &&
          wildfire.wildfireReports.length === 0 && (
            <div className="absolute top-24 right-4 z-[1000] max-w-xs bg-white border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-md shadow-lg">
              {t("panels.loadingFireReports")}
            </div>
          )}

        {wildfire.isWildfireLayerEnabled && wildfire.wildfireError && (
          <div className="absolute top-36 right-4 z-[1000] max-w-xs bg-white border border-red-200 text-red-700 text-xs px-3 py-2 rounded-md shadow-lg">
            {wildfire.wildfireError}
          </div>
        )}

        {/* Informations de la carte (nombre d'appareils et de signalements) */}
        <div
          className={`absolute ${
            sidePanels.isSidePanelOpen && sidePanels.panelSize !== "hidden"
              ? "bottom-8 right-4 hidden lg:block"
              : "bottom-6 right-0 hidden lg:block"
          } bg-white px-3 py-2 rounded-md shadow-lg z-[1000] transition-all duration-300`}
        >
          <DeviceStatistics
            visibleDevices={visibleDevices}
            visibleReports={visibleReports}
            totalDevices={devices.length}
            totalReports={reports.length}
            selectedPollutant={selectedPollutant}
            selectedSources={selectedSources}
            statistics={statistics} // OPTIMISATION : Passer les statistiques pré-calculées
            sourceStatistics={sourceStatistics} // OPTIMISATION : Passer les stats par source pré-calculées
            showDetails={false}
          />
          {wildfire.isWildfireLayerEnabled &&
            wildfire.wildfireReports.length > 0 && (
              <div className="mt-1 text-xs text-gray-600">
                • {wildfire.wildfireReports.length} incendie
                {wildfire.wildfireReports.length > 1 ? "s" : ""} en cours
              </div>
            )}
        </div>

        {/* Indicateur de spiderfier actif supprimé */}
      </div>

      {/* Fonction pour obtenir l'icône SignalAir selon le type */}
      {(() => {
        const getSignalAirIconPath = (signalType?: string | null): string => {
          if (!signalType) return "/markers/signalAirMarkers/odeur.png";

          const typeMap: Record<string, string> = {
            odeur: "odeur",
            bruit: "bruits",
            brulage: "brulage",
            visuel: "visuel",
            pollen: "pollen",
          };

          const mappedType = typeMap[signalType.toLowerCase()] || "odeur";
          return `/markers/signalAirMarkers/${mappedType}.png`;
        };

        // Calculer quels boutons doivent être affichés, groupés par type
        const otherButtons: Array<{
          key: string;
          element: React.ReactElement;
        }> = [];
        const signalAirButtons: Array<{
          key: string;
          element: React.ReactElement;
        }> = [];
        const mobileAirButtons: Array<{
          key: string;
          element: React.ReactElement;
        }> = [];

        // Bouton pour rouvrir le panel de station masqué
        if (
          (sidePanels.isSidePanelOpen || isComparisonPanelVisible) &&
          sidePanels.panelSize === "hidden"
        ) {
          otherButtons.push({
            key: "station-panel",
            element: (
              <button
                key="station-panel"
                onClick={() => sidePanels.handleSidePanelSizeChange("normal")}
                className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                title={
                  sidePanels.comparisonState.isComparisonMode
                    ? t("panels.openComparisonPanel")
                    : t("panels.openDataPanel")
                }
                aria-label={
                  sidePanels.comparisonState.isComparisonMode
                    ? t("panels.openComparisonPanel")
                    : t("panels.openDataPanel")
                }
              >
                <svg
                  className="w-5 h-5"
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
              </button>
            ),
          });
        }

        // Boutons SignalAir
        // Bouton pour rouvrir le panel SignalAir masqué
        if (
          signalAir.isSignalAirDetailPanelOpen &&
          signalAir.signalAirDetailPanelSize === "hidden" &&
          signalAir.selectedSignalAirReport
        ) {
          signalAirButtons.push({
            key: "signalair-panel",
            element: (
              <button
                key="signalair-panel"
                onClick={() =>
                  signalAir.handleSignalAirDetailPanelSizeChange("normal")
                }
                className="block rounded-full hover:opacity-80 transition-opacity overflow-hidden p-0 border-0"
                title="Rouvrir le panneau SignalAir"
                aria-label={t("panels.openSignalAirPanel")}
              >
                <img
                  src={getSignalAirIconPath(
                    signalAir.selectedSignalAirReport.signalType
                  )}
                  alt={`Type: ${
                    signalAir.selectedSignalAirReport.signalType ||
                    "signalement"
                  }`}
                  className="w-12 h-12 object-cover rounded-full block m-0"
                  onError={(e) => {
                    // Fallback vers une icône par défaut si l'image ne charge pas
                    (e.target as HTMLImageElement).src =
                      "/markers/signalAirMarkers/odeur.png";
                  }}
                />
              </button>
            ),
          });
        }

        // Bouton pour rouvrir le panel SignalAir Selection masqué
        if (
          selectedSources.includes("signalair") &&
          (!signalAir.isSignalAirPanelOpen ||
            signalAir.signalAirPanelSize === "hidden")
        ) {
          signalAirButtons.push({
            key: "signalair-selection-panel",
            element: (
              <button
                key="signalair-selection-panel"
                onClick={() => {
                  // Si le panel n'est pas ouvert, l'ouvrir d'abord
                  if (!signalAir.isSignalAirPanelOpen) {
                    signalAir.handleOpenSignalAirPanel();
                  }
                  // Ensuite changer la taille à normal
                  signalAir.handleSignalAirPanelSizeChange("normal");
                }}
                className="block rounded-full hover:opacity-80 transition-opacity overflow-hidden p-0 border-2"
                title="Rouvrir le panneau de sélection SignalAir"
                aria-label={t("panels.openSignalAirSelection")}
              >
                <div
                  id="signalair-svg-container"
                  className="w-11 h-11 object-cover rounded-full block m-0"
                  dangerouslySetInnerHTML={{
                    __html: `<svg xmlns="http://www.w3.org/2000/svg" id="signalair-animated-svg" viewBox="0 0 792 612" style="white-space: preserve-spaces; width: 100%; height: 100%;"><path id="_a0" class="st0" d="M380.866,538.315L380.866,471.282C401.428,470.066,419.964,462.064,434.247,448.896L491.914639,519.188078C488.16663900000003,524.2530780000001,484.823639,529.419078,484.823639,536.003078C484.823639,544.714078,487.863639,552.007078,493.838639,557.882078C499.91663900000003,563.858078,507.108639,566.796078,515.515639,566.796078C523.922639,566.796078,531.215639,563.858078,537.192639,557.882078C543.269639,552.007078,546.207639,544.613078,546.207639,536.003078C546.207639,527.5950780000001,543.168639,520.404078,537.192639,514.427078C531.114639,508.452078,523.922639,505.514078,515.515639,505.514078C508.931639,505.514078,503.765639,508.85707799999994,498.599639,512.4020780000001L440.629,441.603C444.883,436.64,448.529,431.17,451.568,425.295L572.481928,479.81335C570.758928,484.77735,569.442928,489.84235,569.442928,495.51435C569.442928,509.59435,574.304928,521.34435,584.1299280000001,530.96635C593.955928,540.58935,605.603928,545.35035,619.277928,545.35035C632.952928,545.35035,644.702928,540.58935,654.426928,530.96635C664.251928,521.34435,669.113928,509.59435,669.113928,495.51435C669.113928,481.84035,664.251928,470.19135,654.426928,460.56835C644.601928,450.94535,632.952928,446.18435,619.277928,446.18435C605.603928,446.18435,593.853928,450.94535,584.1299280000001,460.56835C580.8889280000001,463.80935,578.963928,467.55735,576.7359280000001,471.20435L456.024,416.786C459.772,407.063,462.305,396.731,462.305,385.791C462.305,370.394,457.24,356.821,450.149,344.261L581.239503,260.737097C582.555503,262.357097,583.164503,264.282097,584.683503,265.801097C594.509503,275.424097,606.157503,280.185097,619.831503,280.185097C633.506503,280.185097,645.256503,275.424097,654.980503,265.801097C664.805503,256.178097,669.667503,244.428097,669.667503,230.349097C669.667503,216.674097,664.805503,205.026097,654.980503,195.403097C645.155503,185.780097,633.506503,181.019097,619.831503,181.019097C606.157503,181.019097,594.407503,185.780097,584.683503,195.403097C574.858503,205.026097,569.996503,216.674097,569.996503,230.349097C569.996503,238.756097,572.326503,246.151097,575.871503,252.937097L444.883,336.462C440.932,330.89,436.881,325.724,431.715,321.268L519.105747,207.88322200000002C522.3467469999999,209.40122200000002,525.2847469999999,212.035222,529.133747,212.035222C535.9197469999999,212.035222,541.795747,209.60422200000002,546.757747,204.844222C551.6207469999999,200.083222,554.050747,194.106222,554.050747,187.117222C554.050747,180.33122200000003,551.6207469999999,174.45622200000003,546.757747,169.695222C541.896747,164.934222,536.021747,162.50322200000002,529.133747,162.50322200000002C522.3467469999999,162.50322200000002,516.4717469999999,164.934222,511.508747,169.695222C506.646747,174.45622200000003,504.215747,180.33122200000003,504.215747,187.117222C504.215747,193.499222,506.84974700000004,198.665222,510.900747,203.22322200000002L423.915,316.001C412.165,307.897,398.794,302.529,383.803,301.211C386.032,266.57,384.819,230.190091,385.933,206.690091C390.896,205.880091,395.758,204.866091,399.505,201.119091C404.368,196.358091,406.798,190.382091,406.798,183.392091C406.798,176.606091,404.368,170.731091,399.505,165.970091C394.644,161.210091,388.769,158.778091,381.881,158.778091C375.094,158.778091,369.219,161.210091,364.256,165.970091C359.394,170.731091,356.963,176.606091,356.963,183.392091C356.963,190.382091,359.394,196.358091,364.256,201.119091C367.599,204.461091,372.156,205.069091,376.411,206.082091C375.297,228.063091,376.612,263.227,374.282,300.098C371.749,300.199,369.521,301.313,366.988,301.617L339.073223,131.237808C347.378223,129.10980800000002,355.177223,125.665808,361.661223,119.183808C371.486223,109.560808,376.347223,97.810808,376.347223,83.73096290000001C376.347223,70.05636290000001,371.486223,58.4077629,361.661223,48.7849629C351.835223,39.162262899999995,340.186223,34.4014629,326.512223,34.4014629C312.837223,34.4014629,301.087223,39.162262899999995,291.363223,48.7849629C281.538223,58.4077629,276.676223,70.05636290000001,276.676223,83.73096290000001C276.676223,97.810808,281.538223,109.560808,291.363223,119.183808C301.188223,128.805808,312.837223,133.566808,326.512223,133.566808C327.728223,133.566808,328.639223,133.060808,329.753223,132.958808L357.67,303.44C338.019,307.897,321.306,318.229,309.252,333.524L209.44054400000002,263.60395C210.757544,260.56595,213.188544,258.13495,213.188544,254.48795C213.188544,247.70195,210.757544,241.82695,205.895544,237.06595C201.032544,232.30495000000002,195.157544,229.87495,188.269544,229.87495C181.382544,229.87495,175.608544,232.30495000000002,170.645544,237.06595C165.783544,241.82695,163.35154400000002,247.70195,163.35154400000002,254.48795C163.35154400000002,261.47794999999996,165.783544,267.45394999999996,170.645544,272.21495C175.507544,276.97595,181.382544,279.40594999999996,188.269544,279.40594999999996C194.955544,279.40594999999996,200.627544,276.97595,205.388544,272.41695L303.884,341.425C298.819,349.528,295.578,358.139,293.349,367.761C267.924,363.507,236.63346,357.76704,216.47546,354.12004C216.78046,351.89204,217.69146,349.96704,217.69146,347.63704C217.69146,333.96304000000003,212.82946,322.31404000000003,203.00446,312.69104000000004C193.17846,303.06804,181.53046,298.30704000000003,167.85646,298.30704000000003C154.18146000000002,298.30704000000003,142.43146000000002,303.06804,132.70746,312.69104000000004C122.8824417,322.31404000000003,118.0204417,333.96304000000003,118.0204417,347.63704C118.0204417,361.71704,122.8824417,373.46704,132.70746,383.08904C142.53246000000001,392.71204,154.18146000000002,397.47304,167.85646,397.47304C181.53046,397.47304,193.28046,392.71204,203.00446,383.08904C208.77846,377.41704000000004,212.32346,370.73204000000004,214.65246000000002,363.54004000000003C231.46746000000002,366.68004,261.746,372.319,291.424,377.182C291.121,380.22,289.703,382.854,289.703,385.993C289.703,431.879,325.864,468.648,371.142,471.18L371.142,538.214C366.786,539.126,362.735,540.746,359.392,544.089C354.833,548.546,352.504,554.015,352.504,560.3960000000001C352.504,566.98,354.833,572.552,359.392,577.009C363.949,581.466,369.521,583.7950000000001,375.903,583.7950000000001C382.284,583.7950000000001,387.855,581.566,392.412,577.009C396.971,572.552,399.301,566.98,399.301,560.3960000000001C399.301,554.015,396.971,548.546,392.412,544.089C389.273,540.847,385.221,539.126,380.866,538.315Z" fill="#13A0DB" transform="translate(410.705,319.5) translate(-395.705,-319.27)"></path></svg>`,
                  }}
                />
              </button>
            ),
          });
        }

        // Boutons MobileAir
        // Bouton pour rouvrir le panel MobileAir de détail masqué
        if (
          mobileAir.mobileAirRoutes.length > 0 &&
          mobileAir.mobileAirDetailPanelSize === "hidden"
        ) {
          mobileAirButtons.push({
            key: "mobileair-detail-panel",
            element: (
              <button
                key="mobileair-detail-panel"
                onClick={mobileAir.handleOpenMobileAirDetailPanel}
                className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
                title="Rouvrir le panneau MobileAir (détail)"
                aria-label={t("panels.openMobileAirPanel")}
              >
                <svg
                  className="w-5 h-5"
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
              </button>
            ),
          });
        }

        // Bouton pour rouvrir le panel MobileAir Selection masqué
        if (
          selectedSources.includes("communautaire.mobileair") &&
          (!mobileAir.isMobileAirSelectionPanelOpen ||
            mobileAir.mobileAirSelectionPanelSize === "hidden")
        ) {
          mobileAirButtons.push({
            key: "mobileair-selection-panel",
            element: (
              <button
                key="mobileair-selection-panel"
                onClick={() => {
                  // Si le panel n'est pas ouvert, l'ouvrir d'abord
                  if (!mobileAir.isMobileAirSelectionPanelOpen) {
                    mobileAir.handleOpenMobileAirSelectionPanel();
                  }
                  // Ensuite changer la taille à normal
                  mobileAir.handleMobileAirSelectionPanelSizeChange("normal");
                }}
                className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
                title="Rouvrir le panneau de sélection MobileAir"
                aria-label={t("panels.openMobileAirSelection")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect
                    x="5"
                    y="4"
                    width="14"
                    height="16"
                    rx="2"
                    ry="2"
                    strokeWidth={1.5}
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth={1.5}
                    d="M9 8h6M9 12h6M9 16h3"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 16c1.2-1 1.2-3 0-4"
                  />
                </svg>
              </button>
            ),
          });
        }

        // Vérifier s'il y a des boutons à afficher
        const totalButtons =
          otherButtons.length +
          signalAirButtons.length +
          mobileAirButtons.length;
        if (totalButtons === 0) return null;

        return (
          <div
            className="fixed left-2 top-1/2 -translate-y-1/2 z-[2001] 
                       bg-stone-50/60 backdrop-blur-sm rounded-xl shadow-xl border border-stone-200/40 
                       flex flex-col gap-2.5 p-2.5
                       animate-slide-in-left transition-all duration-300 ease-out
                       hover:bg-stone-50/95 hover:shadow-2xl hover:border-stone-300/80
                       opacity-70 hover:opacity-100"
          >
            {/* Boutons autres (station, etc.) */}
            {otherButtons.map((btn, index) => (
              <div
                key={btn.key}
                className="animate-scale-in transition-all duration-200 ease-out 
                             hover:scale-110 hover:z-10 transform-gpu"
                style={{
                  animationDelay: `${index * 60}ms`,
                  animationFillMode: "both",
                }}
              >
                {btn.element}
              </div>
            ))}

            {/* Groupe SignalAir - boutons groupés verticalement avec espacement réduit */}
            {signalAirButtons.length > 0 && (
              <div
                className={`flex flex-col gap-1 ${
                  otherButtons.length > 0 ? "mt-3" : ""
                }`}
              >
                {signalAirButtons.map((btn, index) => (
                  <div
                    key={btn.key}
                    className="animate-scale-in transition-all duration-200 ease-out 
                                 hover:scale-110 hover:z-10 transform-gpu"
                    style={{
                      animationDelay: `${(otherButtons.length + index) * 60}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    {btn.element}
                  </div>
                ))}
              </div>
            )}

            {/* Groupe MobileAir - boutons groupés verticalement avec espacement réduit */}
            {mobileAirButtons.length > 0 && (
              <div
                className={`flex flex-col gap-1 ${
                  otherButtons.length > 0 || signalAirButtons.length > 0
                    ? "mt-3"
                    : ""
                }`}
              >
                {mobileAirButtons.map((btn, index) => (
                  <div
                    key={btn.key}
                    className="animate-scale-in transition-all duration-200 ease-out 
                                 hover:scale-110 hover:z-10 transform-gpu"
                    style={{
                      animationDelay: `${
                        (otherButtons.length +
                          signalAirButtons.length +
                          index) *
                        60
                      }ms`,
                      animationFillMode: "both",
                    }}
                  >
                    {btn.element}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default AirQualityMap;
