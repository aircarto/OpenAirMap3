import React, { useState, useEffect, useRef } from "react";
import PollutantDropdown from "./PollutantDropdown";
import SourceDropdown from "./SourceDropdown";
import TimeStepDropdown from "./TimeStepDropdown";
import HistoricalModeButton from "./HistoricalModeButton";
import AutoRefreshControl from "./AutoRefreshControl";
import ModelingLayerControl from "./ModelingLayerControl";
import { ModelingLayerType } from "../../constants/mapLayers";
import { Toast } from "../ui/toast";

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
}) => {
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
        aria-label="Menu"
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
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,28rem)] max-w-sm sm:max-w-md bg-white rounded-xl shadow-xl border border-gray-200 z-[2000] max-h-[80vh] overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-3 sm:space-y-2">
            {/* Polluant */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Polluant
              </label>
              <PollutantDropdown
                selectedPollutant={selectedPollutant}
                onPollutantChange={onPollutantChange}
                selectedTimeStep={selectedTimeStep}
              />
            </div>

            {/* Sources */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Sources de données
              </label>
              <SourceDropdown
                selectedSources={selectedSources}
                selectedTimeStep={selectedTimeStep}
                onSourceChange={onSourceChange}
                onTimeStepChange={onTimeStepChange}
                onToast={onToast}
              />
            </div>

            {/* Pas de temps */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Pas de temps
              </label>
              <TimeStepDropdown
                selectedTimeStep={selectedTimeStep}
                selectedSources={selectedSources}
                onTimeStepChange={onTimeStepChange}
                onSourceChange={onSourceChange}
                onToast={onToast}
              />
            </div>

            {/* Carte de modélisation */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Carte de modélisation
              </label>
              <ModelingLayerControl
                currentModelingLayer={currentModelingLayer}
                onModelingLayerChange={onModelingLayerChange}
                selectedPollutant={selectedPollutant}
                selectedTimeStep={selectedTimeStep}
              />
            </div>

            {/* Sources spéciales */}
            {(onOpenSignalAirPanel || onOpenMobileAirPanel) && (
              <div className="space-y-1 border-t border-gray-200 pt-4">
                <label className="text-sm font-medium text-gray-700">
                  Sources spéciales
                </label>
                <div className="flex flex-wrap gap-2">
                  {onOpenSignalAirPanel && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSignalAirPanel();
                        setIsOpen(false);
                      }}
                      className="px-3 py-2.5 min-h-[44px] text-sm font-medium rounded-lg border border-[#13A0DB]/40 text-[#13A0DB] bg-[#13A0DB]/5 hover:bg-[#13A0DB]/10 active:bg-[#13A0DB]/15 transition-colors touch-manipulation"
                    >
                      Ouvrir SignalAir
                    </button>
                  )}
                  {onOpenMobileAirPanel && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMobileAirPanel();
                        setIsOpen(false);
                      }}
                      className="px-3 py-2.5 min-h-[44px] text-sm font-medium rounded-lg border border-green-500/40 text-green-700 bg-green-500/5 hover:bg-green-500/10 active:bg-green-500/15 transition-colors touch-manipulation"
                    >
                      Ouvrir MobileAir
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mode historique */}
            <div className="space-y-1 border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-700">Mode</label>
              <HistoricalModeButton
                isActive={isHistoricalModeActive}
                onToggle={onToggleHistoricalMode}
                disabled={!isHistoricalModeAllowed}
              />
            </div>

            {/* Auto-refresh */}
            <div className="space-y-1 border-t border-gray-200 pt-4">
              <label className="text-sm font-medium text-gray-700">
                Actualisation
              </label>
              <AutoRefreshControl
                enabled={autoRefreshEnabled && !isHistoricalModeActive}
                onToggle={onToggleAutoRefresh}
                lastRefresh={lastRefresh}
                loading={loading}
                selectedTimeStep={selectedTimeStep}
              />
            </div>

            {/* Bouton fermer */}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-[#4271B3] text-white rounded-md hover:bg-[#325a96] transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileMenuBurger;
