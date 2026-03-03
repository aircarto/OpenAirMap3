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
 * Toggle pour l'actualisation automatique des données.
 * - Variante compacte plus discrète pour les menus denses (ex. dropdown sources)
 * - Variante normale plus lisible pour le menu mobile
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
      className={`flex items-center gap-2 ${
        compact ? "py-1.5 px-1.5" : "py-2.5 px-2"
      }`}
    >
      <button
        type="button"
        onClick={() => !isDisabled && onToggle(!enabled)}
        disabled={isDisabled}
        aria-checked={enabled}
        role="switch"
        aria-label={t("controls.autoRefresh")}
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4271B3] focus:ring-offset-2 ${
          isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${
          compact
            ? enabled
              ? "h-[18px] w-[30px] bg-[#4271B3]/90"
              : "h-[18px] w-[30px] bg-gray-200"
            : enabled
            ? "h-6 w-11 bg-[#4271B3]"
            : "h-6 w-11 bg-gray-200"
        }`}
      >
        <span
          className={`inline-block transform rounded-full bg-white shadow-sm transition-transform ${
            compact
              ? `h-3 w-3 ${
                  enabled ? "translate-x-[14px]" : "translate-x-[3px]"
                }`
              : `h-4 w-4 ${enabled ? "translate-x-6" : "translate-x-1"}`
          }`}
        />
      </button>
      <span
        className={
          compact
            ? "text-xs font-normal text-gray-500"
            : "text-sm font-medium text-gray-700"
        }
      >
        {t("controls.autoRefresh")}
      </span>
      {loading && (
        <div
          className={`rounded-full animate-pulse shrink-0 ${
            compact ? "w-1.5 h-1.5 bg-[#4271B3]/70" : "w-2 h-2 bg-[#4271B3]"
          }`}
          aria-hidden
        />
      )}
    </div>
  );
};

export default AutoRefreshToggle;
