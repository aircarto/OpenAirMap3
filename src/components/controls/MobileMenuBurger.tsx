import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import PollutantDropdown from "./PollutantDropdown";
import SourceDropdown from "./SourceDropdown";
import TimeStepDropdown from "./TimeStepDropdown";
import HistoricalModeButton from "./HistoricalModeButton";
import AutoRefreshToggle from "./AutoRefreshToggle";
import ModelingLayerControl from "./ModelingLayerControl";
import LanguageSwitcher from "./LanguageSwitcher";
import { ModelingLayerType } from "../../constants/mapLayers";
import { Toast } from "../ui/toast";
import { cn } from "../../lib/utils";

interface MobileMenuBurgerProps {
  selectedPollutant: string;
  onPollutantChange: (pollutant: string) => void;
  selectedSources: string[];
  onSourceChange: (sources: string[]) => void;
  selectedTimeStep: string;
  onTimeStepChange: (timeStep: string) => void;
  isHistoricalModeActive: boolean;
  onToggleHistoricalMode: () => void;
  isHistoricalModeAllowed?: boolean;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: (enabled: boolean) => void;
  lastRefresh: Date | null;
  loading: boolean;
  currentModelingLayer: ModelingLayerType | null;
  onModelingLayerChange: (layerType: ModelingLayerType | null) => void;
  onToast?: (toast: Omit<Toast, "id">) => void;
  onOpenSignalAirPanel?: () => void;
  onOpenMobileAirPanel?: () => void;
  isSignalAirVisible?: boolean;
  isMobileAirVisible?: boolean;
  onSignalAirToggle?: (visible: boolean) => void;
  onMobileAirToggle?: (visible: boolean) => void;
  hasSignalAirData?: boolean;
  hasMobileAirData?: boolean;
}

const MobileMenuBurger: React.FC<MobileMenuBurgerProps> = ({
  selectedPollutant,
  onPollutantChange,
  selectedSources,
  onSourceChange,
  selectedTimeStep,
  onTimeStepChange,
  isHistoricalModeActive,
  onToggleHistoricalMode,
  isHistoricalModeAllowed = true,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  lastRefresh,
  loading,
  currentModelingLayer,
  onModelingLayerChange,
  onToast,
  onOpenSignalAirPanel,
  onOpenMobileAirPanel,
  isSignalAirVisible = true,
  isMobileAirVisible = true,
  onSignalAirToggle,
  onMobileAirToggle,
  hasSignalAirData = false,
  hasMobileAirData = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative xl:hidden" ref={menuRef}>
      {/* Bouton burger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation flex items-center justify-center"
        aria-label={t("controls.menu")}
      >
        <svg
          className="w-6 h-6 text-gray-700 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,28rem)] max-w-sm sm:max-w-md bg-white rounded-xl shadow-xl border border-gray-200 z-[3000] max-h-[80vh] overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-3 sm:space-y-2">
            {/* Polluant */}
            <div className="space-y-1">
              <label id="mobile-menu-pollutant" htmlFor="mobile-menu-pollutant-trigger" className="text-sm font-medium text-gray-700">
                {t("controls.pollutant")}
              </label>
              <PollutantDropdown
                triggerId="mobile-menu-pollutant-trigger"
                selectedPollutant={selectedPollutant}
                onPollutantChange={onPollutantChange}
                selectedTimeStep={selectedTimeStep}
              />
            </div>

            {/* Sources */}
            <div className="space-y-1">
              <label id="mobile-menu-sources" htmlFor="mobile-menu-sources-trigger" className="text-sm font-medium text-gray-700">
                {t("controls.sources")}
              </label>
              <SourceDropdown
                triggerId="mobile-menu-sources-trigger"
                selectedSources={selectedSources}
                selectedTimeStep={selectedTimeStep}
                onSourceChange={onSourceChange}
                onTimeStepChange={onTimeStepChange}
                onToast={onToast}
              />
            </div>

            {/* Pas de temps */}
            <div className="space-y-1">
              <label id="mobile-menu-timestep" htmlFor="mobile-menu-timestep-trigger" className="text-sm font-medium text-gray-700">
                {t("controls.timeStep")}
              </label>
              <TimeStepDropdown
                triggerId="mobile-menu-timestep-trigger"
                selectedTimeStep={selectedTimeStep}
                selectedSources={selectedSources}
                onTimeStepChange={onTimeStepChange}
                onSourceChange={onSourceChange}
                onToast={onToast}
              />
            </div>

            {/* Carte de modélisation */}
            <div className="space-y-1">
              <label id="mobile-menu-modeling" htmlFor="mobile-menu-modeling-trigger" className="text-sm font-medium text-gray-700">
                {t("controls.modeling")}
              </label>
              <ModelingLayerControl
                triggerId="mobile-menu-modeling-trigger"
                currentModelingLayer={currentModelingLayer}
                onModelingLayerChange={onModelingLayerChange}
                selectedPollutant={selectedPollutant}
                selectedTimeStep={selectedTimeStep}
              />
            </div>

            {/* Sources spéciales */}
            {(onOpenSignalAirPanel || onOpenMobileAirPanel) && (
              <div className="space-y-2 border-t border-gray-200 pt-4">
                <label className="text-sm font-medium text-gray-700">
                  {t("controls.specialSources")}
                </label>
                <div className="space-y-2">
                  {/* SignalAir */}
                  {onOpenSignalAirPanel && (
                    <div
                      className={cn(
                        "rounded-lg p-3 transition-colors duration-150",
                        hasSignalAirData
                          ? "bg-[#13A0DB]/5 border border-[#13A0DB]/20"
                          : "bg-gray-50/80 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenSignalAirPanel();
                            setIsOpen(false);
                          }}
                          className="flex-1 min-w-0 flex items-center gap-2 min-h-[44px] rounded-md py-1.5 px-2 text-left text-sm font-medium text-[#13A0DB] hover:bg-[#13A0DB]/10 active:bg-[#13A0DB]/15 transition-colors duration-150 touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#13A0DB]/30 focus:ring-offset-1"
                          aria-label={t("controls.openSignalAir")}
                        >
                          <span className="truncate">{t("controls.openSignalAir")}</span>
                          {hasSignalAirData && (
                            <span
                              className={cn(
                                "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                isSignalAirVisible
                                  ? "bg-emerald-500/90 text-white"
                                  : "bg-gray-200 text-gray-500"
                              )}
                              title={isSignalAirVisible ? "Visible sur la carte" : "Masqué sur la carte"}
                            >
                              {isSignalAirVisible ? "Actif" : "Inactif"}
                            </span>
                          )}
                        </button>
                        {hasSignalAirData && onSignalAirToggle && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSignalAirToggle(!isSignalAirVisible);
                            }}
                            className={cn(
                              "shrink-0 min-w-[44px] min-h-[44px] rounded-md text-xs font-medium flex items-center justify-center transition-colors duration-150 touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#13A0DB]/30 focus:ring-offset-1",
                              isSignalAirVisible
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            )}
                            aria-label={isSignalAirVisible ? t("panels.hideSignalAirAria") : t("panels.showSignalAirAria")}
                            aria-pressed={isSignalAirVisible}
                          >
                            {isSignalAirVisible ? "✓" : "✕"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {/* MobileAir */}
                  {onOpenMobileAirPanel && (
                    <div
                      className={cn(
                        "rounded-lg p-3 transition-colors duration-150",
                        hasMobileAirData
                          ? "bg-green-500/5 border border-green-500/20"
                          : "bg-gray-50/80 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenMobileAirPanel();
                            setIsOpen(false);
                          }}
                          className="flex-1 min-w-0 flex items-center gap-2 min-h-[44px] rounded-md py-1.5 px-2 text-left text-sm font-medium text-green-700 hover:bg-green-500/10 active:bg-green-500/15 transition-colors duration-150 touch-manipulation focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-1"
                          aria-label={t("controls.openMobileAir")}
                        >
                          <span className="truncate">{t("controls.openMobileAir")}</span>
                          {hasMobileAirData && (
                            <span
                              className={cn(
                                "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                isMobileAirVisible
                                  ? "bg-emerald-500/90 text-white"
                                  : "bg-gray-200 text-gray-500"
                              )}
                              title={isMobileAirVisible ? "Visible sur la carte" : "Masqué sur la carte"}
                            >
                              {isMobileAirVisible ? "Actif" : "Inactif"}
                            </span>
                          )}
                        </button>
                        {hasMobileAirData && onMobileAirToggle && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMobileAirToggle(!isMobileAirVisible);
                            }}
                            className={cn(
                              "shrink-0 min-w-[44px] min-h-[44px] rounded-md text-xs font-medium flex items-center justify-center transition-colors duration-150 touch-manipulation focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-1",
                              isMobileAirVisible
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            )}
                            aria-label={isMobileAirVisible ? t("panels.hideMobileAirAria") : t("panels.showMobileAirAria")}
                            aria-pressed={isMobileAirVisible}
                          >
                            {isMobileAirVisible ? "✓" : "✕"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode historique */}
            <div className="space-y-1 border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-700">{t("controls.mode")}</label>
              <HistoricalModeButton
                isActive={isHistoricalModeActive}
                onToggle={onToggleHistoricalMode}
                disabled={!isHistoricalModeAllowed}
              />
            </div>

            {/* Auto-refresh */}
            <div className="space-y-1 border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-700">
                {t("controls.refresh")}
              </label>
              <AutoRefreshToggle
                enabled={autoRefreshEnabled && !isHistoricalModeActive}
                onToggle={onToggleAutoRefresh}
                loading={loading}
                disabled={isHistoricalModeActive}
                compact={false}
              />
            </div>

            {/* Langue */}
            <div className="space-y-1 border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-700">
                {t("common.chooseLanguage")}
              </label>
              <LanguageSwitcher />
            </div>

            {/* Bouton fermer */}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-[#4271B3] text-white rounded-md hover:bg-[#325a96] transition-colors"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileMenuBurger;
