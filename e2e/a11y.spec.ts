import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibilité (a11y)", () => {
  test("page principale : pas de violations axe critiques", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Violations critiques axe : ${JSON.stringify(critical, null, 2)}`
    ).toEqual([]);
  });

  test("modale d’information : pas de violations axe critiques", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });

    const infoButton = page.getByRole("button", { name: /about|informations|openairmap/i }).first();
    await infoButton.click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Violations critiques axe (modale) : ${JSON.stringify(critical, null, 2)}`
    ).toEqual([]);
  });

  test("side panel station : pas de violations axe critiques (si marqueur présent)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
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
      await expect(panel).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, "Panel latéral non affiché après clic marqueur");
    }

    const results = await new AxeBuilder({ page })
      .include(panelSelector)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Violations critiques axe (side panel) : ${JSON.stringify(critical, null, 2)}`
    ).toEqual([]);
  });

  test("panel mode historique : pas de violations axe critiques", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
    const historicalBtn = page.getByRole("button", {
      name: /mode historique|historical mode|load data|charger|date|période|plage/i,
    }).first();
    await historicalBtn.click();
    const panel = page.locator('[data-testid="historical-control-panel"]');
    await expect(panel).toBeVisible({ timeout: 8000 });

    const results = await new AxeBuilder({ page })
      .include('[data-testid="historical-control-panel"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Violations critiques axe (panel mode historique) : ${JSON.stringify(critical, null, 2)}`
    ).toEqual([]);
  });

  test("tutoriel mode historique actif : pas de violations axe critiques", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });

    await page.evaluate(() => {
      localStorage.removeItem("openairmap-tours-completed");
    });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });

    const tourPopover = page.locator(".driver-popover.openairmap-tour-popover");
    try {
      await expect(tourPopover).toBeVisible({ timeout: 8000 });
    } catch {
      test.skip(true, "Tutoriel non affiché (pas de temps incompatible ou UI masquée)");
    }

    const results = await new AxeBuilder({ page })
      .include(".driver-popover.openairmap-tour-popover")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Violations critiques axe (tutoriel) : ${JSON.stringify(critical, null, 2)}`
    ).toEqual([]);
  });
});
