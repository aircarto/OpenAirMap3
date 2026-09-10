import { useSyncExternalStore } from "react";
import type { RailOrientation } from "./useRailRoving";

/** Correspond au seuil `md` de Tailwind, utilisé par les classes du rail */
const RAIL_MEDIA_QUERY = "(min-width: 768px)";

const subscribe = (onChange: () => void): (() => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const list = window.matchMedia(RAIL_MEDIA_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

const getSnapshot = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(RAIL_MEDIA_QUERY).matches;
};

/**
 * Orientation du rail selon la largeur disponible.
 *
 * Volontairement bâti sur `matchMedia` et NON sur `useIsMobile`, qui exige
 * `hasTouchScreen && innerWidth < 768` : une fenêtre de navigateur de bureau
 * réduite à 500 px y répond « pas mobile » et recevrait un rail vertical dans
 * une fenêtre trop courte pour l'accueillir.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` + effet : la valeur est lue au
 * premier rendu, sans passe intermédiaire à la mauvaise orientation.
 */
export const useRailOrientation = (): RailOrientation =>
  useSyncExternalStore(subscribe, getSnapshot, () => true)
    ? "vertical"
    : "horizontal";
