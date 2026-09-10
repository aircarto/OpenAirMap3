/**
 * Sélection d'ancres de tutoriel dans le DOM.
 *
 * Le rail peut défiler, et sa barre mobile masque les items hors champ : un
 * sélecteur brut peut donc désigner un élément de taille nulle, sur lequel
 * driver.js poserait sa bulle dans un coin. On retient le premier élément
 * réellement visible et actif.
 */
export const getVisibleTourElement = (selector: string): Element | undefined => {
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const isDisabled =
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.closest("[disabled]") !== null;

    if (isDisabled) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return element;
    }
  }

  return elements[0] ?? undefined;
};


/**
 * Demande au rail de faire défiler un item dans la zone visible.
 *
 * Émis avant la mise en évidence : sans cela driver.js peut cibler un élément
 * hors champ, de rectangle nul, et poser sa bulle dans un coin.
 */
export const revealRailItem = (selector: string): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("openairmap:rail-reveal", { detail: { selector } })
  );
};
