import React from "react";
import { useTranslation } from "react-i18next";
import BaseLayerControl from "../../../controls/BaseLayerControl";
import ModelingLayerControl from "../../../controls/ModelingLayerControl";
import AirCrowdWmsControls from "../../../controls/AirCrowdWmsControls";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import { RAIL_FLYOUT_CLASS } from "../railFlyout";
import { IconBaseLayer } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";
import type { BaseLayerControlBinding } from "../railBindings";

export interface RailBaseLayerSectionProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
  baseLayer: BaseLayerControlBinding;
}

/**
 * Groupe « fond de carte », isolé en fin de zone défilante.
 *
 * Le choix de couche Azur / AirCrowd est gelé hors Live : l’instant unique
 * de la TimeBar ne doit pas changer de nappe en cours d’exploration.
 */
export const RailBaseLayerSection: React.FC<RailBaseLayerSectionProps> = ({
  orientation,
  onItemFocus,
  baseLayer,
}) => {
  const { t } = useTranslation();
  const { filters, modeling, airCrowdWms, ui } = useMapControls();

  return (
    <RailSection
      label={t("rail.groupBaseLayer")}
      orientation={orientation}
      separated
    >
      <BaseLayerControl
        {...baseLayer}
        placement={orientation === "vertical" ? "right" : "top"}
        panelClassName={RAIL_FLYOUT_CLASS}
        isModelingActive={Boolean(modeling.currentModelingLayer)}
        modelingSlot={
          <div className="flex flex-col gap-3">
            <ModelingLayerControl
              variant="inline"
              currentModelingLayer={modeling.currentModelingLayer}
              onModelingLayerChange={modeling.onModelingLayerChange}
              selectedPollutant={filters.selectedPollutant}
              selectedTimeStep={filters.selectedTimeStep}
              locked={ui.controlsLocked}
            />
          </div>
        }
        isAirCrowdActive={airCrowdWms.enabled}
        airCrowdSlot={
          airCrowdWms.featureEnabled ? (
            <AirCrowdWmsControls
              enabled={airCrowdWms.enabled}
              onEnabledChange={airCrowdWms.onEnabledChange}
              selectedPollutant={filters.selectedPollutant}
              locked={ui.controlsLocked}
            />
          ) : null
        }
        renderTrigger={({ isOpen, label }) => (
          <RailItem
            itemId="baselayer"
            data-testid="rail-basemap-trigger"
            aria-label={`${t("baseLayer.title")} : ${label}`}
            title={`${t("baseLayer.title")} : ${label}`}
            onFocus={onItemFocus}
            active={isOpen}
            label={t("baseLayer.title")}
            icon={<IconBaseLayer />}
            caption={t("rail.caption.baseLayer")}
          />
        )}
      />
    </RailSection>
  );
};

export default RailBaseLayerSection;
