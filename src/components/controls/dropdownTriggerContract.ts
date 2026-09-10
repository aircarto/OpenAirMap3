import type React from "react";

export type DropdownMenuSide = "top" | "right" | "bottom" | "left";
export type DropdownMenuAlign = "start" | "center" | "end";

export interface DropdownTriggerRenderContext {
  /** Texte que le déclencheur affiche aujourd'hui dans le header */
  displayText: string;
  /** Vrai si le contrôle n'a rien à proposer dans le contexte courant */
  disabled?: boolean;
}

/**
 * Contrat commun permettant à un appelant de fournir son propre déclencheur.
 *
 * Sert au rail de contrôles, qui a besoin d'un bouton icône + valeur plutôt que
 * de la pilule du header. Le déclencheur est rendu dans un
 * `<DropdownMenuTrigger asChild>`, il doit donc diffuser ses props et sa ref —
 * `RailItem` et `DropdownButton` le font tous les deux.
 *
 * Le rendu du menu reste la propriété du contrôle : l'appelant n'ajuste que son
 * placement et sa surface. Cela évite d'introduire du JSX spécifique au rail
 * dans `controls/`, et de dupliquer la logique des menus dans le rail.
 */
export interface CustomTriggerProps {
  renderTrigger?: (context: DropdownTriggerRenderContext) => React.ReactNode;
  menuSide?: DropdownMenuSide;
  menuAlign?: DropdownMenuAlign;
  menuSideOffset?: number;
  menuClassName?: string;
}
