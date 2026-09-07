import React from "react";
import { cn } from "../../lib/utils";

export interface PanelReopenBadgeProps {
  /** Infobulle : décrit le bouton de réouverture correspondant. */
  label: string;
  /**
   * Teinte de la pastille. Elle doit rester celle du bouton de réouverture
   * qu'elle rappelle dans le rail (bleu pour les stations, vert pour MobileAir,
   * cyan pour SignalAir) : c'est ce que dit l'infobulle, et une teinte unique
   * rendrait ces libellés faux.
   */
  className?: string;
  /**
   * Glyphe, quand il diffère de l'icône « graphique » par défaut : MobileAir
   * rappelle un boîtier capteur. Attendu sous forme de contenu de `<svg>`
   * (tracés), la balise et sa taille étant fournies ici.
   */
  icon?: React.ReactNode;
}

/**
 * Pastille collée au titre d'un panneau : rappelle visuellement le bouton qui
 * permettra de le rouvrir une fois rabattu.
 *
 * Le même SVG était recopié dans chaque panneau ; seuls la teinte et l'infobulle
 * variaient, et ce sont donc les deux seules choses qui restent paramétrables.
 */
export const PanelReopenBadge: React.FC<PanelReopenBadgeProps> = ({
  label,
  className = "bg-[hsl(var(--brand-600))] text-white",
  icon,
}) => (
  <span
    className={cn(
      "flex shrink-0 items-center rounded-[var(--r-xs)] p-1",
      className
    )}
    title={label}
  >
    <svg
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {icon ?? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      )}
    </svg>
  </span>
);

export default PanelReopenBadge;
