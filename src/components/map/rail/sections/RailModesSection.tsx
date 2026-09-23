import React from "react";
import { useTranslation } from "react-i18next";
import HistoricalModeButton from "../../../controls/HistoricalModeButton";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import { IconHistorical } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";

export interface RailModesSectionProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Groupe « modes » : ouvre le sélecteur de période TimeBar / retour live.
 *
 * Remplace l’ancien Mode Historique (panels legacy non branchés).
 * Jamais gelé pendant la lecture — seul contrôle du rail pour revenir au live.
 */
export const RailModesSection: React.FC<RailModesSectionProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { historical } = useMapControls();
  const { t } = useTranslation();

  return (
    <RailSection
      label={t("rail.groupModes")}
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
            data-tour="historical-toggle"
            aria-pressed={isActive}
            onClick={onToggle}
            // e2e/a11y.spec.ts et e2e/controls.spec.ts ciblent encore ce libellé.
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

export default RailModesSection;
