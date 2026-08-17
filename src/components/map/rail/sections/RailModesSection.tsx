import React from "react";
import { useTranslation } from "react-i18next";
import HistoricalModeButton from "../../../controls/HistoricalModeButton";
import SpecialSourceHeaderDropdown from "../../../controls/SpecialSourceHeaderDropdown";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import { IconHistorical, IconSpecialSources } from "../railIcons";
import {
  RAIL_FLYOUT_CLASS,
  RAIL_FLYOUT_SIDE_OFFSET,
  railFlyoutSide,
} from "../railFlyout";
import type { RailOrientation } from "../useRailRoving";

export interface RailModesSectionProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Groupe « modes » : sources spéciales et mode historique.
 *
 * Les deux relèvent du même registre — ils changent la NATURE de ce qui est
 * affiché, là où le groupe « données » ne fait que filtrer. La modélisation les a
 * quittés pour le sous-menu du fond de carte, laissant les sources spéciales
 * seules dans leur groupe : les réunir évite un séparateur pour un unique item.
 *
 * Ce groupe n'est JAMAIS gelé pendant la lecture : le mode historique est
 * précisément le contrôle dont l'utilisateur a besoin pour l'arrêter.
 */
export const RailModesSection: React.FC<RailModesSectionProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { historical, specialSources } = useMapControls();
  const { t } = useTranslation();

  const flyout = {
    menuSide: railFlyoutSide(orientation),
    menuAlign: "start" as const,
    menuSideOffset: RAIL_FLYOUT_SIDE_OFFSET,
    menuClassName: RAIL_FLYOUT_CLASS,
  };

  return (
    <RailSection
      label={t("rail.groupModes")}
      orientation={orientation}
      separated
    >
      {/* Sources spéciales */}
      <SpecialSourceHeaderDropdown
        onSignalAirClick={specialSources.onSignalAirClick}
        onMobileAirClick={specialSources.onMobileAirClick}
        isSignalAirVisible={specialSources.isSignalAirVisible}
        isMobileAirVisible={specialSources.isMobileAirVisible}
        onSignalAirToggle={specialSources.onSignalAirToggle}
        onMobileAirToggle={specialSources.onMobileAirToggle}
        hasSignalAirData={specialSources.hasSignalAirData}
        hasMobileAirData={specialSources.hasMobileAirData}
        {...flyout}
        renderTrigger={() => (
          <RailItem
            itemId="special-sources"
            data-testid="rail-special-sources-trigger"
            // Nom accessible préservé : e2e/signalair-mobileair.spec.ts en dépend
            aria-label={t("controls.specialSourcesAria")}
            aria-haspopup="menu"
            onFocus={onItemFocus}
            label={t("controls.specialSources")}
            icon={<IconSpecialSources />}
            caption={t("rail.caption.specialSources")}
            dot={
              specialSources.hasSignalAirData || specialSources.hasMobileAirData
                ? "ok"
                : "none"
            }
          />
        )}
      />

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
