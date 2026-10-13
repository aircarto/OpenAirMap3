import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { isAirCrowdWmsPollutantSupported } from "../../services/AirCrowdWmsLayerService";

interface AirCrowdWmsControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  selectedPollutant: string;
  locked?: boolean;
  className?: string;
}

/**
 * Option « Cartographie AirCrowd » du menu Modélisation.
 * Même présentation que les choix Azur (polluant / vent) : bascule unique.
 * La date/heure est pilotée par la TimeBar.
 */
const AirCrowdWmsControls: React.FC<AirCrowdWmsControlsProps> = ({
  enabled,
  onEnabledChange,
  selectedPollutant,
  locked = false,
  className,
}) => {
  const { t } = useTranslation();
  const pollutantOk = isAirCrowdWmsPollutantSupported(selectedPollutant);
  const disabled = !pollutantOk || locked;
  const isSelected = enabled && pollutantOk;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isSelected}
        data-testid="aircrowd-wms-toggle"
        onClick={() => {
          if (disabled) return;
          onEnabledChange(!enabled);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors",
          isSelected
            ? "border border-[hsl(var(--brand-200))] bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-800))]"
            : "text-gray-700 hover:bg-gray-50/80",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border",
            isSelected
              ? "border-[hsl(var(--brand-600))]"
              : "border-gray-300/60"
          )}
        >
          {isSelected && (
            <span className="h-1.5 w-1.5 rounded-[1px] bg-[hsl(var(--brand-600))]" />
          )}
        </span>
        <span className="truncate">{t("aircrowdWms.title")}</span>
      </button>

      {!pollutantOk ? (
        <p className="px-2.5 text-[11px] text-amber-700">
          {t("aircrowdWms.unsupportedPollutant")}
        </p>
      ) : null}
    </div>
  );
};

export default AirCrowdWmsControls;
