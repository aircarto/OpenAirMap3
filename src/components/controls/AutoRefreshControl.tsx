import React from "react";
import { useTranslation } from "react-i18next";
import { getDisplayedPeriod } from "../../utils/dataPeriodUtils";

interface AutoRefreshControlProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  lastRefresh?: Date | null;
  loading?: boolean;
  selectedTimeStep: string;
  historicalCurrentDate?: string; // Date actuellement affichée en mode historique
}

/**
 * Composant tout-en-un : toggle + label + indicateur de statut + période.
 * Préférer AutoRefreshToggle (dans le menu Sources) + période dans DeviceStatistics (carte).
 * Conservé pour usage optionnel (ex. écrans dédiés).
 */
const AutoRefreshControl: React.FC<AutoRefreshControlProps> = ({
  enabled,
  onToggle,
  loading = false,
  selectedTimeStep,
  historicalCurrentDate,
}) => {
  const { t, i18n } = useTranslation();
  const displayedPeriod = getDisplayedPeriod(
    selectedTimeStep,
    historicalCurrentDate,
    i18n.language
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        disabled={loading}
        aria-checked={enabled}
        role="switch"
        aria-label={t("controls.autoRefresh")}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4271B3] focus:ring-offset-2 ${
          enabled ? "bg-[#4271B3]" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>

      <span className="text-xs font-medium text-gray-700">
        {t("controls.autoRefresh")}
      </span>

      <div className="flex items-center space-x-1">
        {loading ? (
          <div className="w-2 h-2 bg-[#4271B3] rounded-full animate-pulse" />
        ) : enabled ? (
          <div className="w-2 h-2 bg-[#4271B3] rounded-full" />
        ) : (
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
        )}
      </div>

      {displayedPeriod && (
        <>
          <div className="w-px h-4 bg-gray-300" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-600">{t("controls.period")}</span>
            <span className="text-xs font-medium text-gray-800">
              {displayedPeriod}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default AutoRefreshControl;
