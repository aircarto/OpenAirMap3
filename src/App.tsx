import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import AirQualityMap from "./components/map/AirQualityMap";
import {
  compactNotices,
  type Notice,
} from "./components/map/notifications/notice";
import { MapControlsProvider } from "./contexts/MapControlsProvider";
import type {
  MapControlsBrand,
  MapControlsFilters,
  MapControlsHistorical,
  MapControlsModeling,
  MapControlsAirCrowdWms,
  MapControlsRefresh,
  MapControlsCommunitySources,
  MapControlsTimeBar,
  MapControlsUi,
  MapControlsValue,
} from "./contexts/mapControlsContext";
import { useAirQualityData } from "./hooks/useAirQualityData";
import { useAirCrowdWmsMeasurements } from "./hooks/useAirCrowdWmsMeasurements";
import { useAirCrowdWmsAvailability } from "./hooks/useAirCrowdWmsAvailability";
import { useMapInstant } from "./hooks/useMapInstant";
import { useDomainConfig } from "./hooks/useDomainConfig";
import { useFavicon } from "./hooks/useFavicon";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { useMetaDescription } from "./hooks/useMetaDescription";
import { useCanonicalUrl } from "./hooks/useCanonicalUrl";
import { useStructuredData } from "./hooks/useStructuredData";
import {
  isPollutantSupportedForTimeStep,
  getSupportedPollutantsForTimeStep,
} from "./constants/pollutants";
import {
  getDefaultTimeStep,
  isTimeStepAvailable,
} from "./constants/timeSteps";
import { getConfigForDomain } from "./config/domainConfig";
import {
  AIRCROWD_WMS_DEFAULT_START_DATE,
  clampAirCrowdWmsDate,
  getAirCrowdWmsToday,
  getAvailableHoursForAirCrowd,
  pickNearestAvailableAirCrowdHour,
} from "./services/AirCrowdWmsLayerService";
import {
  buildAppUrlDefaults,
  parseAppUrlParams,
  AppUrlParams,
} from "./utils/appUrlParams";
import { useAppUrlSync } from "./hooks/useAppUrlSync";
import InformationModal from "./components/modals/InformationModal";
import AboutPanel from "./components/AboutPanel";
import { ModelingLayerType } from "./constants/mapLayers";
import {
  getModelingLayerHour,
  isModelingAvailable,
} from "./services/ModelingLayerService";
import { buildAirCrowdWmsHourWindow } from "./utils/airCrowdWmsMeasurements";
import {
  buildTimeBarWindow,
  findSlotIndex,
  instantToAzurIndex,
  isMapInstantAllowedForTimeStep,
  lastCompletedHourInstant,
  minInstantForLookback,
  type MapInstant,
  type ModelingKind,
} from "./utils/mapInstant";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast";
import { useTranslation } from "react-i18next";
import {
  initAnalytics,
  trackEvent,
  trackFeatureUsage,
  trackPageView,
} from "./services/analyticsService";
import { FeatureTourProvider } from "./components/tour/FeatureTourProvider";
import GlobalAppTourController from "./components/tour/GlobalAppTourController";

interface AtmoMicroMaintenanceBannerConfig {
  enabled: boolean;
  message: string;
}

interface MaintenanceConfig {
  atmoMicroQualifiedSensors?: Partial<AtmoMicroMaintenanceBannerConfig>;
}

const DEFAULT_ATMOMICRO_MAINTENANCE_BANNER: AtmoMicroMaintenanceBannerConfig = {
  enabled: true,
  message:
    "Suite a un probleme technique, les donnees des capteurs qualifies ne sont plus accessibles. AtmoSud met tout en oeuvre pour le resoudre.",
};

const getInitialAppUrlParams = (): AppUrlParams => {
  const forcedDomain = import.meta.env.VITE_FORCE_DOMAIN_CONFIG?.trim();
  const domainConfig = getConfigForDomain(
    forcedDomain || window.location.hostname,
  );
  const defaults = buildAppUrlDefaults({
    mapCenter: domainConfig.mapCenter,
    mapZoom: domainConfig.mapZoom,
  });
  return parseAppUrlParams(window.location.search, defaults);
};

const INITIAL_APP_URL_PARAMS = getInitialAppUrlParams();

const hadMapParamsInInitialUrl = ((): boolean => {
  const params = new URLSearchParams(window.location.search);
  return params.has("lat") || params.has("lng") || params.has("zoom");
})();

const AppContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  // Configuration basée sur le domaine
  const domainConfig = useDomainConfig();

  // Gestion dynamique de la favicon et du titre
  useFavicon(domainConfig.favicon);
  useDocumentTitle(domainConfig.seoTitle ?? domainConfig.title);
  useMetaDescription(domainConfig.description);
  useCanonicalUrl();
  useStructuredData(domainConfig);

  // Hook pour les notifications toast
  const { toasts, addToast, removeToast } = useToast();

  // Trouver le pas de temps activé par défaut (calculé une seule fois)
  const defaultTimeStep = useMemo(() => getDefaultTimeStep(), []);

  // Calculer la période par défaut pour SignalAir (2 derniers jours)
  const defaultSignalAirPeriod = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 2);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, []);

  const SIGNAL_AIR_DEFAULT_TYPES = useMemo(
    () => ["odeur", "bruit", "brulage", "visuel"],
    [],
  );

  // États pour les contrôles avec polluant par défaut
  const [selectedPollutant, setSelectedPollutant] = useState<string>(
    INITIAL_APP_URL_PARAMS.pollutant,
  );
  const [selectedSources, setSelectedSources] = useState<string[]>(
    INITIAL_APP_URL_PARAMS.sources,
  );
  const [selectedTimeStep, setSelectedTimeStep] = useState<string>(
    INITIAL_APP_URL_PARAMS.timeStep,
  );
  const [signalAirPeriod, setSignalAirPeriod] = useState(
    defaultSignalAirPeriod,
  );
  const [signalAirDraftPeriod, setSignalAirDraftPeriod] = useState(
    defaultSignalAirPeriod,
  );
  const [signalAirSelectedTypes, setSignalAirSelectedTypes] = useState<
    string[]
  >(SIGNAL_AIR_DEFAULT_TYPES);
  const [signalAirLoadTrigger, setSignalAirLoadTrigger] = useState(0);
  const [currentModelingLayer, setCurrentModelingLayer] =
    useState<ModelingLayerType | null>(null);
  const aircrowdWmsStartDate =
    domainConfig.aircrowdWmsStartDate ?? AIRCROWD_WMS_DEFAULT_START_DATE;
  // Aligné sur domainConfig.aircrowdWmsEnabled : feature exposée = couche on au démarrage
  // (même idée que sources[].activated / getDefaultSources).
  const [aircrowdWmsEnabled, setAircrowdWmsEnabled] = useState(() =>
    Boolean(domainConfig.aircrowdWmsEnabled),
  );
  const [aircrowdWmsDate, setAircrowdWmsDate] = useState(() =>
    clampAirCrowdWmsDate(
      lastCompletedHourInstant().date,
      aircrowdWmsStartDate,
    ),
  );
  const [aircrowdWmsHour, setAircrowdWmsHour] = useState(
    () => lastCompletedHourInstant().hour,
  );
  const { availability: aircrowdAvailability } = useAirCrowdWmsAvailability(
    Boolean(domainConfig.aircrowdWmsEnabled),
  );
  const {
    mode: mapInstantMode,
    instant: mapInstant,
    isExploration,
    goLive,
    seekTo,
  } = useMapInstant();

  const resetSignalAirSettings = useCallback(() => {
    const resetPeriod = {
      startDate: defaultSignalAirPeriod.startDate,
      endDate: defaultSignalAirPeriod.endDate,
    };
    setSignalAirSelectedTypes([...SIGNAL_AIR_DEFAULT_TYPES]);
    setSignalAirLoadTrigger(0);
    setSignalAirPeriod(resetPeriod);
    setSignalAirDraftPeriod(resetPeriod);
  }, [SIGNAL_AIR_DEFAULT_TYPES, defaultSignalAirPeriod]);

  // États pour MobileAir
  const [mobileAirPeriod, setMobileAirPeriod] = useState(
    defaultSignalAirPeriod, // Utiliser la même période par défaut
  );
  const [selectedMobileAirSensor, setSelectedMobileAirSensor] = useState<
    string | null
  >(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // États pour gérer SignalAir et MobileAir indépendamment du système de sources
  const [isSignalAirEnabled, setIsSignalAirEnabled] = useState(false);
  const [isMobileAirEnabled, setIsMobileAirEnabled] = useState(false);
  const [isSignalAirVisible, setIsSignalAirVisible] = useState(true);
  const [isMobileAirVisible, setIsMobileAirVisible] = useState(true);

  useEffect(() => {
    initAnalytics();
    trackPageView(domainConfig.title);
  }, [domainConfig.title]);

  const handlePollutantChange = useCallback((pollutant: string) => {
    setSelectedPollutant(pollutant);
    trackEvent("pollutant", "select", pollutant);
  }, []);

  const handleSourceChange = useCallback((sources: string[]) => {
    setSelectedSources((previousSources) => {
      const addedSources = sources.filter(
        (source) => !previousSources.includes(source),
      );
      const removedSources = previousSources.filter(
        (source) => !sources.includes(source),
      );

      trackFeatureUsage("sources_change", {
        selectedCount: sources.length,
        added: addedSources.join(",") || null,
        removed: removedSources.join(",") || null,
      });

      return sources;
    });
  }, []);

  const handleTimeStepChange = useCallback((timeStep: string) => {
    if (!isTimeStepAvailable(timeStep)) {
      return;
    }
    setSelectedTimeStep(timeStep);
    trackFeatureUsage("time_step_change", { timeStep });
  }, []);

  const handleModelingLayerChange = useCallback(
    (layer: ModelingLayerType | null) => {
      setCurrentModelingLayer(layer);
      trackFeatureUsage("modeling_layer_change", { layer: layer ?? "none" });
      goLive();

      if (layer) {
        setAircrowdWmsEnabled(false);
      }
    },
    [goLive],
  );

  const handleAircrowdWmsEnabledChange = useCallback(
    (enabled: boolean) => {
      setAircrowdWmsEnabled(enabled);
      goLive();
      if (enabled) {
        setCurrentModelingLayer(null);
      }
      trackFeatureUsage("aircrowd_wms_toggle", { enabled });
    },
    [goLive],
  );

  const handleAircrowdWmsDateChange = useCallback(
    (date: string) => {
      setAircrowdWmsDate(
        clampAirCrowdWmsDate(date, aircrowdWmsStartDate, getAirCrowdWmsToday()),
      );
    },
    [aircrowdWmsStartDate],
  );

  const handleAircrowdWmsHourChange = useCallback((hour: number) => {
    setAircrowdWmsHour(Math.max(0, Math.min(23, Math.floor(hour))));
  }, []);

  const handleAutoRefreshToggle = useCallback((enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    trackFeatureUsage("auto_refresh_toggle", { enabled });
  }, []);

  const handleSignalAirVisibilityToggle = useCallback((visible: boolean) => {
    setIsSignalAirVisible(visible);
    trackFeatureUsage("signalair_visibility_toggle", { visible });
  }, []);

  const handleMobileAirVisibilityToggle = useCallback((visible: boolean) => {
    setIsMobileAirVisible(visible);
    trackFeatureUsage("mobileair_visibility_toggle", { visible });
  }, []);

  // Fonction wrapper pour gérer le changement de période SignalAir
  const handleSignalAirDraftPeriodChange = useCallback(
    (startDate: string, endDate: string) => {
      setSignalAirDraftPeriod({ startDate, endDate });
    },
    [],
  );

  const handleSignalAirTypesChange = useCallback((types: string[]) => {
    setSignalAirSelectedTypes(types);
  }, []);

  const handleSignalAirLoadRequest = useCallback(() => {
    if (signalAirSelectedTypes.length === 0) {
      return;
    }
    setSignalAirPeriod({
      startDate: signalAirDraftPeriod.startDate,
      endDate: signalAirDraftPeriod.endDate,
    });
    setSignalAirLoadTrigger((prev) => prev + 1);
    trackFeatureUsage("signalair_load_request", {
      selectedTypes: signalAirSelectedTypes.join(","),
      startDate: signalAirDraftPeriod.startDate,
      endDate: signalAirDraftPeriod.endDate,
    });
  }, [signalAirSelectedTypes, signalAirDraftPeriod]);

  // Fonction pour gérer la sélection d'un capteur MobileAir
  const handleMobileAirSensorSelected = (
    sensorId: string,
    period: { startDate: string; endDate: string },
  ) => {
    // Toujours mettre à jour pour forcer le rechargement même si les valeurs sont identiques
    // Cela permet de recharger les données qui remplaceront celles existantes
    setSelectedMobileAirSensor(sensorId);
    setMobileAirPeriod(period);
    // Activer MobileAir
    setIsMobileAirEnabled(true);
    setIsMobileAirVisible(true);
  };

  // Fonction pour désélectionner la source MobileAir
  const handleMobileAirSourceDeselected = useCallback(() => {
    // Réinitialiser les états MobileAir
    setSelectedMobileAirSensor(null);
    setMobileAirPeriod(defaultSignalAirPeriod);
    setIsMobileAirEnabled(false);
    setIsMobileAirVisible(false);
  }, [defaultSignalAirPeriod]);

  const handleSignalAirSourceDeselected = useCallback(() => {
    resetSignalAirSettings();
    setIsSignalAirEnabled(false);
    setIsSignalAirVisible(false);
  }, [resetSignalAirSettings]);

  // Activation des deux sources. Les noms d'événement analytiques restent ceux
  // de l'époque des panneaux latéraux : les renommer romprait les séries déjà
  // collectées, alors que la mesure porte sur le même geste utilisateur.
  const handleSignalAirEnable = useCallback(() => {
    setIsSignalAirEnabled(true);
    trackFeatureUsage("signalair_panel_open");
  }, []);

  const handleMobileAirEnable = useCallback(() => {
    setIsMobileAirEnabled(true);
    trackFeatureUsage("mobileair_panel_open");
  }, []);

  /**
   * Activation depuis le menu Sources, dans les deux sens.
   *
   * L'extinction passe par le désélecteur complet et non par un simple
   * `setIsSignalAirEnabled(false)` : sans la réinitialisation, une réactivation
   * ferait réapparaître les signalements de la session précédente. Même raison
   * côté MobileAir pour les parcours.
   */
  const handleSignalAirEnabledChange = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        handleSignalAirEnable();
      } else {
        handleSignalAirSourceDeselected();
      }
    },
    [handleSignalAirEnable, handleSignalAirSourceDeselected],
  );

  const handleMobileAirEnabledChange = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        handleMobileAirEnable();
      } else {
        handleMobileAirSourceDeselected();
      }
    },
    [handleMobileAirEnable, handleMobileAirSourceDeselected],
  );

  // Gérer le chargement des données SignalAir quand activé
  useEffect(() => {
    if (isSignalAirEnabled && signalAirLoadTrigger > 0) {
      // Les données seront chargées via useAirQualityData avec signalAirOptions
    }
  }, [isSignalAirEnabled, signalAirLoadTrigger]);

  // État pour l'auto-refresh - désactivé par défaut
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  const signalAirOptions = useMemo(
    () => ({
      selectedTypes: signalAirSelectedTypes,
      loadTrigger: signalAirLoadTrigger,
      isSourceSelected: isSignalAirEnabled, // Utiliser isSignalAirEnabled au lieu de selectedSources
    }),
    [signalAirSelectedTypes, signalAirLoadTrigger, isSignalAirEnabled],
  );

  useEffect(() => {
    if (!isPollutantSupportedForTimeStep(selectedPollutant, selectedTimeStep)) {
      const supportedPollutants =
        getSupportedPollutantsForTimeStep(selectedTimeStep);
      if (supportedPollutants.length > 0) {
        setSelectedPollutant((current) =>
          supportedPollutants.includes(current)
            ? current
            : supportedPollutants[0],
        );
      }
    }
  }, [selectedPollutant, selectedTimeStep]);

  const modelingKind: ModelingKind = aircrowdWmsEnabled
    ? "aircrowd"
    : currentModelingLayer === "pollutant" &&
        isModelingAvailable(selectedTimeStep)
      ? "azur"
      : "none";

  const timeBarVisible =
    modelingKind !== "none" || isMapInstantAllowedForTimeStep(selectedTimeStep);

  const timeBarWindow = useMemo(
    () =>
      buildTimeBarWindow({
        kind: modelingKind,
        aircrowdMinDate:
          aircrowdAvailability?.minDate ?? aircrowdWmsStartDate,
        aircrowdMaxDate:
          aircrowdAvailability?.maxDate ?? getAirCrowdWmsToday(),
        aircrowdHoursByDate:
          aircrowdAvailability?.byPollutant[selectedPollutant],
        explorationInstant: isExploration ? mapInstant : null,
      }),
    [
      modelingKind,
      aircrowdAvailability,
      aircrowdWmsStartDate,
      selectedPollutant,
      isExploration,
      mapInstant,
    ],
  );

  const defaultAzurHour = getModelingLayerHour(selectedTimeStep);
  const liveSlotIndex =
    modelingKind === "azur" && defaultAzurHour >= 0
      ? defaultAzurHour
      : Math.max(0, timeBarWindow.liveIndex);

  const liveInstant: MapInstant =
    timeBarWindow.slots[liveSlotIndex] ??
    timeBarWindow.slots[timeBarWindow.slots.length - 1] ??
    lastCompletedHourInstant();

  const effectiveInstant: MapInstant =
    isExploration && mapInstant ? mapInstant : liveInstant;

  const modelingHourIndex = useMemo(() => {
    if (modelingKind !== "azur") return null;
    if (!isExploration || !mapInstant) {
      return defaultAzurHour >= 0 ? defaultAzurHour : null;
    }
    return instantToAzurIndex(mapInstant);
  }, [modelingKind, isExploration, mapInstant, defaultAzurHour]);

  const displayedAircrowdDate =
    modelingKind === "aircrowd" ? effectiveInstant.date : aircrowdWmsDate;
  const displayedAircrowdHour =
    modelingKind === "aircrowd" ? effectiveInstant.hour : aircrowdWmsHour;

  useEffect(() => {
    if (!timeBarVisible && isExploration) {
      goLive();
    }
  }, [timeBarVisible, isExploration, goLive]);

  useEffect(() => {
    if (mapInstantMode !== "live" || modelingKind !== "aircrowd") return;
    if (!aircrowdAvailability) return;
    const hours = getAvailableHoursForAirCrowd(
      aircrowdAvailability,
      selectedPollutant,
      aircrowdWmsDate,
    );
    if (hours.length === 0) return;
    const preferredHour = lastCompletedHourInstant().hour;
    if (!hours.includes(aircrowdWmsHour)) {
      const nearest = pickNearestAvailableAirCrowdHour(hours, preferredHour);
      if (nearest !== null) setAircrowdWmsHour(nearest);
    }
  }, [
    mapInstantMode,
    modelingKind,
    aircrowdAvailability,
    selectedPollutant,
    aircrowdWmsDate,
    aircrowdWmsHour,
  ]);

  const timeBarIndex =
    isExploration && mapInstant
      ? findSlotIndex(timeBarWindow.slots, mapInstant)
      : liveSlotIndex;

  const handleTimeBarIndexChange = useCallback(
    (index: number) => {
      const slot = timeBarWindow.slots[index];
      if (!slot) return;
      if (index === liveSlotIndex) {
        goLive();
        return;
      }
      seekTo({ date: slot.date, hour: slot.hour });
      trackFeatureUsage("map_instant_seek", {
        date: slot.date,
        hour: slot.hour,
        kind: modelingKind,
      });
    },
    [timeBarWindow.slots, liveSlotIndex, goLive, seekTo, modelingKind],
  );

  const handleTimeBarGoLive = useCallback(() => {
    goLive();
    trackFeatureUsage("map_instant_live");
  }, [goLive]);

  const handleTimeBarGoToDate = useCallback(
    (date: string) => {
      const next: MapInstant = {
        date,
        hour: effectiveInstant.hour,
      };
      if (modelingKind === "azur") {
        const azurIndex = instantToAzurIndex(next);
        if (azurIndex === null) {
          addToast({
            title: t("timeBar.goToTitle"),
            description: t("timeBar.azurUnavailable"),
            variant: "warning",
          });
          return;
        }
      }
      if (modelingKind === "aircrowd" && aircrowdAvailability) {
        const hours = getAvailableHoursForAirCrowd(
          aircrowdAvailability,
          selectedPollutant,
          date,
        );
        const nearest = pickNearestAvailableAirCrowdHour(hours, next.hour);
        if (nearest !== null) next.hour = nearest;
      }
      seekTo(next);
    },
    [
      effectiveInstant.hour,
      modelingKind,
      aircrowdAvailability,
      selectedPollutant,
      seekTo,
      addToast,
      t,
    ],
  );

  const goToMinDate =
    modelingKind === "none"
      ? minInstantForLookback(selectedTimeStep).date
      : timeBarWindow.minDate;
  const goToMaxDate = timeBarWindow.maxDate;

  const hideMeasurementsForIncompleteAzurHour =
    modelingKind === "azur" &&
    typeof modelingHourIndex === "number" &&
    modelingHourIndex >= 24;

  // Snapshot horaire uniquement en exploration (ou Azur h0–h23).
  // En Live + AirCrowd, /stations/mesures 404 tant que l'heure n'est pas
  // publiée : on garde alors les mesures live (/derniere).
  const hourlySnapshotEnabled =
    !hideMeasurementsForIncompleteAzurHour &&
    ((aircrowdWmsEnabled && isExploration) ||
      (modelingKind === "azur" &&
        typeof modelingHourIndex === "number" &&
        modelingHourIndex < 24) ||
      (modelingKind === "none" && isExploration));

  const {
    devices: normalDevices,
    reports,
    loading,
    error,
    atmoMicroOutage,
    loadingSources,
    lastRefresh,
  } = useAirQualityData({
    selectedPollutant,
    selectedSources,
    selectedTimeStep,
    atmoMicroAllowedSiteIds: domainConfig.atmoMicroAllowedSiteIds,
    signalAirPeriod,
    mobileAirPeriod,
    selectedMobileAirSensor,
    signalAirOptions,
    autoRefreshEnabled:
      autoRefreshEnabled &&
      !hourlySnapshotEnabled &&
      !hideMeasurementsForIncompleteAzurHour,
  });

  const {
    devices: hourlySnapshotDevices,
    loading: hourlySnapshotLoading,
  } = useAirCrowdWmsMeasurements({
    enabled: hourlySnapshotEnabled,
    date: effectiveInstant.date,
    hour: effectiveInstant.hour,
    pollutant: selectedPollutant,
    selectedSources,
    atmoMicroAllowedSiteIds: domainConfig.atmoMicroAllowedSiteIds,
  });

  const [atmoMicroMaintenanceBanner, setAtmoMicroMaintenanceBanner] =
    useState<AtmoMicroMaintenanceBannerConfig>(
      DEFAULT_ATMOMICRO_MAINTENANCE_BANNER,
    );
  const [isAtmoMicroBannerDismissed, setIsAtmoMicroBannerDismissed] =
    useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/maintenance.json", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Configuration maintenance indisponible");
        }
        return response.json() as Promise<MaintenanceConfig>;
      })
      .then((maintenanceConfig) => {
        const bannerConfig = maintenanceConfig.atmoMicroQualifiedSensors;
        setAtmoMicroMaintenanceBanner({
          enabled:
            typeof bannerConfig?.enabled === "boolean"
              ? bannerConfig.enabled
              : DEFAULT_ATMOMICRO_MAINTENANCE_BANNER.enabled,
          message:
            bannerConfig?.message?.trim() ||
            DEFAULT_ATMOMICRO_MAINTENANCE_BANNER.message,
        });
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }
        setAtmoMicroMaintenanceBanner(DEFAULT_ATMOMICRO_MAINTENANCE_BANNER);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!atmoMicroOutage) {
      setIsAtmoMicroBannerDismissed(false);
    }
  }, [atmoMicroOutage]);

  // Priorité : masquage Azur h24+ > snapshot (exploration / AirCrowd / Azur passé) > live
  const devices = hideMeasurementsForIncompleteAzurHour
    ? []
    : hourlySnapshotEnabled
      ? hourlySnapshotDevices
      : normalDevices;

  const reportsForMap = reports;

  const isSignalAirLoading = loadingSources.includes("signalair");
  const hasSignalAirLoaded = signalAirLoadTrigger > 0;

  // Un seul filtre pour les deux usages : le compte affiché dans l'interface de
  // sélection et le drapeau `hasSignalAirData` en dérivaient séparément.
  const signalAirReportsCount = useMemo(
    () => reportsForMap.filter((r) => r.source === "signalair").length,
    [reportsForMap],
  );

  const hasSignalAirData = hasSignalAirLoaded && signalAirReportsCount > 0;
  const hasMobileAirData = devices.some((d) => d.source === "mobileair");

  // Configuration de la carte basée sur le domaine et l'URL
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    INITIAL_APP_URL_PARAMS.lat,
    INITIAL_APP_URL_PARAMS.lng,
  ]);
  const [mapZoom, setMapZoom] = useState<number>(INITIAL_APP_URL_PARAMS.zoom);

  const appUrlDefaults = useMemo(
    () =>
      buildAppUrlDefaults({
        mapCenter: domainConfig.mapCenter,
        mapZoom: domainConfig.mapZoom,
      }),
    [domainConfig.mapCenter, domainConfig.mapZoom],
  );

  const appUrlState = useMemo(
    () => ({
      lat: mapCenter[0],
      lng: mapCenter[1],
      zoom: mapZoom,
      pollutant: selectedPollutant,
      timeStep: selectedTimeStep,
      sources: selectedSources,
    }),
    [mapCenter, mapZoom, selectedPollutant, selectedTimeStep, selectedSources],
  );

  const handlePopStateFromUrl = useCallback((params: AppUrlParams) => {
    setMapCenter([params.lat, params.lng]);
    setMapZoom(params.zoom);
    setSelectedPollutant(params.pollutant);
    setSelectedTimeStep(
      isTimeStepAvailable(params.timeStep) ? params.timeStep : defaultTimeStep
    );
    setSelectedSources(params.sources);
  }, [defaultTimeStep]);

  const { markMapViewTouched } = useAppUrlSync({
    state: appUrlState,
    defaults: appUrlDefaults,
    onPopState: handlePopStateFromUrl,
    initialMapViewTouched: hadMapParamsInInitialUrl,
  });

  const handleMapViewChange = useCallback(
    (center: [number, number], zoom: number) => {
      markMapViewTouched();
      setMapCenter(center);
      setMapZoom(zoom);
    },
    [markMapViewTouched],
  );

  const handleOpenInfoModal = useCallback(() => setIsInfoModalOpen(true), []);

  const headerDisabled = isExploration;

  // ── Valeur du contexte de contrôles de carte ──────────────────────────────
  // Mémoïsée par groupe, et non d'un bloc : hasSignalAirData / hasMobileAirData
  // se recalculent à chaque rafraîchissement de données, et invalideraient
  // sinon `filters` — donc le rail entier — à chaque poll.
  const brandValue = useMemo<MapControlsBrand>(
    () => ({
      logo: domainConfig.logo,
      markSquare: domainConfig.markSquare,
      favicon: domainConfig.favicon,
      title: domainConfig.title,
      organization: domainConfig.organization,
      logoHref: domainConfig.links.logo,
    }),
    [
      domainConfig.logo,
      domainConfig.markSquare,
      domainConfig.favicon,
      domainConfig.title,
      domainConfig.organization,
      domainConfig.links.logo,
    ],
  );

  const filtersValue = useMemo<MapControlsFilters>(
    () => ({
      selectedPollutant,
      selectedSources,
      selectedTimeStep,
      onPollutantChange: handlePollutantChange,
      onSourceChange: handleSourceChange,
      onTimeStepChange: handleTimeStepChange,
    }),
    [
      selectedPollutant,
      selectedSources,
      selectedTimeStep,
      handlePollutantChange,
      handleSourceChange,
      handleTimeStepChange,
    ],
  );

  const modelingValue = useMemo<MapControlsModeling>(
    () => ({
      currentModelingLayer,
      onModelingLayerChange: handleModelingLayerChange,
      modelingHourIndex,
      locale: i18n.language,
    }),
    [
      currentModelingLayer,
      handleModelingLayerChange,
      modelingHourIndex,
      i18n.language,
    ],
  );

  const airCrowdWmsValue = useMemo<MapControlsAirCrowdWms>(
    () => ({
      featureEnabled: Boolean(domainConfig.aircrowdWmsEnabled),
      startDate: aircrowdWmsStartDate,
      enabled: aircrowdWmsEnabled,
      onEnabledChange: handleAircrowdWmsEnabledChange,
      date: displayedAircrowdDate,
      onDateChange: handleAircrowdWmsDateChange,
      hour: displayedAircrowdHour,
      onHourChange: handleAircrowdWmsHourChange,
    }),
    [
      domainConfig.aircrowdWmsEnabled,
      aircrowdWmsStartDate,
      aircrowdWmsEnabled,
      handleAircrowdWmsEnabledChange,
      displayedAircrowdDate,
      handleAircrowdWmsDateChange,
      displayedAircrowdHour,
      handleAircrowdWmsHourChange,
    ],
  );

  const refreshValue = useMemo<MapControlsRefresh>(
    () => ({
      autoRefreshEnabled: autoRefreshEnabled && !isExploration,
      onToggleAutoRefresh: handleAutoRefreshToggle,
      loading,
      lastRefresh,
    }),
    [
      autoRefreshEnabled,
      isExploration,
      handleAutoRefreshToggle,
      loading,
      lastRefresh,
    ],
  );

  const historicalValue = useMemo<MapControlsHistorical>(
    () => ({
      isActive: isExploration,
      isAllowed: false,
      onToggle: goLive,
    }),
    [isExploration, goLive],
  );

  const explorationRange = isExploration
    ? buildAirCrowdWmsHourWindow(effectiveInstant.date, effectiveInstant.hour)
    : null;

  const timeBarValue = useMemo<MapControlsTimeBar>(
    () => ({
      visible: timeBarVisible,
      mode: mapInstantMode,
      slots: timeBarWindow.slots,
      index: timeBarIndex,
      liveIndex: timeBarWindow.liveIndex,
      showForecastZone: timeBarWindow.showForecastZone,
      minDate: goToMinDate,
      maxDate: goToMaxDate,
      selectedPollutant,
      loading: hourlySnapshotLoading,
      onIndexChange: handleTimeBarIndexChange,
      onGoLive: handleTimeBarGoLive,
      onGoToDate: handleTimeBarGoToDate,
    }),
    [
      timeBarVisible,
      mapInstantMode,
      timeBarWindow.slots,
      timeBarWindow.showForecastZone,
      timeBarIndex,
      timeBarWindow.liveIndex,
      goToMinDate,
      goToMaxDate,
      selectedPollutant,
      hourlySnapshotLoading,
      handleTimeBarIndexChange,
      handleTimeBarGoLive,
      handleTimeBarGoToDate,
    ],
  );

  const communitySourcesValue = useMemo<MapControlsCommunitySources>(
    () => ({
      isSignalAirEnabled,
      isMobileAirEnabled,
      onSignalAirEnabledChange: handleSignalAirEnabledChange,
      onMobileAirEnabledChange: handleMobileAirEnabledChange,
      isSignalAirVisible,
      isMobileAirVisible,
      onSignalAirToggle: handleSignalAirVisibilityToggle,
      onMobileAirToggle: handleMobileAirVisibilityToggle,
      hasSignalAirData,
      hasMobileAirData,
      signalAirSelectedTypes,
      onSignalAirTypesChange: handleSignalAirTypesChange,
      signalAirDraftPeriod,
      onSignalAirDraftPeriodChange: handleSignalAirDraftPeriodChange,
      onSignalAirLoadRequest: handleSignalAirLoadRequest,
      isSignalAirLoading,
      signalAirHasLoaded: hasSignalAirLoaded,
      signalAirReportsCount,
    }),
    [
      isSignalAirEnabled,
      isMobileAirEnabled,
      handleSignalAirEnabledChange,
      handleMobileAirEnabledChange,
      isSignalAirVisible,
      isMobileAirVisible,
      handleSignalAirVisibilityToggle,
      handleMobileAirVisibilityToggle,
      hasSignalAirData,
      hasMobileAirData,
      signalAirSelectedTypes,
      handleSignalAirTypesChange,
      signalAirDraftPeriod,
      handleSignalAirDraftPeriodChange,
      handleSignalAirLoadRequest,
      isSignalAirLoading,
      hasSignalAirLoaded,
      signalAirReportsCount,
    ],
  );

  const shouldShowAtmoMicroOutageBanner =
    selectedSources.includes("atmoMicro") &&
    atmoMicroOutage &&
    atmoMicroMaintenanceBanner.enabled &&
    !isAtmoMicroBannerDismissed;

  // Notices de niveau application, transmises à la pile unique de la carte.
  // Elles étaient auparavant trois blocs absolus distincts posés dans <main>,
  // dont deux se superposaient à `top-4 right-4`.
  const appNotices = useMemo<Notice[]>(
    () =>
      compactNotices([
        shouldShowAtmoMicroOutageBanner && {
          id: "atmomicro-maintenance",
          tone: "warn" as const,
          message: atmoMicroMaintenanceBanner.message,
          onDismiss: () => setIsAtmoMicroBannerDismissed(true),
          dismissLabel: t("common.close"),
        },
        loading && {
          id: "loading",
          tone: "info" as const,
          busy: true,
          message:
            devices.length === 0
              ? t("common.loadingData")
              : t("common.updating"),
          detail:
            loadingSources.length > 0
              ? `${t("common.sourcesCount", {
                  count: loadingSources.length,
                })} (${loadingSources.slice(0, 2).join(", ")}${
                  loadingSources.length > 2 ? "…" : ""
                })`
              : undefined,
        },
        error && {
          id: "data-error",
          tone: "error" as const,
          message: `${t("common.error")} : ${error}`,
        },
      ]),
    [
      shouldShowAtmoMicroOutageBanner,
      atmoMicroMaintenanceBanner.message,
      loading,
      devices.length,
      loadingSources,
      error,
      t,
    ],
  );

  const uiValue = useMemo<MapControlsUi>(
    () => ({
      controlsLocked: headerDisabled,
      onOpenInfoModal: handleOpenInfoModal,
      onToast: addToast,
      notices: appNotices,
    }),
    [headerDisabled, handleOpenInfoModal, addToast, appNotices],
  );

  const mapControlsValue = useMemo<MapControlsValue>(
    () => ({
      brand: brandValue,
      filters: filtersValue,
      modeling: modelingValue,
      airCrowdWms: airCrowdWmsValue,
      refresh: refreshValue,
      historical: historicalValue,
      timeBar: timeBarValue,
      communitySources: communitySourcesValue,
      ui: uiValue,
    }),
    [
      brandValue,
      filtersValue,
      modelingValue,
      airCrowdWmsValue,
      refreshValue,
      historicalValue,
      timeBarValue,
      communitySourcesValue,
      uiValue,
    ],
  );
  return (
    <div className="flex h-screen flex-col overflow-x-hidden bg-gray-50">
      {/* Lien d'évitement : premier élément focusable pour la navigation clavier et lecteurs d'écran */}
      <a href="#main-content" className="skip-link" data-testid="skip-link">
        {t("app.skipToContent")}
      </a>

      <AboutPanel domainConfig={domainConfig} />

      {/* Carte en plein écran */}
      {/* `id="main-content"` vit désormais sur la colonne carte, dans
          AirQualityMap : le rail étant le premier élément de <main>, le lien
          d'évitement aurait déposé l'utilisateur AVANT lui, sans rien sauter. */}
      {/* `min-h-0` : sans lui, `flex-1` garde le `min-height: auto` par défaut
          des éléments flex et <main> peut donc DÉPASSER sa part de la colonne
          `h-screen`. Un panneau latéral plus haut que le viewport faisait alors
          grandir <main>, rendant toute la page défilante au lieu de laisser le
          panneau défiler dans sa propre zone. */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden">
        {/* Carte */}
        {/* Le provider n'enveloppe que la carte : AirQualityMap ne gagne aucune
            prop, et le rail de contrôles qui vit dans sa colonne lit l'état
            applicatif par contexte au lieu d'un troisième chemin de props. */}
        <MapControlsProvider value={mapControlsValue}>
          <AirQualityMap
            devices={devices}
            reports={reportsForMap}
            center={mapCenter}
            zoom={mapZoom}
            minZoom={domainConfig.mapMinZoom}
            maxZoom={domainConfig.mapMaxZoom}
            maxBounds={domainConfig.mapMaxBounds}
            mapBounds={domainConfig.mapBounds}
            onMapViewChange={handleMapViewChange}
            selectedPollutant={selectedPollutant}
            selectedSources={selectedSources}
            selectedTimeStep={selectedTimeStep}
            currentModelingLayer={currentModelingLayer}
            modelingHourIndex={modelingHourIndex}
            aircrowdWmsEnabled={aircrowdWmsEnabled}
            aircrowdWmsDate={displayedAircrowdDate}
            aircrowdWmsHour={displayedAircrowdHour}
            shouldOverrideDisplayedPeriod={hourlySnapshotEnabled || isExploration}
            loading={loading || hourlySnapshotLoading}
            signalAirPeriod={signalAirDraftPeriod}
            signalAirSelectedTypes={signalAirSelectedTypes}
            onSignalAirPeriodChange={handleSignalAirDraftPeriodChange}
            onSignalAirTypesChange={handleSignalAirTypesChange}
            isSignalAirLoading={isSignalAirLoading}
            signalAirHasLoaded={hasSignalAirLoaded}
            signalAirReportsCount={signalAirReportsCount}
            isHistoricalModeWithSignalAirData={false}
            onSignalAirSourceDeselected={handleSignalAirSourceDeselected}
            onMobileAirSensorSelected={handleMobileAirSensorSelected}
            onMobileAirSourceDeselected={handleMobileAirSourceDeselected}
            isHistoricalModeActive={false}
            isSignalAirEnabled={isSignalAirEnabled}
            isMobileAirEnabled={isMobileAirEnabled}
            isSignalAirVisible={isSignalAirVisible}
            isMobileAirVisible={isMobileAirVisible}
            onSignalAirToggle={handleSignalAirVisibilityToggle}
            onMobileAirToggle={handleMobileAirVisibilityToggle}
            historicalCurrentDate={
              isExploration ? effectiveInstant.date : undefined
            }
            historicalStartDate={explorationRange?.startDate}
            historicalEndDate={explorationRange?.endDate}
            historicalTimeStep={isExploration ? "heure" : undefined}
            historicalPlaybackDate={
              isExploration
                ? new Date(
                    effectiveInstant.date +
                      "T" +
                      String(effectiveInstant.hour).padStart(2, "0") +
                      ":00:00",
                  ).toISOString()
                : undefined
            }
            isHistoricalDatePanelVisible={false}
          />
        </MapControlsProvider>
      </main>

      <InformationModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        domainConfig={domainConfig}
      />

      {/* Conteneur de notifications toast */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <GlobalAppTourController />
    </div>
  );
};

const App: React.FC = () => (
  <FeatureTourProvider>
    <AppContent />
  </FeatureTourProvider>
);

export default App;
