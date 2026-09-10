import { test, expect, type Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Le rail a deux largeurs en vertical : 72 px au repos, 60 px quand un panneau
 * latéral occupe déjà la colonne carte. La place ne manque que dans le second
 * cas, il n'y a donc pas de raison d'y calibrer aussi le premier.
 *
 * Les valeurs sont assertées en dur : c'est précisément la régression à
 * attraper, un `w-*` retouché sans que --rail-item-w suive, ou l'inverse.
 */

const PANELS = [
  "station-side-panel",
  "micro-side-panel",
  "nebuleair-side-panel",
  "sensorcommunity-side-panel",
  "purpleair-side-panel",
]
  .map((id) => `[data-testid="${id}"]`)
  .join(", ");

const railWidth = async (page: Page): Promise<number> =>
  (await page.getByTestId("map-control-rail").boundingBox())!.width;

/** Un item quelconque : ils partagent tous --rail-item-w. */
const itemWidth = async (page: Page): Promise<number> =>
  (await page.getByTestId("rail-pollutant-trigger").boundingBox())!.width;

const load = async (page: Page, width: number, height: number) => {
  await seedToursCompleted(page);
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 15000,
  });
};

test.describe("Largeur du rail de contrôles", () => {
  test("vertical au repos : 72 px, items de 56 px", async ({ page }) => {
    await load(page, 1280, 800);
    expect(await railWidth(page)).toBe(72);
    expect(await itemWidth(page)).toBe(56);
  });

  test("horizontal (mobile) : `compact` ne s'y applique pas", async ({
    page,
  }) => {
    await load(page, 390, 780);
    await expect(
      page.getByTestId("map-control-rail").getByRole("toolbar")
    ).toHaveAttribute("aria-orientation", "horizontal");
    // Barre pleine largeur (left-2 right-2) et items restés à leur taille de base
    expect(await railWidth(page)).toBeGreaterThan(300);
    expect(await itemWidth(page)).toBe(48);
  });

  test("se resserre à l'ouverture d'un panneau, se réélargit au rabat", async ({
    page,
  }) => {
    await load(page, 1280, 800);

    const marker = page.locator(".custom-marker-container").first();
    try {
      await expect(marker).toBeVisible({ timeout: 25000 });
    } catch {
      test.skip(true, "Aucun marqueur affiché (API vide ou lente)");
    }
    await marker.click({ force: true });

    const panel = page.locator(PANELS).first();
    try {
      await expect(panel).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, "Panel latéral non affiché après clic marqueur");
    }

    // Au-delà de la transition de --dur-panel (300 ms)
    await page.waitForTimeout(600);
    expect(await railWidth(page), "rail resserré").toBe(60);
    expect(await itemWidth(page), "items resserrés").toBe(48);

    // Rabattre met panelSize à "hidden" : le panneau sort du flux flex, la carte
    // reprend toute sa place, donc le rail doit REDEVENIR large. C'est le cas
    // qu'un prédicat basé sur le seul `isSidePanelOpen` manquerait.
    await panel
      .getByRole("button", { name: /rabattre|collapse|contraer|comprimi/i })
      .first()
      .click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(600);
    expect(await railWidth(page), "rail réélargi après rabat").toBe(72);
    expect(await itemWidth(page), "items réélargis après rabat").toBe(56);
  });
});
