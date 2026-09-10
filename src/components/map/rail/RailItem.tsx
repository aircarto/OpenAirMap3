import React from "react";
import { cn } from "../../../lib/utils";
import { RAIL_ITEM_ATTR } from "./useRailRoving";

export interface RailItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Identifiant stable, support du roving tabindex */
  itemId: string;
  /** Libellé complet, invisible mais lu — associé via <label htmlFor> par l'appelant */
  label: string;
  /** Valeur courante affichée sous l'icône (≤ 6 caractères) */
  caption?: React.ReactNode;
  icon: React.ReactNode;
  /** Valeur non par défaut, calque actif : halo diffusé derrière le verre */
  active?: boolean;
  /** État vide signifiant, ex. aucune source sélectionnée */
  warning?: boolean;
  /** Pastille d'alerte (données disponibles sur une source spéciale) */
  dot?: "ok" | "none";
}

/**
 * Bouton du rail : icône + valeur courante.
 *
 * Le rail n'est jamais « icône seule » sur le plan de l'information : le bouton
 * du header EST la valeur aujourd'hui (« PM₂.₅ », « 3 sources sélectionnées »,
 * « Heure »). Réduire cela à des icônes obligerait à ouvrir trois menus pour
 * savoir ce que l'on regarde — une régression fonctionnelle.
 *
 * L'activation est un halo diffusé DERRIÈRE la surface dépolie, jamais un
 * remplissage plein : c'est la thèse esthétique du dépoli optique.
 */
export const RailItem = React.forwardRef<HTMLButtonElement, RailItemProps>(
  (
    {
      itemId,
      label,
      caption,
      icon,
      active = false,
      warning = false,
      dot = "none",
      className,
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      {...{ [RAIL_ITEM_ATTR]: itemId }}
      className={cn(
        // La largeur vient de --rail-item-w (48px par défaut, 56px quand le rail
        // vertical n'est pas comprimé par un panneau). La hauteur reste fixe : le
        // gain de lisibilité est horizontal, et le rail est déjà sous
        // max-h + défilement sur un viewport court.
        "rail-item group relative flex h-12 w-[var(--rail-item-w)] shrink-0 flex-col items-center justify-center gap-0.5",
        // transition: voir .rail-item dans index.css (deux durées par propriété)
        "rounded-[var(--r-md)]",
        // Pas de transform au survol : un scale décale la mise en page voisine
        "hover:bg-white/50",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
      {...props}
    >
      {/* Barre interne : marque l'état ouvert, actif ou vide sans remplir le fond */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full transition-opacity [transition-duration:var(--dur-base)]",
          "opacity-0 group-aria-expanded:opacity-100",
          warning
            ? "bg-[color:var(--fg-warn)] opacity-100"
            : "bg-[hsl(var(--brand-500))]"
        )}
      />

      <span
        aria-hidden="true"
        className={cn(
          "flex h-[22px] w-[22px] items-center justify-center transition-colors [transition-duration:var(--dur-base)]",
          warning
            ? "text-[color:var(--fg-warn)]"
            : active
            ? "text-[hsl(var(--brand-700))]"
            : "text-[color:var(--fg-muted)] group-hover:text-[color:var(--fg)]"
        )}
      >
        {icon}
      </span>

      {caption !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "max-w-full overflow-hidden text-[10px] font-semibold leading-none tabular-nums",
            // clip et non ellipsis : une caption est un budget de 6 caractères,
            // pas du texte à tronquer
            "[text-overflow:clip] whitespace-nowrap",
            warning ? "text-[color:var(--fg-warn)]" : "text-[color:var(--fg)]"
          )}
        >
          {caption}
        </span>
      )}

      {dot === "ok" && (
        <span
          aria-hidden="true"
          // Dans les limites du bouton, et non en débord type -top-1 -right-1 :
          // la pastille resterait lisible mais mordrait sur l'item voisin dans
          // la colonne étroite (60 px quand un panneau comprime la carte).
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[color:var(--fg-ok)] ring-2 ring-[rgb(var(--glass-tint))]"
        />
      )}

      {/* Halo d'activation : lumière derrière le verre, pas de peinture dessus */}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[var(--r-md)]"
          style={{ boxShadow: "inset 0 0 12px hsl(var(--brand-400) / 0.35)" }}
        />
      )}
    </button>
  )
);

RailItem.displayName = "RailItem";

export default RailItem;
