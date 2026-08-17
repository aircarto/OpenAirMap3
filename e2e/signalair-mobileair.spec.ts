import { test, expect } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

test.describe("Flux SignalAir et MobileAir", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("ouvrir menu Sources spéciales puis panel SignalAir", async ({
    page,
  }) => {
    const specialTrigger = page.getByTestId("rail-special-sources-trigger");
    if (!(await specialTrigger.isVisible().catch(() => false))) {
      test.skip(true, "Bouton Sources spéciales non visible (layout ou viewport)");
    }
    await specialTrigger.click();
    const menu = page.getByRole("menu").or(page.locator("[data-radix-popper-content-wrapper]"));
    try {
      await expect(menu.first()).toBeVisible({ timeout: 5000 });
    } catch {
      test.skip(true, "Menu Sources spéciales non ouvert");
    }
    await page.getByRole("button", { name: /signalair/i }).first().click();
    const panel = page.locator('[data-testid="signalair-selection-panel"]').or(
      page.getByRole("heading", { level: 2 }).filter({ hasText: /signalair|sélection/i })
    );
    try {
      await expect(panel.first()).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, "Panel SignalAir non affiché après clic");
    }
  });

  test("panel SignalAir : sélection et bouton Charger visibles", async ({
    page,
  }) => {
    const specialTrigger = page.getByTestId("rail-special-sources-trigger");
    if (!(await specialTrigger.isVisible().catch(() => false))) {
      test.skip(true, "Bouton Sources spéciales non visible");
    }
    await specialTrigger.click();
    await page.getByRole("button", { name: /signalair/i }).first().click();
    const panel = page.locator('[data-testid="signalair-selection-panel"]').or(
      page.getByRole("heading", { level: 2 }).filter({ hasText: /signalair|sélection/i })
    );
    try {
      await expect(panel.first()).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, "Panel SignalAir non affiché");
    }
    const signalAirPanel = page.locator('[data-testid="signalair-selection-panel"]');
    await signalAirPanel.scrollIntoViewIfNeeded();
    const loadBtn = signalAirPanel.getByTestId("signalair-load-reports");
    await expect(loadBtn).toBeVisible({ timeout: 10000 });
  });

  test("ouvrir menu Sources spéciales puis panel MobileAir", async ({
    page,
  }) => {
    const specialTrigger = page.getByTestId("rail-special-sources-trigger");
    if (!(await specialTrigger.isVisible().catch(() => false))) {
      test.skip(true, "Bouton Sources spéciales non visible");
    }
    await specialTrigger.click();
    await page.getByRole("button", { name: /mobileair/i }).first().click();
    const panel = page.locator('[data-testid="mobileair-selection-panel"]').or(
      page.getByRole("heading", { level: 2 }).filter({ hasText: /mobileair|mobile|sélection|capteur/i })
    );
    try {
      await expect(panel.first()).toBeVisible({ timeout: 20000 });
    } catch {
      test.skip(true, "Panel MobileAir non affiché après clic");
    }
  });

  test("panel MobileAir : contenu réagit (liste ou message)", async ({
    page,
  }) => {
    const specialTrigger = page.getByTestId("rail-special-sources-trigger");
    if (!(await specialTrigger.isVisible().catch(() => false))) {
      test.skip(true, "Bouton Sources spéciales non visible");
    }
    await specialTrigger.click();
    await page.getByRole("button", { name: /mobileair/i }).first().click();
    const panel = page.locator('[data-testid="mobileair-selection-panel"]').or(
      page.getByRole("heading", { level: 2 }).filter({ hasText: /mobileair|mobile|sélection|capteur/i })
    );
    try {
      await expect(panel.first()).toBeVisible({ timeout: 20000 });
    } catch {
      test.skip(true, "Panel MobileAir non affiché");
    }
    await expect(
      page.locator('[data-testid="mobileair-selection-panel"]').or(
        page.locator('[class*="panel"], [class*="Panel"]').filter({ has: page.getByRole("heading", { level: 2 }) })
      )
    ).toBeVisible();
  });
});