import React from "react";
import { cn } from "../../../lib/utils";

export interface RailSectionProps {
  label: string;
  children: React.ReactNode;
  /** Filet de séparation avant le groupe */
  separated?: boolean;
  /**
   * Verrouillé pendant la lecture historique.
   *
   * `inert` et non `pointer-events-none` : l'ancien traitement du header
   * (`opacity-50 pointer-events-none`) laissait les boutons dans l'ordre de
   * tabulation, focalisables et sans effet, sans raison annoncée. `inert` les
   * retire de l'ordre de tabulation ET de l'arbre d'accessibilité.
   */
  locked?: boolean;
  /** Raison du verrouillage, annoncée aux lecteurs d'écran */
  lockedReason?: string;
  orientation?: "vertical" | "horizontal";
}

/**
 * Groupe d'items du rail.
 *
 * Le filet de séparation est une BORDURE du groupe et non un `<hr>` frère :
 * la section des raccourcis se monte et se démonte, et un `<hr>` frère
 * laisserait un filet orphelin quand le groupe est vide. En bordure, la règle
 * `:empty` suffit à faire disparaître le groupe ET son filet.
 */
export const RailSection: React.FC<RailSectionProps> = ({
  label,
  children,
  separated = false,
  locked = false,
  lockedReason,
  orientation = "vertical",
}) => {
  const isVertical = orientation === "vertical";

  return (
    <div
      role="group"
      aria-label={label}
      // React 19 accepte `inert` comme booléen réel. Surtout, ne pas passer une
      // chaîne vide : React la traite comme `false` et l'attribut n'est jamais
      // appliqué, ce qui rendrait le gel purement cosmétique — les boutons
      // resteraient focalisables et sans effet, le défaut même que l'on corrige.
      inert={locked}
      className={cn(
        "rail-section relative flex shrink-0 items-center gap-1 border-[rgb(16_32_56_/_0.10)]",
        isVertical ? "flex-col" : "flex-row",
        separated &&
          (isVertical ? "mt-1.5 border-t pt-1.5" : "ml-1.5 border-l pl-1.5"),
        locked && "rail-section-frozen"
      )}
    >
      {children}
      {locked && lockedReason && <span className="sr-only">{lockedReason}</span>}
    </div>
  );
};

export default RailSection;
