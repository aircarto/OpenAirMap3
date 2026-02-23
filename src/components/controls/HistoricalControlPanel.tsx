import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HistoricalControlPanelProps } from "../../types";
import PollutionEpisodeCalendar from "./PollutionEpisodeCalendar";

const HistoricalControlPanel: React.FC<
  HistoricalControlPanelProps & {
    onLoadData?: () => void;
    onSeekToDate?: (date: string) => void;
    onGoToPrevious?: () => void;
    onGoToNext?: () => void;
    onToggleHistoricalMode?: () => void;
    onPanelVisibilityChange?: (visible: boolean) => void;
    onExpandRequest?: (expandFn: () => void) => void;
    onOpenPlaybackPanel?: () => void; // Fonction pour rouvrir le panel de contrôle de lecture
    selectedPollutant?: string; // Polluant sélectionné pour filtrer les épisodes
  }
> = ({
  isVisible,
  state,
  controls,
  onLoadData,
  onSeekToDate,
  onGoToPrevious,
  onGoToNext,
  onToggleHistoricalMode,
    onPanelVisibilityChange,
    onExpandRequest,
    onOpenPlaybackPanel,
    selectedPollutant,
}) => {
  const { t } = useTranslation();
  // Fonction pour développer le panel (exposée via ref)
  const expandPanel = useCallback(() => {
    setIsExpanded(true);
    setIsPanelVisible(true);
    userManuallyOpenedRef.current = true;
  }, []);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const userManuallyOpenedRef = useRef(false); // Pour suivre si l'utilisateur a manuellement rouvert le panel

  // Rabattre le panel en cliquant à l'extérieur (au lieu de le fermer)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        isExpanded
      ) {
        setIsExpanded(false);
      }
    };

    if (isVisible && isPanelVisible && isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, isPanelVisible, isExpanded]);

  // Réinitialiser la visibilité du panel quand le mode historique est activé
  // Mais ne pas réinitialiser si l'utilisateur a manuellement ouvert le panel
  useEffect(() => {
    if (isVisible && !userManuallyOpenedRef.current) {
      setIsPanelVisible(true);
      setIsExpanded(true);
    }
  }, [isVisible]);

  // Exposer la fonction d'expansion au parent via callback
  useEffect(() => {
    if (onExpandRequest) {
      // Utiliser une fonction qui stocke la référence
      (onExpandRequest as any)(expandPanel);
    }
  }, [onExpandRequest, expandPanel]);

  // Rabattre le panel après le chargement des données (au lieu de le fermer)
  useEffect(() => {
    if (
      state.data.length > 0 &&
      !state.loading &&
      isExpanded &&
      !userManuallyOpenedRef.current
    ) {
      setIsExpanded(false);
    }
  }, [state.data.length, state.loading, isExpanded]);

  // Notifier le parent des changements de visibilité (seulement si le panel est complètement fermé)
  useEffect(() => {
    // Ne notifier que si le panel est complètement fermé, pas juste rabattu
    if (!isPanelVisible) {
      onPanelVisibilityChange?.(false);
    }
  }, [isPanelVisible, onPanelVisibilityChange]);

  if (!isVisible) return null;

  // Déterminer la période maximale en fonction du pas de temps
  const getMaxDateRange = () => {
    // Si le pas de temps est "15 minutes", limiter à 7 jours
    if (state.timeStep === "quartHeure") {
      return 7;
    }
    // Si le pas de temps est "heure", limiter à 30 jours
    if (state.timeStep === "heure") {
      return 30;
    }
    // Pour les autres pas de temps, garder 365 jours
    return 365;
  };

  const maxDateRange = getMaxDateRange();
  const isDataReady = state.startDate && state.endDate && !state.loading;
  const hasError = state.error !== null;

  return (
    <>
      {/* Panel principal */}
      {isPanelVisible && (
        <div
          ref={panelRef}
          className={`fixed top-[60px] right-4 z-[2000] bg-white border border-gray-300 rounded-lg shadow-xl max-w-md w-full transition-all duration-300 overflow-hidden ${
            isExpanded ? "max-h-[90vh]" : "h-auto"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">
                {t("historical.panelTitle")}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              {/* Bouton pour rouvrir le panel de contrôle de lecture (visible uniquement si des données sont chargées) */}
              {state.data.length > 0 && onOpenPlaybackPanel && (
                <button
                  type="button"
                  onClick={onOpenPlaybackPanel}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={t("historical.reopenPlaybackPanel")}
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
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(!isExpanded);
                  if (!isExpanded) {
                    userManuallyOpenedRef.current = true;
                  }
                }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title={isExpanded ? t("common.collapse") : t("common.expand")}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title={t("historical.collapsePanel")}
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
              {onToggleHistoricalMode && (
                <button
                  type="button"
                  onClick={onToggleHistoricalMode}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors"
                  title={t("historical.disableHistorical")}
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {isExpanded ? (
            <div className="p-4 space-y-4 max-h-[calc(90vh-80px)] overflow-y-auto">
              {/* Instructions */}
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                <div className="flex items-start space-x-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
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
                  <div>
                    <p className="font-medium text-blue-800">
                      {t("historical.instructionTitle")}
                    </p>
                    <p className="text-blue-700 mt-1">
                      {t("historical.instructionMarkers")}
                    </p>
                    {(state.timeStep === "qh" || state.timeStep === "quartHeure") && (
                      <p className="text-blue-700 mt-1 italic">
                        {t("historical.limit7days")}
                      </p>
                    )}
                    {(state.timeStep === "h" || state.timeStep === "heure") && (
                      <p className="text-blue-700 mt-1 italic">
                        {t("historical.limit30days")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Calendrier des épisodes de pollution */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-700">
                  {t("historical.selectTimePeriod")}
                </div>
                <PollutionEpisodeCalendar
                  selectedPollutant={selectedPollutant || ""}
                  selectedStartDate={state.startDate}
                  selectedEndDate={state.endDate}
                  onDateRangeChange={(startDate, endDate) => {
                    controls.onStartDateChange(startDate);
                    controls.onEndDateChange(endDate);
                  }}
                maxDateRange={maxDateRange}
              />
              </div>

              {/* État de chargement */}
              {state.loading && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm">
                    {t("historical.loadingHistorical")}
                  </span>
                </div>
              )}

              {/* Erreur */}
              {hasError && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm">{state.error}</span>
                </div>
              )}

              {/* Bouton de chargement */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => isDataReady && onLoadData?.()}
                  disabled={!isDataReady || state.loading}
                  className={`
                flex-1 px-4 py-2 rounded-md font-medium text-sm transition-colors
                ${
                  isDataReady && !state.loading
                    ? "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }
              `}
                >
                  {state.loading ? t("common.loading") : t("historical.loadData")}
                </button>

                <button
                  type="button"
                  onClick={controls.onReset}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                >
                  {t("common.reset")}
                </button>
              </div>

              {/* Informations sur les données */}
              {state.data.length > 0 && (
                <div className="bg-green-50 p-3 rounded-md">
                  <div className="flex items-center space-x-2 text-green-800">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      {t("historical.dataLoadedPoints", { count: state.data.length })}
                    </span>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="p-2 text-center text-sm text-gray-500">
              {t("historical.panelCollapsed")}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HistoricalControlPanel;
