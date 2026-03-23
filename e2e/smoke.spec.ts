import { test, expect } from "@playwright/test";

test.describe("Smoke et navigation", () => {
  test("chargement : titre h1 et région carte visibles", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("region", { name: /carte|air|quality|map/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("lien d'évitement : visible et cible le contenu principal", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    const skipLink = page.getByTestId("skip-link");
    await expect(skipLink).toBeVisible();
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("menu burger (viewport mobile) : ouverture et présence des sections", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    const menuButton = page.getByRole("button", { name: /menu/i }).first();
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(
      page.getByText(/polluant|sources|pas de temps|time step/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("barre desktop (viewport large) : contrôles visibles", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    const header = page.locator("header");
    await expect(header.getByRole("button").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(/pm|scan|heure|hour|jour|day|atmo|source/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("modale information : ouverture et fermeture", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    const infoButton = page
      .getByRole("button", { name: /about|informations|openairmap/i })
      .first();
    await infoButton.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const closeButton = page
      .getByRole("button", { name: /fermer|close|information|window|fenêtre/i })
      .first();
    await closeButton.click();
    await expect(dialog).not.toBeVisible();
  });
});
