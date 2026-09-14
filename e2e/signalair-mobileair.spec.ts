import { test, expect, type Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Périmètre sources actuel : stations AtmoSud + microcapteurs qualifiés.
 * SignalAir / MobileAir / capteurs communautaires ne sont plus exposés.
 */

const load = async (page: Page) => {
  await seedToursCompleted(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 15000,
  });
};

test.describe("Menu Sources — périmètre AtmoSud uniquement", () => {
  test.use({ viewport: { width: 1280, height: 720 }, locale: "fr-FR" });

  test.beforeEach(async ({ page }) => {
    await load(page);
  });

  test("n'expose ni SignalAir ni MobileAir ni groupe communautaire", async ({
    page,
  }) => {
    const trigger = page.getByTestId("rail-sources-trigger");
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.click();

    const flyout = page.getByTestId("sources-flyout");
    await expect(flyout).toBeVisible({ timeout: 5000 });

    await expect(flyout.getByTestId("source-atmoRef")).toBeVisible();
    await expect(flyout.getByTestId("source-atmoMicro")).toBeVisible();

    await expect(flyout.getByRole("button", { name: /^SignalAir/ })).toHaveCount(
      0
    );
    await expect(flyout.getByRole("button", { name: /^MobileAir/ })).toHaveCount(
      0
    );
    await expect(
      flyout.getByTestId("sources-group-communautaire-all")
    ).toHaveCount(0);
    await expect(flyout.getByTestId("sources-signalair-body")).toHaveCount(0);
    await expect(flyout.getByTestId("sources-mobileair-body")).toHaveCount(0);
  });
});
