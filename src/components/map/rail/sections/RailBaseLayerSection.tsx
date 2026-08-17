import React from "react";
import { useTranslation } from "react-i18next";
import BaseLayerControl from "../../../controls/BaseLayerControl";
import ModelingLayerControl from "../../../controls/ModelingLayerControl";
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
 * Son panneau porte deux sous-menus dépliables : « Modélisation » et
 * « Incendie ». Tous trois touchent au SUPPORT ou aux surfaces peintes sur la
 * carte, par opposition aux filtres de données du haut du rail.
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
  const { filters, modeling } = useMapControls();

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
          <ModelingLayerControl
            variant="inline"
            currentModelingLayer={modeling.currentModelingLayer}
            onModelingLayerChange={modeling.onModelingLayerChange}
            selectedPollutant={filters.selectedPollutant}
            selectedTimeStep={filters.selectedTimeStep}
          />
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
