import type { DropdownMenuSide } from "../../../components/controls/dropdownTriggerContract";

/**
 * Surface commune des menus ouverts depuis le rail.
 *
 * L'arête gauche de 2 px en brand-400 est la « fuite de lumière » : le rail qui
 * déborde dans le panneau. C'est ce qui fait lire une dizaine de popovers
 * séparés comme un seul système, plutôt que comme des boîtes indépendantes.
 */
export const RAIL_FLYOUT_CLASS = [
  "glass-2",
  "rounded-[var(--r-lg)]",
  "min-w-[248px]",
  "max-w-[min(320px,calc(100vw-84px))]",
  "border-l-2 border-l-[hsl(var(--brand-400))]",
].join(" ");

export const RAIL_FLYOUT_SIDE_OFFSET = 10;

/** Vertical : le menu sort à droite du rail. Horizontal (mobile) : au-dessus. */
export const railFlyoutSide = (
  orientation: "vertical" | "horizontal"
): DropdownMenuSide => (orientation === "vertical" ? "right" : "top");
