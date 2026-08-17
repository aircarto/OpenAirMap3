import React from "react";
import { cn } from "../../../lib/utils";

export interface RailSectionProps {
  label: string;
  children: React.ReactNode;
  /** Filet de séparation au-dessus du groupe */
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

export const RailSection: React.FC<RailSectionProps> = ({
  label,
  children,
  separated = false,
  locked = false,
  lockedReason,
  orientation = "vertical",
}) => (
  <>
    {separated && (
      <hr
        aria-orientation={orientation === "vertical" ? "horizontal" : "vertical"}
        className={cn(
          "shrink-0 border-0 bg-[rgb(16_32_56_/_0.10)]",
          orientation === "vertical" ? "my-1.5 h-px w-8" : "mx-1.5 h-8 w-px"
        )}
      />
    )}
    <div
      role="group"
      aria-label={label}
      // `inert` est un attribut booléen du DOM ; React 19 le sérialise correctement
      {...(locked ? { inert: "" as unknown as boolean } : {})}
      className={cn(
        "relative flex shrink-0 items-center gap-1",
        orientation === "vertical" ? "flex-col" : "flex-row",
        locked && "rail-section-frozen"
      )}
    >
      {children}
      {locked && lockedReason && (
        <span className="sr-only">{lockedReason}</span>
      )}
    </div>
  </>
);

export default RailSection;
