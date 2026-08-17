import React from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../../controls/LanguageSwitcher";
import TourReplayButton from "../../../tour/TourReplayButton";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import {
  RAIL_FLYOUT_CLASS,
  RAIL_FLYOUT_SIDE_OFFSET,
  railFlyoutSide,
} from "../railFlyout";
import { IconInfo, IconLanguage, IconTour } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";

export interface RailFooterProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Pied du rail : langue, tutoriel, informations.
 *
 * Ce groupe n'est PAS gelé pendant la lecture historique, contrairement au
 * header actuel qui atténuait aussi langue/tutoriel/infos (App.tsx:733).
 * Empêcher de changer de langue ou d'ouvrir les informations parce qu'une
 * animation temporelle est en cours n'a pas de justification.
 */
export const RailFooter: React.FC<RailFooterProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { ui } = useMapControls();
  const { t } = useTranslation();

  return (
    <RailSection
      label={t("rail.groupUtilities")}
      orientation={orientation}
      separated
    >
      <LanguageSwitcher
        menuSide={railFlyoutSide(orientation)}
        menuAlign="end"
        menuSideOffset={RAIL_FLYOUT_SIDE_OFFSET}
        menuClassName={RAIL_FLYOUT_CLASS}
        renderTrigger={({ displayText, code }) => (
          <RailItem
            itemId="language"
            data-testid="rail-language-trigger"
            aria-label={t("common.chooseLanguage")}
            aria-haspopup="menu"
            title={displayText}
            onFocus={onItemFocus}
            label={t("common.chooseLanguage")}
            icon={<IconLanguage />}
            caption={code}
          />
        )}
      />

      <TourReplayButton
        tourId="app_overview"
        renderTrigger={({ label, disabled, onReplay }) => (
          <RailItem
            itemId="tour"
            data-testid="rail-tour-replay"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onReplay}
            onFocus={onItemFocus}
            label={label}
            icon={<IconTour />}
          />
        )}
      />

      <RailItem
        itemId="info"
        data-testid="rail-info-button"
        // Libellé conservé mot pour mot : e2e/smoke.spec.ts cible ce nom
        aria-label={t("app.infoButton")}
        title={t("app.infoButton")}
        onClick={ui.onOpenInfoModal}
        onFocus={onItemFocus}
        label={t("app.infoButton")}
        icon={<IconInfo />}
      />
    </RailSection>
  );
};

export default RailFooter;
