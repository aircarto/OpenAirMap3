import { test, expect } from "@playwright/test";

test.describe("Contrôles header et panneaux", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("dropdown Polluant : ouverture et fermeture", async ({ page }) => {
    const trigger = page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /pm|scan|heure|quart|jour|2 min|no available/i })
      .first();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();
  });

  test("dropdown Sources : ouverture et fermeture", async ({ page }) => {
    const trigger = page
      .locator("header")
      .getByRole("button")
      .filter({
        hasText: /sources|source|choisir|choose|atmo|référence|reference/i,
      })
      .first();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();
  });

  test("dropdown Pas de temps : ouverture et fermeture", async ({ page }) => {
    const trigger = page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /heure|hour|scan|quart|jour|day|min/i })
      .first();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();
  });

  test("mode historique : activation et panneau visible", async ({ page }) => {
    const toggle = page
      .getByRole("button", { name: /mode historique|historical mode/i })
      .first();
    await toggle.click();
    await expect(
      page.getByText(/load data|charger|date|période|period|plage/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("modélisation : ouverture du menu", async ({ page }) => {
    const trigger = page
      .locator("header")
      .getByRole("button")
      .filter({
        hasText: /modélisation|modeling|vent|wind|unavailable|indisponible/i,
      })
      .first();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });
});
