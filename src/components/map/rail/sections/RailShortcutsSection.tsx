import React from "react";
import { useTranslation } from "react-i18next";
import MapFloatingActions from "../../MapFloatingActions";
import RailSection from "../RailSection";
import type { RailOrientation } from "../useRailRoving";
import type { RailShortcutsBinding } from "../railBindings";

export interface RailShortcutsSectionProps {
  orientation: RailOrientation;
  shortcuts: RailShortcutsBinding;
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
}) => {
  const { t } = useTranslation();

  return (
    <RailSection
      label={t("rail.groupPanels")}
      orientation={orientation}
      separated
    >
      <MapFloatingActions {...shortcuts} t={t} />
    </RailSection>
  );
};

export default RailShortcutsSection;
