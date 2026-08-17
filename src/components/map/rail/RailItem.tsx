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
        "rail-item group relative flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5",
        "rounded-[var(--r-md)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
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
          "pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full transition-opacity duration-[var(--dur-base)]",
          "opacity-0 group-aria-expanded:opacity-100",
          warning
            ? "bg-[color:var(--fg-warn)] opacity-100"
            : "bg-[hsl(var(--brand-500))]"
        )}
      />

      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 items-center justify-center transition-colors duration-[var(--dur-base)]",
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
          // Dans les limites du bouton : le rail porte `contain: paint`, un
          // débord type -top-1 -right-1 serait rogné
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
