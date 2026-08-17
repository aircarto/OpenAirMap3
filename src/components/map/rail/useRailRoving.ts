import { useCallback, useEffect, useRef, useState } from "react";

export type RailOrientation = "vertical" | "horizontal";

/** Attribut porté par chaque déclencheur du rail, valeur = identifiant stable de l'item */
export const RAIL_ITEM_ATTR = "data-rail-item";

const isFocusableItem = (el: HTMLElement): boolean =>
  !el.hasAttribute("disabled") &&
  el.getAttribute("aria-disabled") !== "true" &&
  // un groupe `inert` ou masqué ne doit pas capter le focus
  el.closest("[inert]") === null &&
  el.getAttribute("data-rail-hidden") !== "true";

/**
 * Roving tabindex du rail de contrôles.
 *
 * Le rail s'intercale entre le lien d'évitement et la carte : sans roving, il
 * faudrait onze tabulations pour atteindre la carte, soit une régression par
 * rapport au header. `role="toolbar"` ramène l'ensemble à un seul arrêt.
 *
 * L'index actif est mémorisé par IDENTIFIANT et non par position, parce que le
 * groupe des raccourcis de panneaux se monte et se démonte à l'exécution : un
 * index numérique deviendrait invalide et le rail cesserait d'être atteignable
 * au clavier. Si l'item mémorisé disparaît, on retombe sur le premier item
 * focalisable.
 *
 * Invariant garanti : exactement un `tabIndex = 0` parmi les items focalisables.
 */
export const useRailRoving = (orientation: RailOrientation) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const getItems = useCallback((): HTMLElement[] => {
    const root = containerRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(`[${RAIL_ITEM_ATTR}]`)
    ).filter(isFocusableItem);
  }, []);

  // Volontairement sans tableau de dépendances : le groupe contextuel apparaît
  // et disparaît, et chaque rendu doit rétablir l'invariant.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const all = Array.from(
      root.querySelectorAll<HTMLElement>(`[${RAIL_ITEM_ATTR}]`)
    );
    const focusable = all.filter(isFocusableItem);
    if (focusable.length === 0) {
      all.forEach((el) => (el.tabIndex = -1));
      return;
    }

    const active =
      focusable.find((el) => el.getAttribute(RAIL_ITEM_ATTR) === activeId) ??
      focusable[0];

    all.forEach((el) => (el.tabIndex = el === active ? 0 : -1));
  });

  /**
   * À brancher sur `onKeyDownCapture` du conteneur, et non sur `onKeyDown`.
   *
   * Radix `DropdownMenuTrigger` ouvre son menu sur ArrowDown, ce qui entre en
   * conflit direct avec la navigation du rail. Radix compose les gestionnaires
   * avec `checkForDefaultPrevented`, donc intercepter en phase de CAPTURE —
   * avant que le déclencheur ne voie l'événement — puis appeler
   * `preventDefault()` suffit à lui faire abandonner son ouverture.
   *
   * Répartition des touches, conforme aux pratiques APG pour une barre
   * d'outils de boutons-menu : l'axe visuel navigue, l'axe transverse ouvre.
   */
  const onKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const isVertical = orientation === "vertical";
      const nextKey = isVertical ? "ArrowDown" : "ArrowRight";
      const prevKey = isVertical ? "ArrowUp" : "ArrowLeft";
      const openKey = isVertical ? "ArrowRight" : "ArrowUp";

      const current = (event.target as HTMLElement).closest<HTMLElement>(
        `[${RAIL_ITEM_ATTR}]`
      );

      // Ouverture du menu sur l'axe transverse. Radix n'ouvre que sur Enter,
      // Espace et ArrowDown, or ArrowDown nous sert à naviguer. Un `.click()`
      // programmatique ne suffit pas : le déclencheur Radix réagit à
      // `pointerdown`, que `click()` ne produit pas. On rejoue donc la touche
      // sous la forme d'un Enter, que son gestionnaire de clavier prend en charge.
      if (event.key === openKey) {
        if (!current) return;
        event.preventDefault();
        current.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
        return;
      }

      const isNav =
        event.key === nextKey ||
        event.key === prevKey ||
        event.key === "Home" ||
        event.key === "End";
      if (!isNav) return;

      const items = getItems();
      if (items.length === 0) return;

      // La cible peut être un descendant du bouton (icône, caption)
      const from = current ? items.indexOf(current) : -1;

      let to: number;
      if (event.key === "Home") {
        to = 0;
      } else if (event.key === "End") {
        to = items.length - 1;
      } else if (event.key === nextKey) {
        to = from < 0 ? 0 : (from + 1) % items.length;
      } else {
        to = from <= 0 ? items.length - 1 : from - 1;
      }

      event.preventDefault();
      const target = items[to];
      setActiveId(target.getAttribute(RAIL_ITEM_ATTR));
      target.focus();
    },
    [getItems, orientation]
  );

  /** À brancher sur onFocus des items, pour que le clic souris déplace aussi l'arrêt de tabulation */
  const onItemFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const item = event.target.closest<HTMLElement>(`[${RAIL_ITEM_ATTR}]`);
    if (item) setActiveId(item.getAttribute(RAIL_ITEM_ATTR));
  }, []);

  return { containerRef, onKeyDownCapture, onItemFocus };
};
