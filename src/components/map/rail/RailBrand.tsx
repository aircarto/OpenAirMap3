import React from "react";
import { useTranslation } from "react-i18next";
import { useMapControls } from "../../../contexts/mapControlsContext";

export interface RailBrandProps {
  onOpenAbout: () => void;
}

/**
 * Bloc de marque en tête du rail.
 *
 * Rend le mark CARRÉ (`domainConfig.markSquare`), jamais `logo` ni `logo2` :
 * ceux-ci sont horizontaux (2,5:1 et 4:1) et illisibles dans une colonne de
 * 60 px. Le logo horizontal complet reste utilisé là où il y a de la place —
 * panneau « À propos » et en-tête de la modale d'informations. Repli sur la
 * favicon, seule autre ressource carrée du dépôt, si aucun mark n'est fourni.
 *
 * Le <h1> vit ici, en sr-only : c'est le seul <h1> de la page, six tests e2e
 * l'attendent, et c'est le signal de titre pour les moteurs. Un <h1> non peint
 * reste indexé normalement — ce n'est pas du cloaking, c'est le vrai titre.
 * L'image est en alt="" parce que le <h1> adjacent fournit déjà le nom, et que
 * doubler donnerait une double annonce.
 */
export const RailBrand: React.FC<RailBrandProps> = ({ onOpenAbout }) => {
  const { brand } = useMapControls();
  const { t } = useTranslation();
  const mark = brand.markSquare ?? brand.favicon;

  return (
    <div className="flex shrink-0 flex-col items-center">
      {/* Volontairement hors du `role="toolbar"` et sans data-rail-item : ce
          bouton ouvre une boîte de dialogue, ce n'est pas un contrôle de carte.
          Il constitue donc son propre arrêt de tabulation, avant le rail. */}
      <button
        type="button"
        data-testid="rail-brand"
        onClick={onOpenAbout}
        aria-labelledby="rail-brand-h1"
        aria-haspopup="dialog"
        title={t("aboutPanel.summary")}
        className="rail-item flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] transition-colors duration-[var(--dur-fast)] hover:bg-white/50"
      >
        {/* Pastille assumée : le mark fourni est opaque (RVB sans canal alpha),
            un rendu « à même le verre » donnerait un carré blanc involontaire.
            Le clip arrondi et le filet rendent la tuile intentionnelle, et le
            traitement reste correct pour tout logo opaque, y compris le repli
            sur la favicon. */}
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[var(--r-sm)] bg-white ring-1 ring-[rgb(16_32_56_/_0.08)]">
          <img
            src={mark}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        </span>
      </button>
      <h1 id="rail-brand-h1" className="sr-only">
        {brand.title}
      </h1>
    </div>
  );
};

export default RailBrand;
