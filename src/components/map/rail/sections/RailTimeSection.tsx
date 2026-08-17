import React from "react";
import { useTranslation } from "react-i18next";
import HistoricalModeButton from "../../../controls/HistoricalModeButton";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import { IconHistorical } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";

export interface RailTimeSectionProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Groupe « temps » : bascule du mode historique.
 *
 * Ce groupe n'est JAMAIS gelé pendant la lecture, contrairement aux groupes
 * données et couches : c'est précisément le contrôle dont l'utilisateur a besoin
 * pour arrêter la lecture en cours.
 */
export const RailTimeSection: React.FC<RailTimeSectionProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { historical } = useMapControls();
  const { t } = useTranslation();

  return (
    <RailSection
      label={t("rail.groupTime")}
      orientation={orientation}
      separated
    >
      <HistoricalModeButton
        isActive={historical.isActive}
        onToggle={historical.onToggle}
        disabled={!historical.isAllowed}
        renderTrigger={({ isActive, disabled, title, label, onToggle }) => (
          <RailItem
            itemId="historical"
            data-testid="rail-historical-toggle"
            // L'ancre du tutoriel et la sémantique de bascule sont portées ici,
            // la couche Radix Toggle étant court-circuitée en mode rail.
            data-tour="historical-toggle"
            aria-pressed={isActive}
            onClick={onToggle}
            // Nom accessible conservé : e2e/a11y.spec.ts et e2e/controls.spec.ts
            // ciblent le libellé « Mode Historique »
            aria-label={label}
            title={title}
            disabled={disabled}
            onFocus={onItemFocus}
            label={label}
            icon={<IconHistorical />}
            active={isActive}
            dot={isActive ? "ok" : "none"}
            caption={t("rail.caption.historical")}
          />
        )}
      />
    </RailSection>
  );
};

export default RailTimeSection;
