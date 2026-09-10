import React from "react";
import { cn } from "../../lib/utils";

interface NorthArrowProps {
  isSidePanelOpen?: boolean;
  panelSize?: "normal" | "fullscreen" | "hidden";
}

/**
 * Rose des vents de la bande instrument.
 *
 * N'est plus un `L.Control` : le conteneur Leaflet était ancré en `topleft`,
 * exactement là où se place le rail de contrôles, et il devait lutter contre un
 * `z-index: 2500 !important`. Rendue comme élément React dans la colonne carte,
 * elle s'adosse à `--rail-inset` et suit le décalage des panneaux latéraux.
 *
 * Disparaît sous `md`. Cette carte ne tourne pas : sur un petit écran, une
 * boussole immobile sur une carte toujours orientée au nord occupe de la place
 * sans porter d'information. Le masquage tient désormais à une classe CSS, à la
 * place d'un `setTimeout(…, 100)` qui manipulait le DOM après coup.
 */
const NorthArrow: React.FC<NorthArrowProps> = ({
  isSidePanelOpen = false,
  panelSize = "normal",
}) => {
  const hiddenWithPanel = isSidePanelOpen && panelSize !== "hidden";

  return (
    <div
      data-testid="north-arrow"
      aria-hidden="true"
      className={cn(
        "glass-3 pointer-events-none absolute bottom-3 z-map-ambient",
        "hidden flex-col items-center justify-center gap-0.5 px-2 py-1.5",
        "rounded-[var(--r-md)]",
        // Dans l'angle, et non décalée derrière le rail : celui-ci n'occupe que
        // le HAUT du bord gauche. C'est le rail qui réserve la place de cette
        // bande en bas (voir sa max-height), pas la bande qui contourne le rail.
        "left-3",
        hiddenWithPanel ? "md:hidden lg:flex" : "md:flex"
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L16 10L12 8.5L8 10L12 2Z"
          fill="hsl(var(--brand-500))"
          stroke="hsl(var(--brand-700))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 8.5L16 10L12 22L8 10L12 8.5Z"
          fill="rgb(var(--glass-tint))"
          stroke="var(--fg-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[10px] font-bold leading-none text-[color:var(--fg)]">
        N
      </span>
    </div>
  );
};

export default NorthArrow;
