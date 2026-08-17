import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { TourId } from "../../config/tours/types";
import { useFeatureTourContext } from "./featureTourContext";

export interface TourReplayTriggerContext {
  label: string;
  disabled: boolean;
  onReplay: () => void;
}

interface TourReplayButtonProps {
  tourId: TourId;
  className?: string;
  disabled?: boolean;
  /** Affiche uniquement l'icône, dans un bouton carré (ex: barre d'outils desktop) */
  iconOnly?: boolean;
  /** Déclencheur fourni par l'appelant (rail de contrôles) */
  renderTrigger?: (context: TourReplayTriggerContext) => React.ReactNode;
}

const TourReplayButton: React.FC<TourReplayButtonProps> = ({
  tourId,
  className,
  disabled = false,
  iconOnly = false,
  renderTrigger,
}) => {
  const { t } = useTranslation();
  const { startTour, isTourActive } = useFeatureTourContext();
  const label = t("tour.common.replay");
  const isDisabled = disabled || isTourActive;
  const replay = () => startTour(tourId, { replay: true });

  if (renderTrigger) {
    return <>{renderTrigger({ label, disabled: isDisabled, onReplay: replay })}</>;
  }

  const icon = (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={disabled || isTourActive}
        onClick={() => startTour(tourId, { replay: true })}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-[#325A96]/40 text-[#325A96]",
          "transition-colors hover:bg-[#325A96]/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4271B3]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isTourActive}
      onClick={() => startTour(tourId, { replay: true })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
        "text-[#325A96] transition-colors hover:bg-[#4271B3]/10",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4271B3]/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
};

export default TourReplayButton;
