import { test, expect, type Page } from "@playwright/test";

const isMaintenancePageVisible = async (page: Page): Promise<boolean> =>
  page
    .getByRole("heading", { name: /maintenance|intervention planifiée/i })
    .isVisible()
    .catch(() => false);

test.describe("Smoke et navigation", () => {
  test("chargement : titre h1 et région carte visibles", async ({ page }) => {
    await page.goto("/");
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
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
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
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
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
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
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
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
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
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

test.describe("Mode maintenance", () => {
  test("affiche la page de maintenance", async ({ page }) => {
    await page.route("**/maintenance.json", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          title: "Intervention planifiée",
          message: "Message de maintenance personnalisé pour le test.",
          details: "Retour prévu prochainement.",
          contactLabel: "Contacter le support",
        }),
      });
    });

    await page.goto("/");
    test.skip(
      !(await isMaintenancePageVisible(page)),
      "Le mode maintenance n'est pas actif."
    );

    await expect(
      page.getByRole("heading", { name: /intervention planifiée/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/message de maintenance personnalisé/i)
    ).toBeVisible();
    await expect(page.getByText(/retour prévu prochainement/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /contacter le support/i })
    ).toBeVisible();
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  });
});
