import React, { useId, useState } from "react";
import { cn } from "../../lib/utils";

export interface LayerDisclosureProps {
  label: string;
  /** Résumé de l'état courant, affiché à droite du libellé */
  hint?: string;
  /** Marque le groupe comme contenant au moins un calque actif */
  active?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Sous-menu dépliable du panneau de fond de carte.
 *
 * Un dépliant plutôt qu'un sous-menu flottant : le contenu est fait de bascules
 * et de sélecteurs de période, or un vrai sous-menu imposerait la sémantique
 * `menuitem` et son pilotage clavier, mal adaptés à des contrôles à états
 * multiples. Le dépliant garde tout dans une seule surface, sans second niveau
 * de positionnement à gérer.
 *
 * Bouton + `aria-expanded` + `aria-controls` plutôt que `<details>` : le contenu
 * doit rester dans l'arbre d'accessibilité et le style de l'en-tête doit refléter
 * l'état actif, ce que le marqueur natif ne permet pas proprement.
 */
export const LayerDisclosure: React.FC<LayerDisclosureProps> = ({
  label,
  hint,
  active = false,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
          active
            ? "text-[hsl(var(--brand-800))]"
            : "text-[color:var(--fg-muted)] hover:bg-black/[0.04] hover:text-[color:var(--fg)]"
        )}
      >
        <svg
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-[var(--dur-fast)]",
            isOpen && "rotate-90"
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="flex-1 text-left">{label}</span>
        {hint && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-70">
            {hint}
          </span>
        )}
        {active && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--fg-ok)]"
          />
        )}
      </button>
      {isOpen && (
        <div id={contentId} className="pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
};

export default LayerDisclosure;
