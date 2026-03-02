import React from "react";
import { useTranslation } from "react-i18next";

interface AutoRefreshToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  loading?: boolean;
  /** Optionnel : désactiver visuellement le toggle (ex. mode historique) */
  disabled?: boolean;
  /** Style compact pour dropdown (une ligne) ou plus espacé pour menu mobile */
  compact?: boolean;
}

/**
 * Toggle compact pour l'actualisation automatique des données.
 * Utilisé dans SourceDropdown et MobileMenuBurger.
 */
const AutoRefreshToggle: React.FC<AutoRefreshToggleProps> = ({
  enabled,
  onToggle,
  loading = false,
  disabled = false,
  compact = true,
}) => {
  const { t } = useTranslation();
  const isDisabled = disabled || loading;

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "py-2 px-1" : "py-2.5 px-2"}`}
    >
      <button
        type="button"
        onClick={() => !isDisabled && onToggle(!enabled)}
        disabled={isDisabled}
        aria-checked={enabled}
        role="switch"
        aria-label={t("controls.autoRefresh")}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4271B3] focus:ring-offset-2 ${
          isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${enabled ? "bg-[#4271B3]" : "bg-gray-200"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-sm font-medium text-gray-700">
        {t("controls.autoRefresh")}
      </span>
      {loading && (
        <div
          className="w-2 h-2 bg-[#4271B3] rounded-full animate-pulse shrink-0"
          aria-hidden
        />
      )}
    </div>
  );
};

export default AutoRefreshToggle;
