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
 * Son panneau porte trois sous-menus : « Modélisation », « Incendie »,
 * puis « Fond de carte » (styles de fond + découpage communal).
 *
 * Séparé du groupe « couches » : la modélisation et les sources spéciales
 * ajoutent de la donnée SUR la carte, tandis que le fond de carte change le
 * support lui-même. Ce sont deux natures de réglage différentes, et le placer
 * juste au-dessus du pied (langue, tutoriel, informations) le range avec les
 * réglages d'affichage plutôt qu'avec les filtres de données.
 *
 * N'est PAS gelé pendant la lecture historique : changer de fond de carte ne
 * touche pas aux données affichées.
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
        isModelingActive={
          Boolean(modeling.currentModelingLayer) || airCrowdWms.enabled
        }
        modelingSlot={
          <div className="space-y-0.5 pl-4 pr-1" data-testid="modeling-inline">
            {airCrowdWms.featureEnabled ? (
              <AirCrowdWmsControls
                enabled={airCrowdWms.enabled}
                onEnabledChange={airCrowdWms.onEnabledChange}
                selectedPollutant={filters.selectedPollutant}
                locked={ui.controlsLocked}
              />
            ) : null}
            <ModelingLayerControl
              variant="inline"
              omitWrapper
              currentModelingLayer={modeling.currentModelingLayer}
              onModelingLayerChange={modeling.onModelingLayerChange}
              selectedPollutant={filters.selectedPollutant}
              selectedTimeStep={filters.selectedTimeStep}
            />
          </div>
        }
        renderTrigger={({ isOpen, label }) => (
          <RailItem
            itemId="baselayer"
            data-testid="rail-basemap-trigger"
            // Ni onClick ni aria-expanded ici : Radix PopoverTrigger les fournit
            // via asChild, et un second basculement annulerait le premier.
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
