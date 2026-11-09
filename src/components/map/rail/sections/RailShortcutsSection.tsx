import React from "react";
import { useTranslation } from "react-i18next";
import MapFloatingActions from "../../MapFloatingActions";
import RailSection from "../RailSection";
import type { RailOrientation } from "../useRailRoving";
import RailItem from "../RailItem";
import { MapPinPlus } from "lucide-react";
import type {
  RailShortcutsBinding,
  RailSignalementsBinding,
} from "../railBindings";

export interface RailShortcutsSectionProps {
  orientation: RailOrientation;
  shortcuts: RailShortcutsBinding;
  signalements?: RailSignalementsBinding;
  onItemFocus?: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Groupe contextuel : réouverture des panneaux repliés.
 *
 * Rend souvent `null`, et se monte ou se démonte à l'exécution — c'est le cas
 * que le roving tabindex doit encaisser sans laisser le rail inatteignable au
 * clavier (cf. useRailRoving et son test).
 *
 * Reprend les boutons de MapFloatingActions, dont l'enveloppe
 * `fixed left-2 top-1/2` a été supprimée : elle doublonnait le rail et restait
 * par-dessus les panneaux au lieu de se décaler avec la colonne carte.
 */
export const RailShortcutsSection: React.FC<RailShortcutsSectionProps> = ({
  orientation,
  shortcuts,
  signalements,
  onItemFocus,
}) => {
  const { t } = useTranslation();

  return (
    <RailSection
      label={t("rail.groupPanels")}
      orientation={orientation}
      separated
    >
      <MapFloatingActions {...shortcuts} t={t} />
      {signalements && (
        <RailItem
          itemId="signalement-add"
          aria-label={t("signalements.addButton")}
          aria-pressed={signalements.placingMode}
          title={t("signalements.addButton")}
          onClick={signalements.onToggle}
          onFocus={onItemFocus}
          active={signalements.placingMode}
          label={t("signalements.addButton")}
          icon={<MapPinPlus className="h-5 w-5" />}
          caption={t("signalements.railCaption")}
        />
      )}
    </RailSection>
  );
};

export default RailShortcutsSection;
