import type { Page } from "@playwright/test";

/**
 * Clé de persistance des tutoriels guidés (cf. src/config/tours/types.ts).
 */
export const TOUR_STORAGE_KEY = "openairmap-tours-completed";

/**
 * Marque les tutoriels comme déjà vus, avant tout chargement de page.
 *
 * Sans cela, GlobalAppTourController démarre le tour « app_overview » 900 ms après
 * le montage dès que la fenêtre fait au moins 1280 px de large et que le localStorage
 * est vide — ce qui est le cas de chaque contexte Playwright. L'overlay driver.js
 * intercepte alors tous les clics et fait échouer les tests d'interaction.
 *
 * À appeler avant `page.goto()`. Le script est rejoué à chaque navigation, y compris
 * les `reload()`.
 */
export const seedToursCompleted = async (page: Page): Promise<void> => {
  await page.addInitScript((storageKey: string) => {
    const now = new Date().toISOString();
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        app_overview: { completedAt: now, skipped: true },
        historical_mode: { completedAt: now, skipped: true },
      })
    );
  }, TOUR_STORAGE_KEY);
};

/**
 * Rétablit l'affichage des tutoriels pour les tests qui les ciblent explicitement.
 *
 * Les scripts d'initialisation s'exécutent dans leur ordre d'ajout : celui-ci doit donc
 * être enregistré après `seedToursCompleted` pour le neutraliser, puis suivi d'un
 * `page.goto()` ou `page.reload()`.
 */
export const clearToursCompleted = async (page: Page): Promise<void> => {
  await page.addInitScript((storageKey: string) => {
    localStorage.removeItem(storageKey);
  }, TOUR_STORAGE_KEY);
};
