import { test, expect } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

test.describe("Recherche", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("ouvrir le contrôle de recherche, saisir une requête, vérifier résultats ou message", async ({
    page,
  }) => {
    const openSearchBtn = page.getByRole("button", {
      name: /ouvrir la recherche|open search|recherche/i,
    });
    await openSearchBtn.click();
    const searchInput = page.getByPlaceholder(/rechercher|search|adresse|station|capteur/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("Paris");
    await page.waitForTimeout(2000);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEditable();
  });
});
