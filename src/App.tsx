'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
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
import { MAX_MOBILE_AIR_SENSORS } from "./constants/mobileAir";
import {
  formatMobileAirPeriodRange,
  getMobileAirMapPeriod,
} from "./utils/mobileAirPeriodUtils";
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
  buildSnapshotBufferWindow,
  buildTimeBarWindow,
  clampCustomRange,
  clampInstant,
  compareInstants,
  findSlotIndex,
  formatExpandConfirmLabel,
  instantToAzurIndex,
  instantToIsoLocal,
  isInstantInSlotRange,
  isMapInstantAllowedForTimeStep,
  lastCompletedSlotInstant,
  normalizeInstant,
  proposeExpandedRange,
  TIME_BAR_GO_TO_MIN_DATE,
  type MapInstant,
  type ModelingKind,
  type TimeBarCustomRange,
} from "./utils/mapInstant";
import { filterReportsByDisplayWindow } from "./utils/signalAirDateUtils";
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

  // Période par défaut MobileAir (SignalAir suit désormais la TimeBar)
  const defaultMobileAirPeriod = useMemo(() => {
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
  const [signalAirSelectedTypes, setSignalAirSelectedTypes] = useState<
    string[]
  >(SIGNAL_AIR_DEFAULT_TYPES);
  const [signalAirFetchToken, setSignalAirFetchToken] = useState(0);
  const [signalAirFetchedTypes, setSignalAirFetchedTypes] = useState<string[]>(
    [],
  );
  const [currentModelingLayer, setCurrentModelingLayer] =
    useState<ModelingLayerType | null>(null);

  const resetSignalAirSettings = useCallback(() => {
    setSignalAirSelectedTypes([...SIGNAL_AIR_DEFAULT_TYPES]);
    setSignalAirFetchToken(0);
    setSignalAirFetchedTypes([]);
  }, [SIGNAL_AIR_DEFAULT_TYPES]);

  // États pour MobileAir (multi-capteurs, max 5)
  const [mobileAirPeriod, setMobileAirPeriod] = useState(
    defaultMobileAirPeriod,
  );
  const [selectedMobileAirSensors, setSelectedMobileAirSensors] = useState<
    string[]
  >([]);
  const [mobileAirSensorPeriods, setMobileAirSensorPeriods] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({});
  const [mobileAirSensorVisibility, setMobileAirSensorVisibility] = useState<
    Record<string, boolean>
  >({});
  const [mobileAirPartialRefetchSensors, setMobileAirPartialRefetchSensors] =
    useState<string[]>([]);
  const [mobileAirPartialRefetchToken, setMobileAirPartialRefetchToken] =
    useState(0);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // États pour gérer SignalAir et MobileAir indépendamment du système de sources
  const [isSignalAirEnabled, setIsSignalAirEnabled] = useState(false);
  const [isMobileAirEnabled, setIsMobileAirEnabled] = useState(false);
  const [isSignalAirVisible, setIsSignalAirVisible] = useState(true);
  const [isMobileAirVisible, setIsMobileAirVisible] = useState(true);

  /** Snapshot des sources classiques au passage en mode mobilité (restauration à la sortie). */
  type MobilitySnapshot = {
    selectedSources: string[];
    isSignalAirEnabled: boolean;
    signalAirSelectedTypes: string[];
    isSignalAirVisible: boolean;
  };
  const mobilitySnapshotRef = useRef<MobilitySnapshot | null>(null);
  const mobilityToastShownRef = useRef(false);

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

  const clearMobileAirState = useCallback(() => {
    setSelectedMobileAirSensors([]);
    setMobileAirPeriod(defaultMobileAirPeriod);
    setMobileAirSensorPeriods({});
    setMobileAirSensorVisibility({});
    setMobileAirPartialRefetchSensors([]);
    setIsMobileAirEnabled(false);
    setIsMobileAirVisible(false);
  }, [defaultMobileAirPeriod]);

  const captureMobilitySnapshotIfNeeded = useCallback(() => {
    if (mobilitySnapshotRef.current) return;
    mobilitySnapshotRef.current = {
      selectedSources: [...selectedSources],
      isSignalAirEnabled,
      signalAirSelectedTypes: [...signalAirSelectedTypes],
      isSignalAirVisible,
    };
    if (!mobilityToastShownRef.current) {
      mobilityToastShownRef.current = true;
      addToast({
        title: t("toast.mobilityModeTitle"),
        description: t("toast.mobilityModeDescription"),
        variant: "info",
      });
    }
  }, [
    selectedSources,
    isSignalAirEnabled,
    signalAirSelectedTypes,
    isSignalAirVisible,
    addToast,
    t,
  ]);

  const restoreMobilitySnapshot = useCallback(() => {
    const snapshot = mobilitySnapshotRef.current;
    mobilitySnapshotRef.current = null;
    mobilityToastShownRef.current = false;
    if (!snapshot) return;
    setSelectedSources(snapshot.selectedSources);
    setIsSignalAirEnabled(snapshot.isSignalAirEnabled);
    setSignalAirSelectedTypes(snapshot.signalAirSelectedTypes);
    setIsSignalAirVisible(snapshot.isSignalAirVisible);
  }, []);

  /** Sortie du mode mobilité en réactivant une source classique grisée. */
  const handleExitMobilityModeViaSource = useCallback(
    (sourceCode: string | string[]) => {
      const codes = Array.isArray(sourceCode) ? sourceCode : [sourceCode];
      const snapshot = mobilitySnapshotRef.current;
      clearMobileAirState();
      mobilitySnapshotRef.current = null;
      mobilityToastShownRef.current = false;
      const base = snapshot?.selectedSources ?? selectedSources;
      let next = [...base];
      for (const code of codes) {
        if (!next.includes(code)) next.push(code);
      }
      setSelectedSources(next);
      if (snapshot) {
        setIsSignalAirEnabled(snapshot.isSignalAirEnabled);
        setSignalAirSelectedTypes(snapshot.signalAirSelectedTypes);
        setIsSignalAirVisible(snapshot.isSignalAirVisible);
      }
      trackFeatureUsage("mobility_mode_exit_source", {
        source: codes.join(","),
      });
    },
    [clearMobileAirState, selectedSources],
  );

  const handleExitMobilityModeViaSignalAir = useCallback(() => {
    const snapshot = mobilitySnapshotRef.current;
    clearMobileAirState();
    mobilitySnapshotRef.current = null;
    mobilityToastShownRef.current = false;
    if (snapshot) {
      setSelectedSources(snapshot.selectedSources);
      setSignalAirSelectedTypes(
        snapshot.signalAirSelectedTypes.length > 0
          ? snapshot.signalAirSelectedTypes
          : [...SIGNAL_AIR_DEFAULT_TYPES],
      );
      setIsSignalAirVisible(true);
    }
    setIsSignalAirEnabled(true);
    setSignalAirFetchToken((prev) => prev + 1);
    trackFeatureUsage("mobility_mode_exit_signalair");
  }, [clearMobileAirState, SIGNAL_AIR_DEFAULT_TYPES]);

  const isMobileAirMobilityMode = selectedMobileAirSensors.length > 0;

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

  // Chargement multi-capteurs MobileAir (remplace l'ensemble précédent)
  const handleMobileAirSensorsSelected = (
    sensorIds: string[],
    period: { startDate: string; endDate: string },
  ) => {
    const limited = sensorIds.slice(0, MAX_MOBILE_AIR_SENSORS);
    if (limited.length === 0) return;
    captureMobilitySnapshotIfNeeded();
    const visibility: Record<string, boolean> = {};
    const periods: Record<string, { startDate: string; endDate: string }> = {};
    for (const id of limited) {
      visibility[id] = true;
      periods[id] = period;
    }
    setSelectedMobileAirSensors(limited);
    setMobileAirPeriod(period);
    setMobileAirSensorPeriods(periods);
    setMobileAirSensorVisibility(visibility);
    setMobileAirPartialRefetchSensors([]);
    setIsMobileAirEnabled(true);
    setIsMobileAirVisible(true);
    trackFeatureUsage("mobileair_load_request", {
      sensorCount: limited.length,
      startDate: period.startDate,
      endDate: period.endDate,
    });
  };

  const handleMobileAirSensorRemove = useCallback(
    (sensorId: string) => {
      setSelectedMobileAirSensors((prev) => {
        const next = prev.filter((id) => id !== sensorId);
        if (next.length === 0) {
          restoreMobilitySnapshot();
          setMobileAirPeriod(defaultMobileAirPeriod);
          setMobileAirPartialRefetchSensors([]);
          setIsMobileAirEnabled(false);
          setIsMobileAirVisible(false);
        }
        return next;
      });
      setMobileAirSensorPeriods((prev) => {
        const next = { ...prev };
        delete next[sensorId];
        return next;
      });
      setMobileAirSensorVisibility((prev) => {
        const next = { ...prev };
        delete next[sensorId];
        return next;
      });
    },
    [defaultMobileAirPeriod, restoreMobilitySnapshot],
  );

  const handleMobileAirSensorPeriodChange = useCallback(
    (sensorId: string, period: { startDate: string; endDate: string }) => {
      setMobileAirSensorPeriods((prev) => ({ ...prev, [sensorId]: period }));
      setMobileAirPartialRefetchSensors([sensorId]);
      setMobileAirPartialRefetchToken((token) => token + 1);
    },
    [],
  );

  const handleMobileAirSensorVisibilityChange = useCallback(
    (sensorId: string, visible: boolean) => {
      setMobileAirSensorVisibility((prev) => ({ ...prev, [sensorId]: visible }));
    },
    [],
  );

  // Fonction pour désélectionner la source MobileAir
  const handleMobileAirSourceDeselected = useCallback(() => {
    clearMobileAirState();
    restoreMobilitySnapshot();
  }, [clearMobileAirState, restoreMobilitySnapshot]);

  const handleSignalAirSourceDeselected = useCallback(() => {
    resetSignalAirSettings();
    setIsSignalAirEnabled(false);
    setIsSignalAirVisible(false);
  }, [resetSignalAirSettings]);

  const handleSignalAirTypesChange = useCallback(
    (types: string[]) => {
      if (types.length === 0) {
        resetSignalAirSettings();
        setIsSignalAirEnabled(false);
        setIsSignalAirVisible(false);
        return;
      }
      setSignalAirSelectedTypes(types);
      const missing = types.some(
        (type) => !signalAirFetchedTypes.includes(type),
      );
      if (isSignalAirEnabled && missing) {
        setSignalAirFetchToken((prev) => prev + 1);
        trackFeatureUsage("signalair_types_refetch", {
          selectedTypes: types.join(","),
        });
      }
    },
    [isSignalAirEnabled, signalAirFetchedTypes, resetSignalAirSettings],
  );

  // Activation des deux sources. Les noms d'événement analytiques restent ceux
  // de l'époque des panneaux latéraux : les renommer romprait les séries déjà
  // collectées, alors que la mesure porte sur le même geste utilisateur.
  const handleSignalAirEnable = useCallback(() => {
    setIsSignalAirEnabled(true);
    setIsSignalAirVisible(true);
    if (signalAirSelectedTypes.length === 0) {
      setSignalAirSelectedTypes([...SIGNAL_AIR_DEFAULT_TYPES]);
    }
    setSignalAirFetchToken((prev) => prev + 1);
    trackFeatureUsage("signalair_panel_open");
  }, [SIGNAL_AIR_DEFAULT_TYPES, signalAirSelectedTypes.length]);

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

  // État pour l'auto-refresh - désactivé par défaut
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

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
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const initialCustomRange = useMemo((): TimeBarCustomRange | null => {
    const { from, to, timeStep } = INITIAL_APP_URL_PARAMS;
    if (!from || !to) return null;
    return clampCustomRange(
      {
        start: { date: from, hour: 0, minute: 0 },
        end: { date: to, hour: 23, minute: 45 },
      },
      timeStep
    );
  }, []);

  const [customRange, setCustomRange] = useState<TimeBarCustomRange | null>(
    initialCustomRange
  );

  const signalAirOptions = useMemo(
    () => ({
      selectedTypes: signalAirSelectedTypes,
      fetchToken: signalAirFetchToken,
      // En exploration, useInstantSnapshot charge SignalAir ; ici seulement le live.
      // En mode mobilité : fetch suspendu (temporalité incompatible).
      isSourceSelected:
        isSignalAirEnabled && !isExploration && !isMobileAirMobilityMode,
    }),
    [
      signalAirSelectedTypes,
      signalAirFetchToken,
      isSignalAirEnabled,
      isExploration,
      isMobileAirMobilityMode,
    ],
  );

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

  // Hydrate l’instant URL une seule fois au montage si from/to/at présents.
  const urlHydratedRef = useRef(false);
  useEffect(() => {
    if (urlHydratedRef.current) return;
    urlHydratedRef.current = true;
    const { from, to, at, timeStep } = INITIAL_APP_URL_PARAMS;
    if (!from || !to) return;
    const range = clampCustomRange(
      {
        start: { date: from, hour: 0, minute: 0 },
        end: { date: to, hour: 23, minute: 45 },
      },
      timeStep
    );
    setCustomRange(range);
    let target: MapInstant = range.end;
    if (at) {
      const [datePart, timePart] = at.split("T");
      const [hourStr, minuteStr] = (timePart ?? "0:0").split(":");
      target = clampInstant(
        normalizeInstant(
          {
            date: datePart,
            hour: Number(hourStr) || 0,
            minute: Number(minuteStr) || 0,
          },
          timeStep
        ),
        range.start,
        range.end,
        timeStep
      );
    }
    setBlockFocus(target);
    seekTo(target, timeStep);
  }, [seekTo]);

  const windowFocus =
    isExploration && blockFocus ? blockFocus : liveInstant;

  const timeBarWindow = useMemo(
    () =>
      buildTimeBarWindow({
        kind: modelingKind,
        timeStep: selectedTimeStep,
        focus: windowFocus,
        customRange,
      }),
    [
      modelingKind,
      selectedTimeStep,
      windowFocus.date,
      windowFocus.hour,
      windowFocus.minute,
      customRange?.start.date,
      customRange?.start.hour,
      customRange?.start.minute,
      customRange?.end.date,
      customRange?.end.hour,
      customRange?.end.minute,
    ],
  );

  const defaultAzurHour = getModelingLayerHour(selectedTimeStep);
  const liveSlotIndex = timeBarWindow.liveIndex;

  const effectiveInstant: MapInstant =
    isExploration && mapInstant ? mapInstant : liveInstant;

  const signalAirPeriod = useMemo(() => {
    if (!isTimeBarAllowed) {
      return { startDate: "", endDate: "" };
    }
    const buffer = buildSnapshotBufferWindow(
      effectiveInstant,
      selectedTimeStep,
      new Date(),
      customRange,
    );
    return {
      startDate: buffer.startInstant.date,
      endDate: buffer.endInstant.date,
    };
  }, [
    isTimeBarAllowed,
    effectiveInstant.date,
    effectiveInstant.hour,
    effectiveInstant.minute,
    selectedTimeStep,
    customRange?.start.date,
    customRange?.start.hour,
    customRange?.start.minute,
    customRange?.end.date,
    customRange?.end.hour,
    customRange?.end.minute,
  ]);

  const signalAirPeriodKey = `${signalAirPeriod.startDate}|${signalAirPeriod.endDate}`;

  // Refetch SignalAir en live quand la fenêtre TimeBar change.
  // En exploration, useInstantSnapshot gère les miss de buffer.
  useEffect(() => {
    if (!isSignalAirEnabled || !isTimeBarAllowed || isExploration) return;
    if (!signalAirPeriod.startDate || !signalAirPeriod.endDate) return;
    setSignalAirFetchToken((prev) => prev + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- période live seule
  }, [signalAirPeriodKey]);

  // SignalAir incompatible avec Scan / ≤2 min : désactiver proprement.
  useEffect(() => {
    if (!isSignalAirEnabled) return;
    if (isMapInstantAllowedForTimeStep(selectedTimeStep)) return;
    handleSignalAirSourceDeselected();
    addToast({
      title: t("panels.signalAirSelection.incompatibleTimeStepToast"),
      variant: "info",
    });
  }, [
    selectedTimeStep,
    isSignalAirEnabled,
    handleSignalAirSourceDeselected,
    addToast,
    t,
  ]);

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

  // Conserver la plage custom au changement de pas de temps, clampée au nouveau plafond.
  useEffect(() => {
    setCustomRange((prev) => {
      if (!prev) return null;
      return clampCustomRange(prev, selectedTimeStep);
    });
  }, [selectedTimeStep]);

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
        setCustomRange(null);
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
    setCustomRange(null);
    setPeriodPickerOpen(false);
    goLive();
    trackFeatureUsage("map_instant_live");
  }, [goLive]);

  const confirmExpandRange = useCallback(
    (target: MapInstant, current: TimeBarCustomRange): boolean => {
      const clampedCurrent = clampCustomRange(current, selectedTimeStep);
      const proposed = proposeExpandedRange(
        clampedCurrent,
        target,
        selectedTimeStep
      );
      const label = formatExpandConfirmLabel(
        proposed,
        target,
        i18n.language,
        selectedTimeStep
      );
      return window.confirm(
        t("timeBar.expandConfirm", { range: label })
      );
    },
    [selectedTimeStep, i18n.language, t]
  );

  const handleCustomRangeChange = useCallback(
    (range: TimeBarCustomRange | null) => {
      if (!range) {
        setCustomRange(null);
        return;
      }
      const clamped = clampCustomRange(range, selectedTimeStep);
      setCustomRange(clamped);
      setBlockFocus(clamped.start);
      seekTo(clamped.start, selectedTimeStep);
      trackFeatureUsage("map_instant_custom_range", {
        from: clamped.start.date,
        to: clamped.end.date,
        timeStep: selectedTimeStep,
      });
    },
    [selectedTimeStep, seekTo]
  );

  const handleTimeBarSeekBeyond = useCallback(
    (direction: "past" | "future") => {
      const next = adjacentInstantBeyondSlots(
        timeBarWindow.slots,
        direction,
        selectedTimeStep,
        new Date(),
        includeForecast && !customRange,
      );
      if (!next) return;

      if (customRange) {
        const clampedCurrent = clampCustomRange(customRange, selectedTimeStep);
        const inRange =
          compareInstants(next, clampedCurrent.start) >= 0 &&
          compareInstants(next, clampedCurrent.end) <= 0;
        if (!inRange) {
          if (!confirmExpandRange(next, clampedCurrent)) return;
          const expanded = proposeExpandedRange(
            clampedCurrent,
            next,
            selectedTimeStep
          );
          setCustomRange(expanded);
        }
      }

      if (
        liveSlotIndex >= 0 &&
        next.date === liveInstant.date &&
        next.hour === liveInstant.hour &&
        (next.minute ?? 0) === (liveInstant.minute ?? 0)
      ) {
        setCustomRange(null);
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
      customRange,
      liveSlotIndex,
      liveInstant,
      goLive,
      seekTo,
      confirmExpandRange,
    ],
  );

  const handleTimeBarPlayingChange = useCallback((playing: boolean) => {
    setTimeBarPlaying(playing);
  }, []);

  const currentSlot = timeBarWindow.slots[timeBarIndex];
  const hideMeasurementsForForecast = currentSlot?.kind === "forecast";

  // Précharge le buffer lookback (24 h / 7 j) dès l’arrivée, pas seulement
  // au premier seek en exploration — sinon la 1ʳᵉ navigation arrière bloque.
  const snapshotWarmEnabled =
    timeBarVisible && !hideMeasurementsForForecast;
  const snapshotEnabled =
    snapshotWarmEnabled && isExploration;

  const {
    devices: normalDevices,
    reports,
    loading,
    error,
    atmoMicroOutage,
    loadingSources,
    lastRefresh,
    mobileAirSensorStatus,
    isMobileAirLoading,
  } = useAirQualityData({
    selectedPollutant,
    selectedSources: isMobileAirMobilityMode ? [] : selectedSources,
    selectedTimeStep,
    signalAirPeriod,
    mobileAirPeriod,
    mobileAirSensorPeriods,
    selectedMobileAirSensors,
    mobileAirPartialRefetchSensors,
    mobileAirPartialRefetchToken,
    signalAirOptions,
    autoRefreshEnabled: autoRefreshEnabled && !isExploration && !isMobileAirMobilityMode,
  });

  const {
    devices: snapshotDevices,
    reports: snapshotReports,
    loading: snapshotLoading,
    error: snapshotError,
  } = useInstantSnapshot({
    enabled: snapshotWarmEnabled && !isMobileAirMobilityMode,
    instant: effectiveInstant,
    timeStep: selectedTimeStep,
    pollutant: selectedPollutant,
    selectedSources: isMobileAirMobilityMode ? [] : selectedSources,
    signalAirEnabled: isSignalAirEnabled && !isMobileAirMobilityMode,
    signalAirSelectedTypes,
    navigableRange: customRange,
    playbackActive: timeBarPlaying,
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

  const devicesForMap = useMemo(() => {
    if (!isMobileAirMobilityMode) return devices;
    return devices.filter((device) => device.source === "mobileair");
  }, [devices, isMobileAirMobilityMode]);

  const reportsForMap = useMemo(() => {
    if (hideMeasurementsForForecast || isMobileAirMobilityMode) return [];
    const base = snapshotEnabled ? snapshotReports : reports;
    const selectedSet = new Set(signalAirSelectedTypes);
    const typeFiltered =
      selectedSet.size === 0
        ? base
        : base.filter(
            (report) =>
              report.source !== "signalair" ||
              selectedSet.has(report.signalType),
          );

    // Live TimeBar : filtrer aussi sur l’instant courant (snapshot le fait déjà).
    if (!snapshotEnabled && timeBarVisible && isSignalAirEnabled) {
      const instantIso = instantToIsoLocal(effectiveInstant);
      const signalReports = typeFiltered.filter((r) => r.source === "signalair");
      const otherReports = typeFiltered.filter((r) => r.source !== "signalair");
      return [
        ...otherReports,
        ...filterReportsByDisplayWindow(
          signalReports,
          instantIso,
          selectedTimeStep,
        ),
      ];
    }

    return typeFiltered;
  }, [
    hideMeasurementsForForecast,
    isMobileAirMobilityMode,
    snapshotEnabled,
    snapshotReports,
    reports,
    signalAirSelectedTypes,
    timeBarVisible,
    isSignalAirEnabled,
    effectiveInstant,
    selectedTimeStep,
  ]);

  const mobilityPeriodRange = useMemo(() => {
    if (!isMobileAirMobilityMode) return undefined;
    const envelope = getMobileAirMapPeriod(
      mobileAirPeriod,
      mobileAirSensorPeriods,
      selectedMobileAirSensors,
    );
    return formatMobileAirPeriodRange(envelope, i18n.language);
  }, [
    isMobileAirMobilityMode,
    mobileAirPeriod,
    mobileAirSensorPeriods,
    selectedMobileAirSensors,
    i18n.language,
  ]);

  const isSignalAirLoading =
    loadingSources.includes("signalair") ||
    (snapshotEnabled && isSignalAirEnabled && snapshotLoading);
  const hasSignalAirLoaded = isSignalAirEnabled && signalAirFetchToken > 0;

  // Mémoriser les types effectivement couverts après un fetch réussi.
  useEffect(() => {
    if (!isSignalAirEnabled || isSignalAirLoading) return;
    const typesInReports = [
      ...new Set(
        (snapshotEnabled ? snapshotReports : reports)
          .filter((r) => r.source === "signalair")
          .map((r) => r.signalType),
      ),
    ];
    // Inclure les types demandés même si 0 résultat (évite refetch infini).
    const nextFetched = [
      ...new Set([...signalAirSelectedTypes, ...typesInReports]),
    ].sort();
    setSignalAirFetchedTypes((prev) => {
      const prevKey = [...prev].sort().join(",");
      const nextKey = nextFetched.join(",");
      return prevKey === nextKey ? prev : nextFetched;
    });
  }, [
    isSignalAirEnabled,
    isSignalAirLoading,
    snapshotEnabled,
    snapshotReports,
    reports,
    signalAirSelectedTypes,
  ]);

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
    return buildChartRangeAroundInstant(
      windowFocus,
      selectedTimeStep,
      new Date(),
      customRange,
    );
  }, [
    isExploration,
    windowFocus,
    selectedTimeStep,
    customRange?.start.date,
    customRange?.start.hour,
    customRange?.start.minute,
    customRange?.end.date,
    customRange?.end.hour,
    customRange?.end.minute,
  ]);

  const historicalCurrentIso = isExploration
    ? instantToIsoLocal(effectiveInstant)
    : undefined;

  const mapDataError = snapshotEnabled ? snapshotError ?? error : error;
  // Pendant le play, les miss de buffer restent silencieux (pas d’overlay carte).
  const mapLoading = snapshotEnabled
    ? snapshotLoading && !timeBarPlaying
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
      from: customRange?.start.date ?? null,
      to: customRange?.end.date ?? null,
      at:
        isExploration && mapInstant
          ? selectedTimeStep === "jour"
            ? mapInstant.date
            : `${mapInstant.date}T${String(mapInstant.hour).padStart(2, "0")}:${String(mapInstant.minute ?? 0).padStart(2, "0")}`
          : null,
    }),
    [
      mapCenter,
      mapZoom,
      selectedPollutant,
      selectedTimeStep,
      selectedSources,
      customRange?.start.date,
      customRange?.end.date,
      isExploration,
      mapInstant,
    ],
  );

  const handlePopStateFromUrl = useCallback((params: AppUrlParams) => {
    setMapCenter([params.lat, params.lng]);
    setMapZoom(params.zoom);
    setSelectedPollutant(params.pollutant);
    setSelectedTimeStep(params.timeStep);
    setSelectedSources(params.sources);
    if (params.from && params.to) {
      const range = clampCustomRange(
        {
          start: { date: params.from, hour: 0, minute: 0 },
          end: { date: params.to, hour: 23, minute: 45 },
        },
        params.timeStep
      );
      setCustomRange(range);
      let target = range.end;
      if (params.at) {
        const [datePart, timePart] = params.at.split("T");
        const [hourStr, minuteStr] = (timePart ?? "0:0").split(":");
        target = clampInstant(
          normalizeInstant(
            {
              date: datePart,
              hour: Number(hourStr) || 0,
              minute: Number(minuteStr) || 0,
            },
            params.timeStep
          ),
          range.start,
          range.end,
          params.timeStep
        );
      }
      setBlockFocus(target);
      seekTo(target, params.timeStep);
    } else {
      setCustomRange(null);
      goLive();
    }
  }, [seekTo, goLive]);

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
      isMobileAirMobilityMode,
      onExitMobilityModeViaSource: handleExitMobilityModeViaSource,
    }),
    [
      selectedPollutant,
      selectedSources,
      selectedTimeStep,
      handlePollutantChange,
      handleSourceChange,
      handleTimeStepChange,
      isMobileAirMobilityMode,
      handleExitMobilityModeViaSource,
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
      isActive: Boolean(customRange) || isExploration,
      isAllowed: isTimeBarAllowed,
      onToggle: () => {
        if (customRange || isExploration) {
          handleTimeBarGoLive();
          return;
        }
        setPeriodPickerOpen(true);
      },
    }),
    [
      customRange,
      isExploration,
      isTimeBarAllowed,
      handleTimeBarGoLive,
    ],
  );

  const timeBarValue = useMemo<MapControlsTimeBar>(
    () => ({
      visible: timeBarVisible && !isMobileAirMobilityMode,
      mode: mapInstantMode,
      slots: timeBarWindow.slots,
      index: timeBarIndex,
      liveIndex: timeBarWindow.liveIndex,
      showForecastZone: timeBarWindow.showForecastZone,
      minDate: TIME_BAR_GO_TO_MIN_DATE,
      maxDate: liveInstant.date,
      canSeekPast:
        adjacentInstantBeyondSlots(
          timeBarWindow.slots,
          "past",
          selectedTimeStep,
          undefined,
          includeForecast && !customRange,
        ) !== null,
      canSeekFuture:
        adjacentInstantBeyondSlots(
          timeBarWindow.slots,
          "future",
          selectedTimeStep,
          undefined,
          includeForecast && !customRange,
        ) !== null,
      selectedPollutant,
      timeStep: selectedTimeStep,
      loading: snapshotLoading,
      customRange,
      periodPickerOpen,
      onPeriodPickerOpenChange: setPeriodPickerOpen,
      onCustomRangeChange: handleCustomRangeChange,
      onIndexChange: handleTimeBarIndexChange,
      onGoLive: handleTimeBarGoLive,
      onSeekBeyond: handleTimeBarSeekBeyond,
      onPlayingChange: handleTimeBarPlayingChange,
    }),
    [
      timeBarVisible,
      isMobileAirMobilityMode,
      mapInstantMode,
      timeBarWindow.slots,
      timeBarWindow.liveIndex,
      timeBarWindow.showForecastZone,
      timeBarIndex,
      liveInstant.date,
      selectedTimeStep,
      includeForecast,
      customRange,
      selectedPollutant,
      snapshotLoading,
      periodPickerOpen,
      handleCustomRangeChange,
      handleTimeBarIndexChange,
      handleTimeBarGoLive,
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
      selectedMobileAirSensors,
      mobileAirDefaultPeriod: mobileAirPeriod,
      mobileAirSensorPeriods,
      mobileAirSensorVisibility,
      mobileAirSensorStatus,
      isMobileAirLoading,
      onMobileAirSensorRemove: handleMobileAirSensorRemove,
      onMobileAirSensorPeriodChange: handleMobileAirSensorPeriodChange,
      onMobileAirSensorVisibilityChange: handleMobileAirSensorVisibilityChange,
      signalAirSelectedTypes,
      onSignalAirTypesChange: handleSignalAirTypesChange,
      isSignalAirLoading,
      signalAirHasLoaded: hasSignalAirLoaded,
      signalAirReportsCount,
      isMobileAirMobilityMode,
      onExitMobilityModeViaSignalAir: handleExitMobilityModeViaSignalAir,
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
      selectedMobileAirSensors,
      mobileAirPeriod,
      mobileAirSensorPeriods,
      mobileAirSensorVisibility,
      mobileAirSensorStatus,
      isMobileAirLoading,
      handleMobileAirSensorRemove,
      handleMobileAirSensorPeriodChange,
      handleMobileAirSensorVisibilityChange,
      signalAirSelectedTypes,
      handleSignalAirTypesChange,
      isSignalAirLoading,
      hasSignalAirLoaded,
      signalAirReportsCount,
      isMobileAirMobilityMode,
      handleExitMobilityModeViaSignalAir,
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
            devices={devicesForMap}
            reports={reportsForMap}
            center={mapCenter}
            zoom={mapZoom}
            mapBounds={domainConfig.mapBounds}
            onMapViewChange={handleMapViewChange}
            selectedPollutant={selectedPollutant}
            selectedSources={selectedSources}
            selectedTimeStep={selectedTimeStep}
            mobilityPeriodRange={mobilityPeriodRange}
            currentModelingLayer={currentModelingLayer}
            modelingHourIndex={modelingHourIndex}
            loading={mapLoading}
            signalAirSelectedTypes={signalAirSelectedTypes}
            onSignalAirTypesChange={handleSignalAirTypesChange}
            isSignalAirLoading={isSignalAirLoading}
            signalAirHasLoaded={hasSignalAirLoaded}
            signalAirReportsCount={signalAirReportsCount}
            isHistoricalModeWithSignalAirData={
              snapshotEnabled && isSignalAirEnabled
            }
            onSignalAirSourceDeselected={handleSignalAirSourceDeselected}
            onMobileAirSensorSelected={handleMobileAirSensorsSelected}
            onMobileAirSourceDeselected={handleMobileAirSourceDeselected}
            isHistoricalModeActive={isExploration}
            isSignalAirEnabled={isSignalAirEnabled}
            isMobileAirEnabled={isMobileAirEnabled}
            isSignalAirVisible={isSignalAirVisible}
            isMobileAirVisible={isMobileAirVisible}
            mobileAirSensorVisibility={mobileAirSensorVisibility}
            onSignalAirToggle={handleSignalAirVisibilityToggle}
            onMobileAirToggle={handleMobileAirVisibilityToggle}
            onMobileAirSensorRemove={handleMobileAirSensorRemove}
            onMobileAirSensorPeriodChange={handleMobileAirSensorPeriodChange}
            onMobileAirSensorVisibilityChange={
              handleMobileAirSensorVisibilityChange
            }
            selectedMobileAirSensors={selectedMobileAirSensors}
            mobileAirSensorPeriods={mobileAirSensorPeriods}
            mobileAirDefaultPeriod={mobileAirPeriod}
            mobileAirSensorStatus={mobileAirSensorStatus}
            isMobileAirLoading={isMobileAirLoading}
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
