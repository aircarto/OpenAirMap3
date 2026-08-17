import React from "react";
import { useTranslation } from "react-i18next";
import ModelingLayerControl from "../../../controls/ModelingLayerControl";
import SpecialSourceHeaderDropdown from "../../../controls/SpecialSourceHeaderDropdown";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import {
  RAIL_FLYOUT_CLASS,
  RAIL_FLYOUT_SIDE_OFFSET,
  railFlyoutSide,
} from "../railFlyout";
import { IconModeling, IconSpecialSources } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";

export interface RailLayersSectionProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Groupe « couches de données » : modélisation et sources spéciales.
 *
 * Le fond de carte a sa propre section (RailBaseLayerSection) : ces deux
 * contrôles ajoutent de la donnée SUR la carte, alors que le fond change le
 * support lui-même.
 */
export const RailLayersSection: React.FC<RailLayersSectionProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { filters, modeling, specialSources, ui } = useMapControls();
  const { t } = useTranslation();

  const side = railFlyoutSide(orientation);
  const flyout = {
    menuSide: side,
    menuAlign: "start" as const,
    menuSideOffset: RAIL_FLYOUT_SIDE_OFFSET,
    menuClassName: RAIL_FLYOUT_CLASS,
  };

  return (
    <RailSection
      label={t("rail.groupLayers")}
      orientation={orientation}
      separated
      locked={ui.controlsLocked}
      lockedReason={t("rail.frozenDuringPlayback")}
    >
      {/* Modélisation */}
      <label htmlFor="rail-modeling-trigger" className="sr-only" id="rail-modeling-label">
        {t("controls.modeling")}
      </label>
      <ModelingLayerControl
        currentModelingLayer={modeling.currentModelingLayer}
        onModelingLayerChange={modeling.onModelingLayerChange}
        selectedPollutant={filters.selectedPollutant}
        selectedTimeStep={filters.selectedTimeStep}
        {...flyout}
        renderTrigger={({ disabled }) => (
          <RailItem
            itemId="modeling"
            id="rail-modeling-trigger"
            data-testid="rail-modeling-trigger"
            aria-labelledby="rail-modeling-label rail-modeling-value"
            aria-haspopup="menu"
            aria-describedby={disabled ? "rail-modeling-reason" : undefined}
            disabled={disabled}
            onFocus={onItemFocus}
            label={t("controls.modeling")}
            icon={<IconModeling />}
            active={Boolean(modeling.currentModelingLayer)}
            caption={
              <span id="rail-modeling-value">
                {disabled
                  ? t("rail.caption.modelingOff")
                  : t("rail.caption.modeling")}
              </span>
            }
          />
        )}
      />
      {/* L'état indisponible n'est jamais masqué : il annonce sa raison */}
      <span id="rail-modeling-reason" className="sr-only">
        {t("controls.modelingUnavailableTooltip", {
          defaultValue: t("controls.modelingUnavailable"),
        })}
      </span>

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
        menuAlign="start"
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
    </RailSection>
  );
};

export default RailLayersSection;
