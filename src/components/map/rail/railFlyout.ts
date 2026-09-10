import type { DropdownMenuSide } from "../../../components/controls/dropdownTriggerContract";

/**
 * Surface commune des menus ouverts depuis le rail.
 *
 * L'arête gauche de 2 px en brand-400 est la « fuite de lumière » : le rail qui
 * déborde dans le panneau. C'est ce qui fait lire une dizaine de popovers
 * séparés comme un seul système, plutôt que comme des boîtes indépendantes.
 */
const RAIL_FLYOUT_BASE = [
  "glass-2",
  "rounded-[var(--r-lg)]",
  "border-l-2 border-l-[hsl(var(--brand-400))]",
].join(" ");

/** Largeurs : `default` pour une liste de choix, `wide` pour du contenu à saisir */
const RAIL_FLYOUT_WIDTHS = {
  default: "min-w-[248px] max-w-[min(320px,calc(100vw-84px))]",
  // 360 px est la largeur en dessous de laquelle les rangées date + heure des
  // sélecteurs de période ne tiennent plus. Le repli `calc(100vw-24px)` vise le
  // rail horizontal (< 768 px), où le menu sort vers le haut et dispose de toute
  // la largeur de la fenêtre, moins ses marges.
  wide: "w-[min(360px,calc(100vw-24px))]",
} as const;

export type RailFlyoutWidth = keyof typeof RAIL_FLYOUT_WIDTHS;

export const railFlyoutClass = (width: RailFlyoutWidth = "default"): string =>
  `${RAIL_FLYOUT_BASE} ${RAIL_FLYOUT_WIDTHS[width]}`;

/** Conservée pour les quatre appelants en largeur par défaut */
export const RAIL_FLYOUT_CLASS = railFlyoutClass("default");

export const RAIL_FLYOUT_SIDE_OFFSET = 10;

/** Vertical : le menu sort à droite du rail. Horizontal (mobile) : au-dessus. */
export const railFlyoutSide = (
  orientation: "vertical" | "horizontal"
): DropdownMenuSide => (orientation === "vertical" ? "right" : "top");
