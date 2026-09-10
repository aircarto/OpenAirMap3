import React from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../../controls/LanguageSwitcher";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import {
  RAIL_FLYOUT_CLASS,
  RAIL_FLYOUT_SIDE_OFFSET,
  railFlyoutSide,
} from "../railFlyout";
import { IconInfo, IconLanguage } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";

export interface RailFooterProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Pied du rail : langue et informations.
 *
 * Le replay du tutoriel vit dans la modale d'informations : sur mobile, un
 * troisième item épinglé mangeait la place du mode historique dans la zone
 * défilante. Ce groupe n'est PAS gelé pendant la lecture historique.
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
