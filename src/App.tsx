'use client';

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
  MapControlsRefresh,
  MapControlsCommunitySources,
  MapControlsTimeBar,
  MapControlsUi,
  MapControlsValue,
} from "./contexts/mapControlsContext";
import { useAirQualityData } from "./hooks/useAirQualityData";
import { useMapInstant } from "./hooks/useMapInstant";
import { useInstantSnapshot } from "./hooks/useInstantSnapshot";
import { useDomainConfig } from "./hooks/useDomainConfig";
import {
  isPollutantSupportedForTimeStep,
  getSupportedPollutantsForTimeStep,
} from "./constants/pollutants";
import {
  pasDeTemps,
} from "./constants/timeSteps";
import { resolveDomainConfig } from "./lib/domain";
import {
  buildAppUrlDefaults,
  parseAppUrlParams,
  AppUrlParams,
} from "./utils/appUrlParams";
import { useAppUrlSync } from "./hooks/useAppUrlSync";
import InformationModal from "./components/modals/InformationModal";
import { ModelingLayerType } from "./constants/mapLayers";
import {
  getModelingLayerHour,
  isModelingAvailable,
} from "./services/ModelingLayerService";
import {
  adjacentInstantBeyondSlots,
  buildChartRangeAroundInstant,
  buildTimeBarWindow,
  clampInstant,
  findSlotIndex,
  formatBlockRangeLabel,
  getTimeBarGoToMinInstant,
  instantToAzurIndex,
  instantToIsoLocal,
  isInstantInSlotRange,
  isMapInstantAllowedForTimeStep,
  lastCompletedSlotInstant,
  normalizeInstant,
  TIME_BAR_GO_TO_MIN_DATE,
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
import HistoricalModeTourController from "./components/tour/HistoricalModeTourController";
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
  const domainConfig = resolveDomainConfig(window.location.hostname);
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
  // Configuration basée sur le domaine (metadata SEO gérée côté Next serveur)
  const domainConfig = useDomainConfig();

  // Hook pour les notifications toast
  const { toasts, addToast, removeToast } = useToast();

  // Trouver le pas de temps activé par défaut (calculé une seule fois)
  const defaultTimeStep = useMemo(() => {
    const defaultTimeStep = Object.entries(pasDeTemps).find(
      ([_, timeStep]) => timeStep.activated,
    );
    return defaultTimeStep ? defaultTimeStep[0] : "heure";
  }, []);

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
    setSelectedTimeStep(timeStep);
    trackFeatureUsage("time_step_change", { timeStep });
  }, []);

  const handleModelingLayerChange = useCallback(
    (layer: ModelingLayerType | null) => {
      setCurrentModelingLayer(layer);
      trackFeatureUsage("modeling_layer_change", { layer: layer ?? "none" });
    },
    [],
  );

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

  const {
    mode: mapInstantMode,
    instant: mapInstant,
    isExploration,
    goLive,
    seekTo,
  } = useMapInstant();
  const [timeBarPlaying, setTimeBarPlaying] = useState(false);

  const isTimeBarAllowed = isMapInstantAllowedForTimeStep(selectedTimeStep);

  const modelingKind: ModelingKind =
    currentModelingLayer === "pollutant" &&
    isModelingAvailable(selectedTimeStep)
      ? "azur"
      : "none";

  const timeBarVisible = isTimeBarAllowed;
  const includeForecast = modelingKind === "azur";
  const liveInstant = useMemo(
    () => lastCompletedSlotInstant(selectedTimeStep),
    [selectedTimeStep],
  );
  const [blockFocus, setBlockFocus] = useState<MapInstant | null>(null);

  const windowFocus =
    isExploration && blockFocus ? blockFocus : liveInstant;

  const timeBarWindow = useMemo(
    () =>
      buildTimeBarWindow({
        kind: modelingKind,
        timeStep: selectedTimeStep,
        focus: windowFocus,
      }),
    [
      modelingKind,
      selectedTimeStep,
      windowFocus.date,
      windowFocus.hour,
      windowFocus.minute,
    ],
  );

  const defaultAzurHour = getModelingLayerHour(selectedTimeStep);
  const liveSlotIndex = timeBarWindow.liveIndex;

  const effectiveInstant: MapInstant =
    isExploration && mapInstant ? mapInstant : liveInstant;

  useEffect(() => {
    if (!isExploration) {
      setBlockFocus(null);
      return;
    }
    if (!mapInstant) return;

    if (!blockFocus) {
      setBlockFocus(liveInstant);
      return;
    }

    if (
      !isInstantInSlotRange(
        mapInstant,
        timeBarWindow.slots,
        selectedTimeStep,
      )
    ) {
      setBlockFocus(mapInstant);
    }
  }, [
    isExploration,
    mapInstant,
    blockFocus,
    timeBarWindow.slots,
    selectedTimeStep,
    liveInstant,
  ]);

  useEffect(() => {
    if (!isExploration || !mapInstant) return;
    setBlockFocus(normalizeInstant(mapInstant, selectedTimeStep));
    // Recentrer le bloc quand le pas de temps change, pas à chaque cran.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedTimeStep only
  }, [selectedTimeStep]);

  const modelingHourIndex = useMemo(() => {
    if (modelingKind !== "azur") return undefined;
    if (!isExploration || !mapInstant) {
      return defaultAzurHour >= 0 ? defaultAzurHour : undefined;
    }
    return instantToAzurIndex(mapInstant);
  }, [modelingKind, isExploration, mapInstant, defaultAzurHour]);

  const azurUnavailable =
    modelingKind === "azur" &&
    isExploration &&
    modelingHourIndex === null;

  useEffect(() => {
    if (!timeBarVisible && isExploration) {
      goLive();
    }
  }, [timeBarVisible, isExploration, goLive]);

  const timeBarIndex =
    isExploration && mapInstant
      ? findSlotIndex(timeBarWindow.slots, mapInstant)
      : Math.max(0, liveSlotIndex);

  const handleTimeBarIndexChange = useCallback(
    (index: number) => {
      const slot = timeBarWindow.slots[index];
      if (!slot) return;
      if (liveSlotIndex >= 0 && index === liveSlotIndex) {
        goLive();
        return;
      }
      seekTo(slot, selectedTimeStep);
      trackFeatureUsage("map_instant_seek", {
        date: slot.date,
        hour: slot.hour,
        minute: slot.minute,
        timeStep: selectedTimeStep,
      });
    },
    [timeBarWindow.slots, liveSlotIndex, goLive, seekTo, selectedTimeStep],
  );

  const handleTimeBarGoLive = useCallback(() => {
    goLive();
    trackFeatureUsage("map_instant_live");
  }, [goLive]);

  const handleTimeBarGoToDate = useCallback(
    (date: string) => {
      const next = clampInstant(
        normalizeInstant(
          {
            date,
            hour: effectiveInstant.hour,
            minute: effectiveInstant.minute,
          },
          selectedTimeStep,
        ),
        getTimeBarGoToMinInstant(selectedTimeStep),
        liveInstant,
        selectedTimeStep,
      );
      if (
        next.date === liveInstant.date &&
        next.hour === liveInstant.hour &&
        (next.minute ?? 0) === (liveInstant.minute ?? 0)
      ) {
        goLive();
        return;
      }
      setBlockFocus(next);
      seekTo(next, selectedTimeStep);
      trackFeatureUsage("map_instant_seek", {
        date: next.date,
        hour: next.hour,
        minute: next.minute,
        timeStep: selectedTimeStep,
      });
    },
    [
      effectiveInstant.hour,
      effectiveInstant.minute,
      selectedTimeStep,
      liveInstant,
      goLive,
      seekTo,
    ],
  );

  const handleTimeBarSeekBeyond = useCallback(
    (direction: "past" | "future") => {
      const next = adjacentInstantBeyondSlots(
        timeBarWindow.slots,
        direction,
        selectedTimeStep,
        new Date(),
        includeForecast,
      );
      if (!next) return;
      if (
        liveSlotIndex >= 0 &&
        next.date === liveInstant.date &&
        next.hour === liveInstant.hour &&
        (next.minute ?? 0) === (liveInstant.minute ?? 0)
      ) {
        goLive();
        return;
      }
      setBlockFocus(next);
      seekTo(next, selectedTimeStep);
    },
    [
      timeBarWindow.slots,
      selectedTimeStep,
      includeForecast,
      liveSlotIndex,
      liveInstant,
      goLive,
      seekTo,
    ],
  );

  const handleTimeBarPlayingChange = useCallback((playing: boolean) => {
    setTimeBarPlaying(playing);
  }, []);

  const currentSlot = timeBarWindow.slots[timeBarIndex];
  const hideMeasurementsForForecast = currentSlot?.kind === "forecast";

  const snapshotEnabled =
    timeBarVisible && isExploration && !hideMeasurementsForForecast;

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
    signalAirPeriod,
    mobileAirPeriod,
    selectedMobileAirSensor,
    signalAirOptions,
    autoRefreshEnabled: autoRefreshEnabled && !isExploration,
  });

  const {
    devices: snapshotDevices,
    reports: snapshotReports,
    loading: snapshotLoading,
    error: snapshotError,
  } = useInstantSnapshot({
    enabled: snapshotEnabled,
    instant: effectiveInstant,
    timeStep: selectedTimeStep,
    pollutant: selectedPollutant,
    selectedSources,
    signalAirEnabled: isSignalAirEnabled,
    signalAirSelectedTypes,
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

  const devices = hideMeasurementsForForecast
    ? []
    : snapshotEnabled
      ? snapshotDevices
      : normalDevices;

  const reportsForMap = useMemo(() => {
    if (hideMeasurementsForForecast) return [];
    if (snapshotEnabled) return snapshotReports;
    return reports;
  }, [
    hideMeasurementsForForecast,
    snapshotEnabled,
    snapshotReports,
    reports,
  ]);

  const isSignalAirLoading =
    loadingSources.includes("signalair") ||
    (snapshotEnabled && isSignalAirEnabled && snapshotLoading);
  const hasSignalAirLoaded =
    signalAirLoadTrigger > 0 ||
    (snapshotEnabled && snapshotReports.length > 0);

  const signalAirReportsCount = useMemo(
    () => reportsForMap.filter((r) => r.source === "signalair").length,
    [reportsForMap],
  );

  const hasSignalAirData = hasSignalAirLoaded && signalAirReportsCount > 0;
  const hasMobileAirData = devices.some((d) => d.source === "mobileair");

  useEffect(() => {
    if (snapshotEnabled && snapshotReports.length > 0) {
      setIsSignalAirVisible(true);
    }
  }, [snapshotEnabled, snapshotReports.length]);

  const chartRange = useMemo(() => {
    if (!isExploration) return null;
    return buildChartRangeAroundInstant(windowFocus, selectedTimeStep);
  }, [isExploration, windowFocus, selectedTimeStep]);

  const historicalCurrentIso = isExploration
    ? instantToIsoLocal(effectiveInstant)
    : undefined;

  const mapDataError = snapshotEnabled ? snapshotError ?? error : error;
  const mapLoading = snapshotEnabled
    ? snapshotLoading
    : loading;

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
    setSelectedTimeStep(params.timeStep);
    setSelectedSources(params.sources);
  }, []);

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

  const headerDisabled = timeBarPlaying;

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
    }),
    [
      domainConfig.logo,
      domainConfig.markSquare,
      domainConfig.favicon,
      domainConfig.title,
      domainConfig.organization,
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
    }),
    [currentModelingLayer, handleModelingLayerChange],
  );

  const refreshValue = useMemo<MapControlsRefresh>(
    () => ({
      autoRefreshEnabled: autoRefreshEnabled && !isExploration,
      onToggleAutoRefresh: handleAutoRefreshToggle,
      loading: mapLoading,
      lastRefresh,
    }),
    [
      autoRefreshEnabled,
      isExploration,
      handleAutoRefreshToggle,
      mapLoading,
      lastRefresh,
    ],
  );

  const historicalValue = useMemo<MapControlsHistorical>(
    () => ({
      isActive: timeBarPlaying,
      isAllowed: isTimeBarAllowed,
      onToggle: goLive,
    }),
    [timeBarPlaying, isTimeBarAllowed, goLive],
  );

  const timeBarValue = useMemo<MapControlsTimeBar>(
    () => ({
      visible: timeBarVisible,
      mode: mapInstantMode,
      slots: timeBarWindow.slots,
      index: timeBarIndex,
      liveIndex: timeBarWindow.liveIndex,
      showForecastZone: timeBarWindow.showForecastZone,
      minDate: TIME_BAR_GO_TO_MIN_DATE,
      maxDate: liveInstant.date,
      blockRangeLabel: formatBlockRangeLabel(
        timeBarWindow.startInstant,
        timeBarWindow.endInstant,
        i18n.language,
      ),
      canSeekPast:
        adjacentInstantBeyondSlots(
          timeBarWindow.slots,
          "past",
          selectedTimeStep,
          undefined,
          includeForecast,
        ) !== null,
      canSeekFuture:
        adjacentInstantBeyondSlots(
          timeBarWindow.slots,
          "future",
          selectedTimeStep,
          undefined,
          includeForecast,
        ) !== null,
      selectedPollutant,
      timeStep: selectedTimeStep,
      loading: snapshotLoading,
      onIndexChange: handleTimeBarIndexChange,
      onGoLive: handleTimeBarGoLive,
      onGoToDate: handleTimeBarGoToDate,
      onSeekBeyond: handleTimeBarSeekBeyond,
      onPlayingChange: handleTimeBarPlayingChange,
    }),
    [
      timeBarVisible,
      mapInstantMode,
      timeBarWindow.slots,
      timeBarWindow.liveIndex,
      timeBarWindow.showForecastZone,
      timeBarWindow.startInstant,
      timeBarWindow.endInstant,
      timeBarIndex,
      liveInstant.date,
      i18n.language,
      selectedTimeStep,
      includeForecast,
      selectedPollutant,
      snapshotLoading,
      handleTimeBarIndexChange,
      handleTimeBarGoLive,
      handleTimeBarGoToDate,
      handleTimeBarSeekBeyond,
      handleTimeBarPlayingChange,
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
        mapLoading && {
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
        azurUnavailable && {
          id: "azur-unavailable",
          tone: "neutral" as const,
          message: t("timeBar.azurUnavailable"),
        },
        mapDataError && {
          id: "data-error",
          tone: "error" as const,
          message: `${t("common.error")} : ${mapDataError}`,
        },
      ]),
    [
      shouldShowAtmoMicroOutageBanner,
      atmoMicroMaintenanceBanner.message,
      mapLoading,
      devices.length,
      loadingSources,
      azurUnavailable,
      mapDataError,
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
      refreshValue,
      historicalValue,
      timeBarValue,
      communitySourcesValue,
      uiValue,
    ],
  );
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Lien d'évitement : premier élément focusable pour la navigation clavier et lecteurs d'écran */}
      <a href="#main-content" className="skip-link" data-testid="skip-link">
        {t("app.skipToContent")}
      </a>

      {/* Carte en plein écran */}
      {/* `id="main-content"` vit désormais sur la colonne carte, dans
          AirQualityMap : le rail étant le premier élément de <main>, le lien
          d'évitement aurait déposé l'utilisateur AVANT lui, sans rien sauter. */}
      {/* `min-h-0` : sans lui, `flex-1` garde le `min-height: auto` par défaut
          des éléments flex et <main> peut donc DÉPASSER sa part de la colonne
          `h-screen`. Un panneau latéral plus haut que le viewport faisait alors
          grandir <main>, rendant toute la page défilante au lieu de laisser le
          panneau défiler dans sa propre zone. */}
      <main className="flex-1 relative min-h-0">
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
            mapBounds={domainConfig.mapBounds}
            onMapViewChange={handleMapViewChange}
            selectedPollutant={selectedPollutant}
            selectedSources={selectedSources}
            selectedTimeStep={selectedTimeStep}
            currentModelingLayer={currentModelingLayer}
            modelingHourIndex={modelingHourIndex}
            loading={mapLoading}
            signalAirPeriod={signalAirDraftPeriod}
            signalAirSelectedTypes={signalAirSelectedTypes}
            onSignalAirPeriodChange={handleSignalAirDraftPeriodChange}
            onSignalAirTypesChange={handleSignalAirTypesChange}
            isSignalAirLoading={isSignalAirLoading}
            signalAirHasLoaded={hasSignalAirLoaded}
            signalAirReportsCount={signalAirReportsCount}
            isHistoricalModeWithSignalAirData={
              snapshotEnabled && snapshotReports.length > 0
            }
            onSignalAirSourceDeselected={handleSignalAirSourceDeselected}
            onMobileAirSensorSelected={handleMobileAirSensorSelected}
            onMobileAirSourceDeselected={handleMobileAirSourceDeselected}
            isHistoricalModeActive={isExploration}
            isSignalAirEnabled={isSignalAirEnabled}
            isMobileAirEnabled={isMobileAirEnabled}
            isSignalAirVisible={isSignalAirVisible}
            isMobileAirVisible={isMobileAirVisible}
            onSignalAirToggle={handleSignalAirVisibilityToggle}
            onMobileAirToggle={handleMobileAirVisibilityToggle}
            historicalCurrentDate={historicalCurrentIso}
            historicalStartDate={chartRange?.startDate}
            historicalEndDate={chartRange?.endDate}
            historicalTimeStep={isExploration ? selectedTimeStep : undefined}
            historicalPlaybackDate={historicalCurrentIso}
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

      <HistoricalModeTourController
        isHistoricalModeAllowed={isTimeBarAllowed}
      />
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
