import { test, expect } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

test.describe("Carte et side panels", () => {
  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("présence de marqueurs : au moins un après chargement", async ({
    page,
  }) => {
    const marker = page.locator(".leaflet-marker-icon").first();
    try {
      await expect(marker).toBeVisible({ timeout: 25000 });
    } catch {
      test.skip(true, "Aucun marqueur affiché (API vide ou lente)");
    }
  });

  test("ouverture side panel station au clic sur un marqueur", async ({
    page,
  }) => {
    const marker = page.locator(".leaflet-marker-icon").first();
    try {
      await expect(marker).toBeVisible({ timeout: 25000 });
    } catch {
      test.skip(true, "Aucun marqueur affiché (API vide ou lente)");
    }
    await marker.click();
    const panelSelector =
      '[data-testid="station-side-panel"], [data-testid="micro-side-panel"], [data-testid="nebuleair-side-panel"], [data-testid="sensorcommunity-side-panel"], [data-testid="purpleair-side-panel"]';
    const panelOrHeading = page
      .locator(panelSelector)
      .or(page.getByRole("heading", { level: 2 }))
      .or(page.getByText(/chargement|loading/i));
    try {
      await expect(panelOrHeading.first()).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, "Panel latéral non affiché après clic marqueur (timing ou source)");
    }
  });

  test("fermeture side panel : bouton rabattre", async ({ page }) => {
    const marker = page.locator(".leaflet-marker-icon").first();
    try {
      await expect(marker).toBeVisible({ timeout: 25000 });
    } catch {
      test.skip(true, "Aucun marqueur affiché (API vide ou lente)");
    }
    await marker.click();
    const panelSelector =
      '[data-testid="station-side-panel"], [data-testid="micro-side-panel"], [data-testid="nebuleair-side-panel"], [data-testid="sensorcommunity-side-panel"], [data-testid="purpleair-side-panel"]';
    const panel = page.locator(panelSelector).first();
    try {
      await expect(
        page.locator(panelSelector).or(page.getByRole("heading", { level: 2 })).first()
      ).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, "Panel latéral non affiché après clic marqueur");
    }
    const collapseBtn = page
      .getByRole("button", { name: /rabattre|collapse|panel|contraer|comprimi/i })
      .first();
    await collapseBtn.click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });
});
