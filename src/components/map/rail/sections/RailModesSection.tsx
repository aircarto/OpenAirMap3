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
 * Groupe « modes », réduit au seul mode historique.
 *
 * Il a compté jusqu'à trois items : la modélisation est partie au sous-menu du
 * fond de carte, les sources spéciales aux dépliants du menu Sources. Le groupe
 * survit à un seul item pour une raison qui n'est pas décorative — il est le
 * seul du rail à n'être JAMAIS gelé pendant la lecture, le mode historique
 * étant précisément le contrôle dont l'utilisateur a besoin pour l'arrêter.
 * Fondre ce bouton dans le groupe « données » le figerait avec lui.
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

export default RailModesSection;
