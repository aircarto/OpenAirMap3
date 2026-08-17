import { test, expect } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Les contrôles vivent dans le rail flottant de la carte, plus dans un header.
 *
 * Les sélecteurs passent par des `data-testid` : la version précédente ciblait
 * `page.locator("header").getByRole("button").filter({ hasText: /pm|scan|heure|…/i })`,
 * ce qui couplait les tests à la fois à la structure du DOM et aux traductions
 * françaises — deux filtres se recouvraient même entre eux (« heure » et « jour »
 * matchaient le polluant comme le pas de temps).
 */
test.describe("Contrôles du rail de carte", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("map-control-rail")).toBeVisible();
  });

  const menuTriggers = [
    ["polluant", "rail-pollutant-trigger"],
    ["sources", "rail-sources-trigger"],
    ["pas de temps", "rail-timestep-trigger"],
    ["modélisation", "rail-modeling-trigger"],
    ["sources spéciales", "rail-special-sources-trigger"],
  ] as const;

  for (const [label, testId] of menuTriggers) {
    test(`menu ${label} : ouverture et fermeture`, async ({ page }) => {
      const trigger = page.getByTestId(testId);
      // La modélisation est désactivée pour certains pas de temps : dans ce cas
      // le contrôle reste visible et annonce sa raison, mais n'ouvre pas de menu.
      if (await trigger.isDisabled()) {
        test.skip(true, `Contrôle ${label} indisponible pour cet état`);
      }
      await trigger.click();
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }

  test("fond de carte : ouverture du panneau de couches", async ({ page }) => {
    await page.getByTestId("rail-basemap-trigger").click();
    // Panneau fait main (pas un menu Radix) : on vérifie qu'il s'ouvre bien à
    // droite du rail, et donc qu'il n'est pas rogné par celui-ci.
    const rail = await page.getByTestId("map-control-rail").boundingBox();
    const panel = page
      .locator(".z-popover")
      .filter({ hasText: /satellite|osm/i })
      .first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(rail!.x + rail!.width - 2);
    expect(box!.width).toBeGreaterThan(200);
  });

  test("mode historique : activation et panneau visible", async ({ page }) => {
    const toggle = page.getByTestId("rail-historical-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText(/load data|charger|date|période|period|plage/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("clavier : flèches, extrémités et ouverture", async ({ page }) => {
    const pollutant = page.getByTestId("rail-pollutant-trigger");
    await pollutant.focus();

    // ArrowDown navigue et n'ouvre PAS le menu : Radix ouvre nativement sur cette
    // touche, le rail l'intercepte en phase de capture.
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("rail-sources-trigger")).toBeFocused();
    await expect(page.getByRole("menu")).toHaveCount(0);

    await page.keyboard.press("Home");
    await expect(pollutant).toBeFocused();

    // Sur l'axe transverse, la flèche ouvre le menu
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(pollutant).toBeFocused();
  });

  test("un seul arrêt de tabulation pour tout le rail", async ({ page }) => {
    const stops = await page
      .locator("[data-rail-item]")
      .evaluateAll((els) =>
        els.filter((el) => (el as HTMLElement).tabIndex === 0).length
      );
    expect(stops).toBe(1);
  });
});
