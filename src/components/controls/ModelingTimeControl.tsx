import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { getModelingDisplayedPeriod } from "../../utils/modelingPeriodUtils";

interface ModelingTimeControlProps {
  value: number;
  onChange: (value: number) => void;
  locale?: string;
  disabled?: boolean;
  className?: string;
}

const clampHour = (hour: number) => Math.max(0, Math.min(47, hour));

const ModelingTimeControl: React.FC<ModelingTimeControlProps> = ({
  value,
  onChange,
  locale = "fr",
  disabled = false,
  className,
}) => {
  const { t } = useTranslation();
  const safeValue = clampHour(value);

  const label = useMemo(() => {
    return getModelingDisplayedPeriod(safeValue, locale);
  }, [safeValue, locale]);

  return (
    <div className={cn("flex items-center gap-2 min-w-[220px]", className)}>
      <span
        className={cn(
          "text-xs font-medium tabular-nums px-2 py-1 rounded-md border",
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-400"
            : "bg-white border-gray-200 text-gray-700"
        )}
        title={t("controls.modeling")}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={47}
        step={1}
        value={safeValue}
        disabled={disabled}
        onChange={(e) => onChange(clampHour(Number(e.target.value)))}
        className={cn(
          "w-full accent-[#4271B3]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Heure de modélisation"
      />
    </div>
  );
};

export default ModelingTimeControl;

