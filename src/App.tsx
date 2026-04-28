import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AirQualityMap from "./components/map/AirQualityMap";
import { useAirQualityData } from "./hooks/useAirQualityData";
import { useTemporalVisualization } from "./hooks/useTemporalVisualization";
import { useDomainConfig } from "./hooks/useDomainConfig";
import { useFavicon } from "./hooks/useFavicon";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import {
  pollutants,
  getDefaultPollutant,
  isPollutantSupportedForTimeStep,
  getSupportedPollutantsForTimeStep,
} from "./constants/pollutants";
import { pasDeTemps, isHistoricalModeAllowedForTimeStep } from "./constants/timeSteps";
import { getDefaultSources } from "./constants/sources";
import PollutantDropdown from "./components/controls/PollutantDropdown";
import SourceDropdown from "./components/controls/SourceDropdown";
import TimeStepDropdown from "./components/controls/TimeStepDropdown";
import HistoricalModeButton from "./components/controls/HistoricalModeButton";
import HistoricalControlPanel from "./components/controls/HistoricalControlPanel";
import HistoricalPlaybackControl from "./components/controls/HistoricalPlaybackControl";
import MobileMenuBurger from "./components/controls/MobileMenuBurger";
import ModelingLayerControl from "./components/controls/ModelingLayerControl";
import SpecialSourceHeaderDropdown from "./components/controls/SpecialSourceHeaderDropdown";
import InformationModal from "./components/modals/InformationModal";
import { ModelingLayerType } from "./constants/mapLayers";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast";
import { cn } from "./lib/utils";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/controls/LanguageSwitcher";
import {
  initAnalytics,
  trackEvent,
  trackFeatureUsage,
  trackPageView,
} from "./services/analyticsService";

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

const App: React.FC = () => {
  const { t } = useTranslation();
  // Configuration basée sur le domaine
  const domainConfig = useDomainConfig();

  // Gestion dynamique de la favicon et du titre
  useFavicon(domainConfig.favicon);
  useDocumentTitle(domainConfig.title);

  // Hook pour les notifications toast
  const { toasts, addToast, removeToast } = useToast();

  // Trouver le pas de temps activé par défaut (calculé une seule fois)
  const defaultTimeStep = useMemo(() => {
    const defaultTimeStep = Object.entries(pasDeTemps).find(
      ([_, timeStep]) => timeStep.activated
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
    []
  );

  // États pour les contrôles avec polluant par défaut
  const [selectedPollutant, setSelectedPollutant] = useState<string>(
    getDefaultPollutant()
  );
  const [selectedSources, setSelectedSources] = useState<string[]>(
    getDefaultSources()
  );
  const [selectedTimeStep, setSelectedTimeStep] =
    useState<string>(defaultTimeStep);
  const [signalAirPeriod, setSignalAirPeriod] = useState(
    defaultSignalAirPeriod
  );
  const [signalAirDraftPeriod, setSignalAirDraftPeriod] = useState(
    defaultSignalAirPeriod
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
    defaultSignalAirPeriod // Utiliser la même période par défaut
  );
  const [selectedMobileAirSensor, setSelectedMobileAirSensor] = useState<
    string | null
  >(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [openSignalAirPanelRequest, setOpenSignalAirPanelRequest] = useState(0);
  const [openMobileAirPanelRequest, setOpenMobileAirPanelRequest] = useState(0);

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
      const addedSources = sources.filter((source) => !previousSources.includes(source));
      const removedSources = previousSources.filter((source) => !sources.includes(source));

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

  const handleModelingLayerChange = useCallback((layer: ModelingLayerType | null) => {
    setCurrentModelingLayer(layer);
    trackFeatureUsage("modeling_layer_change", { layer: layer ?? "none" });
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
  const handleSignalAirDraftPeriodChange = (
    startDate: string,
    endDate: string
  ) => {
    setSignalAirDraftPeriod({ startDate, endDate });
  };

  const handleSignalAirTypesChange = (types: string[]) => {
    setSignalAirSelectedTypes(types);
  };

  const handleSignalAirLoadRequest = () => {
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
  };

  // Fonction pour gérer la sélection d'un capteur MobileAir
  const handleMobileAirSensorSelected = (
    sensorId: string,
    period: { startDate: string; endDate: string }
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
  const handleMobileAirSourceDeselected = () => {
    // Réinitialiser les états MobileAir
    setSelectedMobileAirSensor(null);
    setMobileAirPeriod(defaultSignalAirPeriod);
    setIsMobileAirEnabled(false);
    setIsMobileAirVisible(false);
  };

  const handleSignalAirSourceDeselected = () => {
    resetSignalAirSettings();
    setIsSignalAirEnabled(false);
    setIsSignalAirVisible(false);
  };

  // Gérer l'ouverture des panels
  const handleSignalAirPanelOpen = () => {
    setIsSignalAirEnabled(true);
    trackFeatureUsage("signalair_panel_open");
  };

  const handleMobileAirPanelOpen = () => {
    setIsMobileAirEnabled(true);
    trackFeatureUsage("mobileair_panel_open");
  };

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
    [signalAirSelectedTypes, signalAirLoadTrigger, isSignalAirEnabled]
  );

  useEffect(() => {
    if (!isPollutantSupportedForTimeStep(selectedPollutant, selectedTimeStep)) {
      const supportedPollutants =
        getSupportedPollutantsForTimeStep(selectedTimeStep);
      if (supportedPollutants.length > 0) {
        setSelectedPollutant((current) =>
          supportedPollutants.includes(current)
            ? current
            : supportedPollutants[0]
        );
      }
    }
  }, [selectedPollutant, selectedTimeStep]);

  // État pour contrôler la visibilité du panel de sélection de date
  // Note: Le panel ne se ferme plus complètement, il se rabat juste
  const [isDatePanelVisible, setIsDatePanelVisible] = useState(true);
  const expandPanelRef = useRef<(() => void) | null>(null);

  // Hook pour la visualisation temporelle
  const {
    state: temporalState,
    controls: temporalControls,
    toggleHistoricalMode,
    exitHistoricalMode,
    loadHistoricalData,
    getCurrentDevices,
    getCurrentSignalAirReports,
    isHistoricalModeActive,
    hasHistoricalData,
    seekToDate,
    goToPrevious,
    goToNext,
  } = useTemporalVisualization({
    selectedPollutant,
    selectedSources,
    timeStep: selectedTimeStep,
    signalAirEnabled: isSignalAirEnabled,
    signalAirSelectedTypes,
  });

  // Mode historique autorisé uniquement pour les pas 15 min, heure et jour
  const isHistoricalModeAllowed = isHistoricalModeAllowedForTimeStep(selectedTimeStep);

  const handleHistoricalModeToggle = useCallback(() => {
    toggleHistoricalMode();
    trackFeatureUsage("historical_mode_toggle", { from: isHistoricalModeActive });
  }, [toggleHistoricalMode, isHistoricalModeActive]);

  // Désactiver le mode historique si l'utilisateur passe sur Scan ou ≤2 min
  useEffect(() => {
    if (!isHistoricalModeAllowed && isHistoricalModeActive) {
      exitHistoricalMode();
    }
  }, [isHistoricalModeAllowed, isHistoricalModeActive, exitHistoricalMode]);

  // Réinitialiser la visibilité du panel quand le mode historique est activé
  useEffect(() => {
    if (isHistoricalModeActive) {
      setIsDatePanelVisible(true);
    }
  }, [isHistoricalModeActive]);

  // Cacher le panel de sélection quand les données historiques sont chargées (sauf si explicitement réouvert)
  useEffect(() => {
    if (hasHistoricalData && isHistoricalModeActive) {
      // Cacher le panel de sélection quand les données sont chargées pour la première fois
      // (l'utilisateur peut le rouvrir via le bouton calendrier)
      setIsDatePanelVisible(false);
    }
  }, [hasHistoricalData, isHistoricalModeActive]);

  // En mode historique avec signalements chargés : afficher automatiquement les marqueurs SignalAir
  useEffect(() => {
    if (
      isHistoricalModeActive &&
      hasHistoricalData &&
      (temporalState.historicalSignalAirReports?.length ?? 0) > 0
    ) {
      setIsSignalAirVisible(true);
    }
  }, [
    isHistoricalModeActive,
    hasHistoricalData,
    temporalState.historicalSignalAirReports?.length,
  ]);

  // Hook pour récupérer les données (mode normal)
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
    autoRefreshEnabled: autoRefreshEnabled && !isHistoricalModeActive, // Désactiver l'auto-refresh en mode historique
  });
  const [atmoMicroMaintenanceBanner, setAtmoMicroMaintenanceBanner] =
    useState<AtmoMicroMaintenanceBannerConfig>(
      DEFAULT_ATMOMICRO_MAINTENANCE_BANNER
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

  // Déterminer quelles données utiliser selon le mode
  const devices = isHistoricalModeActive ? getCurrentDevices() : normalDevices;

  const signalAirReports = useMemo(
    () => reports.filter((report) => report.source === "signalair"),
    [reports]
  );

  // En mode historique avec données : afficher les signalements filtrés par fenêtre temporelle (période locale)
  const reportsForMap = useMemo(() => {
    if (isHistoricalModeActive && hasHistoricalData) {
      return getCurrentSignalAirReports();
    }
    return reports;
  }, [isHistoricalModeActive, hasHistoricalData, getCurrentSignalAirReports, reports]);

  const isSignalAirLoading = loadingSources.includes("signalair");
  // En mode historique : considérer "chargé" si des signalements ont été récupérés
  const hasSignalAirLoaded =
    signalAirLoadTrigger > 0 ||
    (isHistoricalModeActive &&
      hasHistoricalData &&
      temporalState.historicalSignalAirReports?.length > 0);

  const hasSignalAirData =
    hasSignalAirLoaded &&
    reportsForMap.filter((r) => r.source === "signalair").length > 0;
  const hasMobileAirData = devices.some((d) => d.source === "mobileair");

  // Fonction pour gérer le chargement des données historiques
  const handleLoadHistoricalData = () => {
    if (temporalState.startDate && temporalState.endDate) {
      loadHistoricalData();
    }
  };

  // Effet pour charger automatiquement les données quand les dates changent en mode historique
  useEffect(() => {
    if (
      isHistoricalModeActive &&
      temporalState.startDate &&
      temporalState.endDate &&
      !temporalState.loading &&
      temporalState.data.length === 0
    ) {
      // Ne pas charger automatiquement, laisser l'utilisateur décider
    }
  }, [
    isHistoricalModeActive,
    temporalState.startDate,
    temporalState.endDate,
    temporalState.loading,
    temporalState.data.length,
  ]);

  // Configuration de la carte basée sur le domaine
  const mapCenter = domainConfig.mapCenter;
  const mapZoom = domainConfig.mapZoom;

  const handleSignalAirHeaderClick = useCallback(() => {
    setOpenSignalAirPanelRequest((r) => r + 1);
    handleSignalAirPanelOpen();
  }, []);

  const handleMobileAirHeaderClick = useCallback(() => {
    setOpenMobileAirPanelRequest((r) => r + 1);
    handleMobileAirPanelOpen();
  }, []);

  const headerDisabled = isHistoricalModeActive && temporalState.isPlaying;
  const shouldShowAtmoMicroOutageBanner =
    selectedSources.includes("atmoMicro") &&
    atmoMicroOutage &&
    atmoMicroMaintenanceBanner.enabled &&
    !isAtmoMicroBannerDismissed;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Lien d'évitement : premier élément focusable pour la navigation clavier et lecteurs d'écran */}
      <a
        href="#main-content"
        className="skip-link"
        data-testid="skip-link"
      >
        {t("app.skipToContent")}
      </a>
      {/* Header : barre unique avec regroupement logique des contrôles */}
      <header className="relative bg-white border-b border-gray-200/80 shadow-sm z-[2500]">
        <div className="px-4 sm:px-5 py-2.5">
          <div className="flex items-center justify-between gap-3 flex-nowrap">
            {/* Marque : logo + titre */}
            <div className="flex items-center gap-3 min-w-0 shrink-0">
              <img
                src={domainConfig.logo}
                alt={t("app.logoAlt", { organization: domainConfig.organization })}
                className="h-8 md:h-9 object-contain"
              />
              <h1 className="text-base md:text-lg font-semibold text-[#4271B3] leading-tight truncate">
                {domainConfig.title}
              </h1>
            </div>

            {/* Menu burger (langue intégrée dans le menu) — affiché sous xl pour éviter débordement toolbar */}
            <div className="xl:hidden flex items-center shrink-0">
              <MobileMenuBurger
                selectedPollutant={selectedPollutant}
                onPollutantChange={handlePollutantChange}
                selectedSources={selectedSources}
                onSourceChange={handleSourceChange}
                selectedTimeStep={selectedTimeStep}
                onTimeStepChange={handleTimeStepChange}
                isHistoricalModeActive={isHistoricalModeActive}
                onToggleHistoricalMode={handleHistoricalModeToggle}
                isHistoricalModeAllowed={isHistoricalModeAllowed}
                autoRefreshEnabled={autoRefreshEnabled}
                onToggleAutoRefresh={handleAutoRefreshToggle}
                lastRefresh={lastRefresh}
                loading={loading}
                currentModelingLayer={currentModelingLayer}
                onModelingLayerChange={handleModelingLayerChange}
                onToast={addToast}
                onOpenSignalAirPanel={() => {
                  setOpenSignalAirPanelRequest((r) => r + 1);
                  handleSignalAirPanelOpen();
                }}
                onOpenMobileAirPanel={() => {
                  setOpenMobileAirPanelRequest((r) => r + 1);
                  handleMobileAirPanelOpen();
                }}
                isSignalAirVisible={isSignalAirVisible}
                isMobileAirVisible={isMobileAirVisible}
                onSignalAirToggle={handleSignalAirVisibilityToggle}
                onMobileAirToggle={handleMobileAirVisibilityToggle}
                hasSignalAirData={hasSignalAirData}
                hasMobileAirData={hasMobileAirData}
              />
            </div>

            {/* Barre d’outils — desktop */}
            <div
              className={cn(
                "hidden xl:flex items-center justify-center gap-3 flex-1 min-w-0 flex-nowrap overflow-hidden",
                headerDisabled && "opacity-50 pointer-events-none"
              )}
            >
              {/* Filtres : polluant, sources, pas de temps */}
              <div className="flex items-center gap-2 rounded-lg bg-gray-50/80 px-2 py-1.5 border border-gray-200/60 min-w-0 shrink">
                <PollutantDropdown
                  selectedPollutant={selectedPollutant}
                  onPollutantChange={handlePollutantChange}
                  selectedTimeStep={selectedTimeStep}
                />
                <SourceDropdown
                  selectedSources={selectedSources}
                  selectedTimeStep={selectedTimeStep}
                  onSourceChange={handleSourceChange}
                  onTimeStepChange={handleTimeStepChange}
                  onToast={addToast}
                  autoRefreshEnabled={autoRefreshEnabled && !isHistoricalModeActive}
                  onToggleAutoRefresh={handleAutoRefreshToggle}
                  loading={loading}
                  isHistoricalModeActive={isHistoricalModeActive}
                />
                <TimeStepDropdown
                  selectedTimeStep={selectedTimeStep}
                  selectedSources={selectedSources}
                  onTimeStepChange={handleTimeStepChange}
                  onSourceChange={handleSourceChange}
                  onToast={addToast}
                />
              </div>

              {/* Modélisation */}
              <div className="flex items-center gap-2 pl-1 border-l border-gray-200/80 min-w-0 shrink">
                <ModelingLayerControl
                  currentModelingLayer={currentModelingLayer}
                  onModelingLayerChange={handleModelingLayerChange}
                  selectedPollutant={selectedPollutant}
                  selectedTimeStep={selectedTimeStep}
                />
              </div>

              {/* Mode historique + Sources spéciales */}
              <div className="flex items-center gap-2 pl-1 border-l border-gray-200/80 min-w-0 shrink">
                <HistoricalModeButton
                  isActive={isHistoricalModeActive}
                  onToggle={handleHistoricalModeToggle}
                  disabled={!isHistoricalModeAllowed}
                />
                <SpecialSourceHeaderDropdown
                  onSignalAirClick={handleSignalAirHeaderClick}
                  onMobileAirClick={handleMobileAirHeaderClick}
                  isSignalAirVisible={isSignalAirVisible}
                  isMobileAirVisible={isMobileAirVisible}
                  onSignalAirToggle={handleSignalAirVisibilityToggle}
                  onMobileAirToggle={handleMobileAirVisibilityToggle}
                  hasSignalAirData={hasSignalAirData}
                  hasMobileAirData={hasMobileAirData}
                />
              </div>
            </div>

            {/* Zone droite — utilitaires (desktop) */}
            <div
              className={cn(
                "hidden xl:flex items-center gap-2 shrink-0",
                headerDisabled && "opacity-50 pointer-events-none"
              )}
            >
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => setIsInfoModalOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#325A96]/40 text-sm font-semibold text-[#325A96] transition-colors hover:bg-[#325A96]/10 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20"
                aria-label={t("app.infoButton")}
              >
                i
              </button>
            </div>
          </div>
        </div>

        {/* Barre de progression pour le chargement */}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100">
            <div
              className="h-full bg-[#4271B3] animate-pulse rounded-full"
              style={{ width: "100%" }}
            />
          </div>
        )}
      </header>

      {/* Carte en plein écran */}
      <main id="main-content" className="flex-1 relative" tabIndex={-1}>
        {shouldShowAtmoMicroOutageBanner && (
          <div className="absolute top-4 left-4 right-4 z-[1500]">
            <div className="relative mx-auto max-w-5xl rounded-lg border border-amber-300 bg-amber-50 px-10 py-3 shadow">
              <p className="text-center text-sm font-medium text-amber-900">
                {atmoMicroMaintenanceBanner.message}
              </p>
              <button
                type="button"
                onClick={() => setIsAtmoMicroBannerDismissed(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="Fermer le bandeau d'information"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Indicateur de chargement */}
        {loading && (
          <div className="absolute top-4 right-4 z-[1500]">
            <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <div className="flex flex-col">
                  <span className="text-blue-600 text-sm font-medium">
                    {devices.length === 0
                      ? t("common.loadingData")
                      : t("common.updating")}
                  </span>
                  {loadingSources.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {t("common.sourcesCount", { count: loadingSources.length })}
                      {loadingSources.length > 0 && (
                        <span className="ml-1">
                          ({loadingSources.slice(0, 2).join(", ")}
                          {loadingSources.length > 2 && "..."})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-2 rounded-md shadow-lg z-[1500] max-w-xs">
            <p className="text-xs">{t("common.error")}: {error}</p>
          </div>
        )}
        {/* Carte */}
        <AirQualityMap
          devices={devices}
          reports={reportsForMap}
          center={mapCenter}
          zoom={mapZoom}
          selectedPollutant={selectedPollutant}
          selectedSources={selectedSources}
          selectedTimeStep={selectedTimeStep}
          currentModelingLayer={currentModelingLayer}
          loading={loading || temporalState.loading}
          signalAirPeriod={signalAirDraftPeriod}
          signalAirSelectedTypes={signalAirSelectedTypes}
          onSignalAirPeriodChange={handleSignalAirDraftPeriodChange}
          onSignalAirTypesChange={handleSignalAirTypesChange}
          onSignalAirLoadRequest={handleSignalAirLoadRequest}
          isSignalAirLoading={isSignalAirLoading}
          signalAirHasLoaded={hasSignalAirLoaded}
          signalAirReportsCount={reportsForMap.filter((r) => r.source === "signalair").length}
          isHistoricalModeWithSignalAirData={
            isHistoricalModeActive &&
            hasHistoricalData &&
            (temporalState.historicalSignalAirReports?.length ?? 0) > 0
          }
          onSignalAirSourceDeselected={handleSignalAirSourceDeselected}
          onMobileAirSensorSelected={handleMobileAirSensorSelected}
          onMobileAirSourceDeselected={handleMobileAirSourceDeselected}
          isHistoricalModeActive={isHistoricalModeActive}
          isSignalAirEnabled={isSignalAirEnabled}
          isMobileAirEnabled={isMobileAirEnabled}
          isSignalAirVisible={isSignalAirVisible}
          isMobileAirVisible={isMobileAirVisible}
          onSignalAirToggle={handleSignalAirVisibilityToggle}
          onMobileAirToggle={handleMobileAirVisibilityToggle}
          onSignalAirPanelOpen={handleSignalAirPanelOpen}
          onMobileAirPanelOpen={handleMobileAirPanelOpen}
          openSignalAirPanelRequest={openSignalAirPanelRequest}
          openMobileAirPanelRequest={openMobileAirPanelRequest}
          historicalCurrentDate={
            isHistoricalModeActive && temporalState.isPlaying
              ? temporalState.currentDate
              : undefined
          }
        />

        {/* Panel de contrôle historique (sélection de date) - Visible si mode historique actif ET panel de date visible */}
        <HistoricalControlPanel
          isVisible={isHistoricalModeActive && isDatePanelVisible}
          onToggleHistoricalMode={toggleHistoricalMode}
          state={temporalState}
          controls={temporalControls}
          onLoadData={handleLoadHistoricalData}
          onSeekToDate={seekToDate}
          onGoToPrevious={goToPrevious}
          onGoToNext={goToNext}
          onPanelVisibilityChange={(visible) => {
            setIsDatePanelVisible(visible);
          }}
          onOpenPlaybackPanel={() => {
            setIsDatePanelVisible(false);
          }}
          onExpandRequest={(expandFn) => {
            expandPanelRef.current = expandFn;
          }}
          selectedPollutant={selectedPollutant}
        />

        {/* Panneau de lecture draggable - Visible si données historiques chargées ET panel de sélection caché */}
        {isHistoricalModeActive && hasHistoricalData && !isDatePanelVisible && (
          <HistoricalPlaybackControl
            state={temporalState}
            controls={temporalControls}
            onToggleHistoricalMode={toggleHistoricalMode}
            onOpenDatePanel={() => {
              // Arrêter la lecture si elle est en cours
              if (temporalState.isPlaying) {
                temporalControls.onPlayPause();
              }
              // Ouvrir le panel de sélection
              setIsDatePanelVisible(true);
              // Développer le panel en grand (avec un délai pour s'assurer que le panel est visible)
              setTimeout(() => {
                if (expandPanelRef.current) {
                  expandPanelRef.current();
                }
              }, 0);
            }}
            onSeekToDate={seekToDate}
            onGoToPrevious={goToPrevious}
            onGoToNext={goToNext}
          />
        )}
      </main>

      <InformationModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        domainConfig={domainConfig}
      />

      {/* Conteneur de notifications toast */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default App;
