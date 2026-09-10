import React from "react";
import { useTranslation } from "react-i18next";
import { HistoricalModeButtonProps } from "../../types";
import { Toggle } from "../ui/toggle";
import { cn } from "../../lib/utils";

export interface HistoricalModeTriggerContext {
  isActive: boolean;
  disabled: boolean;
  /** Infobulle contextuelle : activer, désactiver, ou indisponible */
  title: string;
  /** Libellé visible, utilisé aussi comme nom accessible en mode compact */
  label: string;
  /** Bascule à brancher sur le déclencheur fourni */
  onToggle: () => void;
}

type Props = HistoricalModeButtonProps & {
  /**
   * Déclencheur fourni par l'appelant (rail de contrôles).
   *
   * Quand il est présent, la couche Radix `Toggle` est court-circuitée : ses
   * `defaultVariants` injectent `bg-white border h-10 px-3` et, en position
   * active, un `bg-[#4271B3]` plein, ce qui écrasait la géométrie du rail et
   * contredisait son traitement de l'activation par halo. Le déclencheur reçoit
   * donc l'état et la bascule, et porte lui-même `aria-pressed`.
   *
   * Contrainte non négociable : le nom accessible doit rester le libellé
   * « Mode Historique », dont dépendent e2e/a11y.spec.ts et e2e/controls.spec.ts.
   */
  renderTrigger?: (context: HistoricalModeTriggerContext) => React.ReactNode;
};

const HistoricalModeButton: React.FC<Props> = ({
  isActive,
  onToggle,
  disabled = false,
  renderTrigger,
}) => {
  const { t } = useTranslation();
  const title = disabled
    ? t("controls.historicalModeUnavailableTooltip")
    : isActive
      ? t("controls.historicalModeDeactivate")
      : t("controls.historicalModeActivate");

  const label = disabled
    ? t("controls.historicalModeUnavailable")
    : t("controls.historicalMode");

  if (renderTrigger) {
    return (
      <>
        {renderTrigger({
          isActive,
          disabled,
          title,
          label,
          onToggle: disabled ? () => {} : onToggle,
        })}
      </>
    );
  }

  return (
    <Toggle
      data-tour="historical-toggle"
      pressed={isActive}
      onPressedChange={disabled ? () => {} : onToggle}
      disabled={disabled}
      className={cn(
        "relative flex items-center space-x-2 px-3 py-2 rounded-lg shadow-sm transition-all duration-200",
        "data-[state=on]:bg-gradient-to-br data-[state=on]:from-[#4271B3] data-[state=on]:to-[#325a96]",
        "data-[state=off]:bg-gradient-to-br data-[state=off]:from-gray-50 data-[state=off]:to-white data-[state=off]:border data-[state=off]:border-gray-200/60",
        disabled &&
          "bg-gray-100 border-gray-200 text-gray-400 opacity-100 disabled:!pointer-events-auto disabled:!cursor-not-allowed"
      )}
      title={title}
    >
          {/* Icône horloge */}
          <svg
            className={cn(
              "w-5 h-5 transition-colors",
              disabled
                ? "text-gray-400"
                : isActive
                  ? "text-white"
                  : "text-gray-600"
            )}
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

          {/* Texte du bouton : "(indisponible)" comme le menu modélisation */}
          <span className="font-medium text-sm">{label}</span>

          {/* Indicateur d'état */}
      {isActive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
      )}
    </Toggle>
  );
};

export default HistoricalModeButton;
