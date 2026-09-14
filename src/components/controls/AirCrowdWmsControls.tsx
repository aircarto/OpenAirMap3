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

/** Toggle de la nappe AirCrowd. La date/heure est pilotée par la TimeBar. */
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

  return (
    <div className={cn("flex flex-col gap-2 px-1", className)}>
      <label
        className={cn(
          "flex min-h-11 items-center gap-2 text-sm font-medium",
          disabled ? "cursor-not-allowed text-gray-400" : "text-gray-800"
        )}
      >
        <input
          type="checkbox"
          className="accent-[#4271B3]"
          checked={enabled && pollutantOk}
          disabled={disabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          data-testid="aircrowd-wms-toggle"
        />
        <span>{t("aircrowdWms.title")}</span>
      </label>

      {!pollutantOk ? (
        <p className="text-xs text-amber-700">
          {t("aircrowdWms.unsupportedPollutant")}
        </p>
      ) : null}
    </div>
  );
};

export default AirCrowdWmsControls;
