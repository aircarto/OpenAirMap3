import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import {
  MapContainer,
  Marker,
  Popup,
  useMapEvents,
  AttributionControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "geoportal-extensions-leaflet";
import "leaflet-velocity";
import "leaflet-velocity/dist/leaflet-velocity.css";
import { DomainConfig } from "../../config/domainConfig";

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
import {
  BurnedAreaPeriod,
  HotspotPeriod,
  isWithinHotspotsRetention,
} from "../../services/EffisLayerService";
import { MAX_COMPARISON_STATIONS } from "../../constants/comparison";
import CustomSearchControl from "../controls/CustomSearchControl";
import MapControlRail from "./rail/MapControlRail";
import { useMapControls } from "../../contexts/mapControlsContext";
import ScaleControl from "../controls/ScaleControl";
import NorthArrow from "../controls/NorthArrow";
import Legend from "./Legend";
import MapReadyNotifier from "./MapReadyNotifier";
import MobileAirRoutes from "./MobileAirRoutes";
import CustomSpiderfiedMarkers from "./CustomSpiderfiedMarkers";
import CustomSpiderfiedSignalAirMarkers from "./CustomSpiderfiedSignalAirMarkers";
import MarkerWithTooltip from "./MarkerWithTooltip";
import DeviceStatistics from "./DeviceStatistics";
import MapPanelsContainer from "./MapPanelsContainer";
import MapDataMarkers from "./MapDataMarkers";
import MapOverlays from "./MapOverlays";
import MapViewSyncHandler from "./MapViewSyncHandler";
import { AtmoRefService } from "../../services/AtmoRefService";
import type { AtmoMicroLikeService } from "../../types";
import { NebuleAirService } from "../../services/NebuleAirService";
import { DataServiceFactory } from "../../services/DataServiceFactory";
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
import { useMapSurfaceHints } from "./hooks/useMapSurfaceHints";

// Utilitaires
import {
  createCustomIcon,
  createSignalIcon,
  createWildfireIcon,
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
import { featureFlags } from "../../config/featureFlags";
import { advertisingConfig } from "../../config/advertisingConfig";

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
    period: { startDate: string; endDate: string },
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
  historicalStartDate?: string;
  historicalEndDate?: string;
  historicalTimeStep?: string;
  historicalPlaybackDate?: string;
  /** Masque l'encart promo quand le panel historique de sélection de date est visible */
  isHistoricalDatePanelVisible?: boolean;
  /** Callback quand l'utilisateur déplace ou zoome la carte */
  onMapViewChange?: (center: [number, number], zoom: number) => void;
  /** Emprise de l'instance courante (voir DomainConfig.mapBounds) — limite les couches EFFIS */
  mapBounds: DomainConfig["mapBounds"];
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
  historicalStartDate,
  historicalEndDate,
  historicalTimeStep,
  historicalPlaybackDate,
  isHistoricalDatePanelVisible = false,
  onMapViewChange,
  mapBounds,
}) => {
  const { t } = useTranslation();
  // AirQualityMap est rendu dans MapControlsProvider : il peut consommer le
  // contexte pour transmettre les notices applicatives à la pile unique.
  const mapControls = useMapControls();
  const mapColumnRef = useRef<HTMLDivElement | null>(null);
  // Configuration du spiderfier
  const [spiderfyConfig, setSpiderfyConfig] = useState(defaultSpiderfyConfig);
  const [currentBaseLayer, setCurrentBaseLayer] =
    useState<BaseLayerKey>("Carte standard");
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const handleMapReady = useCallback(() => {
    setMapReadyVersion((v) => v + 1);
  }, []);
  const [isCommunalLayerEnabled, setIsCommunalLayerEnabled] = useState(false);
  const [isEffisHotspotsEnabled, setIsEffisHotspotsEnabled] = useState(false);
  const [isEffisBurnedAreasEnabled, setIsEffisBurnedAreasEnabled] =
    useState(false);
  /** 24 h par défaut : la demande porte d'abord sur la donnée la plus fraîche */
  const [effisHotspotsPeriod, setEffisHotspotsPeriod] =
    useState<HotspotPeriod>("24h");
  /**
   * Saison par défaut : `today` renvoie très souvent zéro polygone (MODIS met
   * plusieurs jours à cartographier un périmètre), un défaut vide serait trompeur.
   */
  const [effisBurnedAreasPeriod, setEffisBurnedAreasPeriod] =
    useState<BurnedAreaPeriod>("season");

  /**
   * Date rejouée par la timeline historique, source de vérité des couches feux.
   * Absente hors mode historique : les couches repassent alors en temps réel.
   */
  const effisReferenceDate = useMemo(() => {
    if (!historicalPlaybackDate) return undefined;
    // Les timestamps du mode historique peuvent arriver en "YYYY-MM-DD HH:mm:ss" :
    // Safari refuse ce format, d'où la normalisation en ISO avant parsing.
    const normalized = historicalPlaybackDate.includes("T")
      ? historicalPlaybackDate
      : historicalPlaybackDate.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [historicalPlaybackDate]);

  /**
   * `all.hs.query` ne conserve que 365 jours glissants (mesuré sur le service).
   * Au-delà, mieux vaut désactiver la couche et l'expliquer que d'afficher un vide
   * que l'utilisateur prendrait pour une absence de feux.
   */
  const isHotspotsBeyondRetention = Boolean(
    effisReferenceDate && !isWithinHotspotsRetention(effisReferenceDate),
  );
  const [isWildfireLayerEnabledByControl, setIsWildfireLayerEnabledByControl] =
    useState(featureFlags.wildfireLayer);

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
    mapReadyVersion,
    currentBaseLayer,
    selectedTimeStep,
    selectedPollutant,
    currentModelingLayer,
    isCommunalLayerEnabled,
    isEffisHotspotsEnabled:
      isEffisHotspotsEnabled && !isHotspotsBeyondRetention,
    isEffisBurnedAreasEnabled,
    effisHotspotsPeriod,
    effisBurnedAreasPeriod,
    effisReferenceDate,
    mapBounds,
  });

  const wildfire = useWildfireLayer(isWildfireLayerEnabledByControl);
  const isWildfireVisible = wildfire.isWildfireLayerEnabled;

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
            },
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
    // On inclut les objets utilisés dans l'effet pour rester synchronisé
    // avec leur état courant (règle exhaustive-deps).
  }, [isHistoricalModeActive, sidePanels, signalAir, mobileAir]);

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
  ]);

  // Indices de surface consommés par les classes .glass-* (voir index.css)
  useMapSurfaceHints(
    mapColumnRef,
    mapView.mapRef,
    currentBaseLayer as BaseLayerKey,
    mapReadyVersion
  );

  const handleBaseLayerChange = (layerKey: BaseLayerKey) => {
    setCurrentBaseLayer(layerKey);
  };

  // Handlers pour la comparaison
  const handleLoadComparisonData = createLoadComparisonDataHandler(
    sidePanels.setComparisonState,
  );
  const removeStationFromComparisonBase =
    createRemoveStationFromComparisonHandler(
      sidePanels.comparisonState,
      sidePanels.setComparisonState,
      sidePanels.setIsSidePanelOpen,
      sidePanels.setSelectedStation,
    );
  const handleRemoveStationFromComparison = useCallback(
    (stationId: string) => {
      const removedStation = sidePanels.comparisonState.comparedStations.find(
        (station) => station.id === stationId,
      );
      removeStationFromComparisonBase(stationId);
      trackEvent(
        "comparison",
        "remove_station",
        removedStation?.source ?? "unknown",
      );
      trackFeatureUsage("comparison_station_removed", {
        source: removedStation?.source ?? "unknown",
        remainingStations: Math.max(
          sidePanels.comparisonState.comparedStations.length - 1,
          0,
        ),
      });
    },
    [
      sidePanels.comparisonState.comparedStations,
      removeStationFromComparisonBase,
    ],
  );

  // Handler pour ajouter une station à la comparaison
  // useCallback rend la fonction stable entre renders.
  // Cela évite que les callbacks dépendants se recréent inutilement.
  const handleAddStationToComparison = useCallback(
    async (device: MeasurementDevice) => {
      // Vérifier que la station n'est pas déjà dans la liste
      const isAlreadyAdded = sidePanels.comparisonState.comparedStations.some(
        (station) => station.id === device.id,
      );

      // Si la station est déjà ajoutée, la retirer (désélection)
      if (isAlreadyAdded) {
        handleRemoveStationFromComparison(device.id);
        return;
      }

      // Vérifier les limites (max N stations) seulement si on ajoute une nouvelle station
      if (
        sidePanels.comparisonState.comparedStations.length >=
        MAX_COMPARISON_STATIONS
      ) {
        console.warn(
          `Maximum ${MAX_COMPARISON_STATIONS} stations autorisées en comparaison`,
        );
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
          const atmoRefService = DataServiceFactory.getService(
            "atmoRef",
          ) as AtmoRefService;
          variables = await atmoRefService.fetchStationVariables(device.id);
        } else if (device.source === "atmoMicro") {
          const atmoMicroService = DataServiceFactory.getService(
            "atmoMicro",
          ) as AtmoMicroLikeService;
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
          error,
        );
      }
    },
    [sidePanels, handleRemoveStationFromComparison],
  );

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
      wildfire.wildfireReports.length,
    );
  };

  const getMarkerKeyWrapper = (device: MeasurementDevice) => {
    return getMarkerKey(
      device,
      sidePanels.comparisonState,
      sidePanels.selectedStation,
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
            const atmoRefService = DataServiceFactory.getService(
              "atmoRef",
            ) as AtmoRefService;
            variables = await atmoRefService.fetchStationVariables(device.id);
          } else if (device.source === "atmoMicro") {
            const atmoMicroService = DataServiceFactory.getService(
              "atmoMicro",
            ) as AtmoMicroLikeService;
            const siteInfo = await atmoMicroService.fetchSiteVariables(
              device.id,
            );
            variables = siteInfo.variables;
            sensorModel = siteInfo.sensorModel;
          } else if (device.source === "nebuleair") {
            const nebuleAirService = DataServiceFactory.getService(
              "nebuleair",
            ) as NebuleAirService;
            const siteInfo = await nebuleAirService.fetchSiteInfo(device.id);
            variables = siteInfo.variables;
            lastSeenSec = siteInfo.lastSeenSec;
          }
        } catch (error) {
          console.error(
            `❌ [Map] Erreur lors de la récupération des informations de la station ${device.id}:`,
            error,
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
          error,
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
    [sidePanels, handleAddStationToComparison],
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
          },
        );
      }

      // Sélectionner le capteur et ouvrir le sidepanel
      handleMarkerClick(device);
    },
    // mapView.mapRef est utilisé dans le callback: on le déclare explicitement.
    [handleMarkerClick, mapView.mapRef],
  );

  // Les handlers SignalAir et MobileAir sont maintenant dans leurs hooks respectifs
  // Utiliser signalAir.* et mobileAir.* pour accéder aux handlers

  return (
    <div className="w-full h-full flex items-stretch relative">
      <MapPanelsContainer
        sidePanels={sidePanels}
        signalAir={signalAir}
        mobileAir={mobileAir}
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
        isHistoricalModeActive={isHistoricalModeActive}
        historicalStartDate={historicalStartDate}
        historicalEndDate={historicalEndDate}
        historicalTimeStep={historicalTimeStep}
        historicalPlaybackDate={historicalPlaybackDate}
      />

      {/* Conteneur de la carte */}
      {/* Cible du lien d'évitement : la carte elle-même, et non <main> qui
          englobe le rail. `tabIndex={-1}` rend l'ancre focalisable par script
          sans l'ajouter à l'ordre de tabulation. */}
      <div
        ref={mapColumnRef}
        id="main-content"
        tabIndex={-1}
        className="flex-1 relative focus:outline-none"
        role="region"
        aria-label={t("app.mapAriaLabel")}
      >
        {/* Rail de contrôles : absolute dans cette colonne, donc il glisse
            quand un panneau latéral la pousse. */}
        {/* Bande instrument : la rose des vents n'est plus un contrôle Leaflet,
            elle s'adosse à --rail-inset comme l'échelle. */}
        <NorthArrow
          isSidePanelOpen={sidePanels.isSidePanelOpen}
          panelSize={sidePanels.panelSize}
        />

        <MapControlRail
          baseLayer={{
            currentBaseLayer: currentBaseLayer as BaseLayerKey,
            onBaseLayerChange: setCurrentBaseLayer,
            isCommunalLayerEnabled,
            onCommunalLayerToggle: setIsCommunalLayerEnabled,
            isEffisHotspotsEnabled,
            onEffisHotspotsToggle: setIsEffisHotspotsEnabled,
            effisHotspotsPeriod,
            onEffisHotspotsPeriodChange: setEffisHotspotsPeriod,
            isEffisBurnedAreasEnabled,
            onEffisBurnedAreasToggle: setIsEffisBurnedAreasEnabled,
            effisBurnedAreasPeriod,
            onEffisBurnedAreasPeriodChange: setEffisBurnedAreasPeriod,
            isWildfireLayerEnabled: isWildfireVisible,
            onWildfireLayerToggle: setIsWildfireLayerEnabledByControl,
          }}
          shortcuts={{
            sidePanels,
            signalAir,
            mobileAir,
            isComparisonPanelVisible,
            selectedSources,
          }}
        />

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
          attributionControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          touchZoom={true}
          minZoom={1}
          maxZoom={18}
        >
          {/* Attribution sans le préfixe "Leaflet" pour laisser plus de place sur mobile */}
          <AttributionControl position="bottomright" prefix={false} />

          {/* Gestionnaire d'événements pour les clics sur la carte */}
          <MapClickHandler onMapClick={() => setSearchPinPosition(null)} />
          <MapReadyNotifier onReady={handleMapReady} />
          {onMapViewChange && (
            <MapViewSyncHandler onViewChange={onMapViewChange} />
          )}

          {/* Contrôle d'échelle */}
          <ScaleControl
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
            handleSignalAirMarkerClickWrapper={
              handleSignalAirMarkerClickWrapper
            }
          />

          {/* Marqueurs pour les incendies en cours */}
          {isWildfireVisible &&
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
                        <strong>Statut:</strong> {incident.status || "Inconnu"}
                      </p>
                      {incident.fireState && (
                        <p>
                          <strong>État du feu:</strong> {incident.fireState}
                        </p>
                      )}
                      {incident.url && (
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
                      )}
                      <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
                        Source :{" "}
                        <a
                          href="https://feuxdeforet.fr"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          feuxdeforet.fr
                        </a>
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        <MapOverlays
          signalAir={signalAir}
          promo={
            featureFlags.useAdvertising && advertisingConfig.sensorShopUrl
              ? {
                  shopUrl: advertisingConfig.sensorShopUrl,
                  hidden: Boolean(isHistoricalDatePanelVisible),
                }
              : null
          }
          appNotices={mapControls.ui.notices}
          t={t}
          sidePanels={sidePanels}
          isEffisHotspotsEnabled={isEffisHotspotsEnabled}
          effisHotspotsPeriod={effisHotspotsPeriod}
          isEffisBurnedAreasEnabled={isEffisBurnedAreasEnabled}
          effisBurnedAreasPeriod={effisBurnedAreasPeriod}
          isHotspotsBeyondRetention={isHotspotsBeyondRetention}
          isWildfireVisible={isWildfireVisible}
          shouldShowStandardLegend={shouldShowStandardLegend}
          selectedPollutant={selectedPollutant}
          isComparisonPanelVisible={isComparisonPanelVisible}
          mapLayers={mapLayers}
          wildfire={wildfire}
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
    </div>
  );
};

export default AirQualityMap;
