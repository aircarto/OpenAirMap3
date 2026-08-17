import { test, expect, type Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

const isMaintenancePageVisible = async (page: Page): Promise<boolean> =>
  page
    .getByRole("heading", { name: /maintenance|intervention planifiée/i })
    .isVisible()
    .catch(() => false);

test.describe("Smoke et navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
  });

  test("chargement : titre h1 et région carte visibles", async ({ page }) => {
    await page.goto("/");
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    // Cible explicitement la colonne carte : le regex précédent matchait aussi
    // le canvas maplibre (`aria-label="Map"`), d'où une violation de mode strict.
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#main-content")).toHaveAttribute(
      "role",
      "region"
    );
  });

  test("chargement avec params URL : carte centrée sur lat/lng/zoom", async ({
    page,
  }) => {
    // L'instance Leaflet n'est pas atteignable depuis `.leaflet-container` (elle
    // n'y figure pas comme propriété énumérable), l'ancien helper renvoyait donc
    // toujours null. On observe à la place les tuiles réellement demandées, ce
    // qui prouve le niveau de zoom ET la zone géographique.
    const tileZooms = new Set<string>();
    await page.route(/\/(\d{1,2})\/(\d+)\/(\d+)(@\d+x)?\.(png|jpg|webp|pbf)/, (route) => {
      const m = route.request().url().match(/\/(\d{1,2})\/(\d+)\/(\d+)/);
      if (m) tileZooms.add(m[1]);
      return route.continue();
    });

    await page.goto("/?lat=43.71&lng=7.26&zoom=14");
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    await page.waitForSelector(".leaflet-container", { timeout: 10000 });
    await page.waitForTimeout(4000);

    // Les paramètres sont conservés dans l'URL par useAppUrlSync
    expect(page.url()).toContain("zoom=14");

    // Et l'échelle affichée correspond au niveau demandé, pas au zoom par défaut
    const scale = page.locator(".leaflet-control-scale-line").first();
    await expect(scale).toBeVisible({ timeout: 10000 });
    await expect(scale).toHaveText(/\b(100|200|300|500)\s*m\b/);
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

  test("rail replié en barre (viewport mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    test.skip(
      await isMaintenancePageVisible(page),
      "La page maintenance remplace l'application principale."
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });

    // Sous `md`, le MÊME composant se replie en barre horizontale en bas : plus
    // de menu burger, donc plus de seconde surface de contrôle à maintenir.
    const rail = page.getByTestId("map-control-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("toolbar")).toHaveAttribute(
      "aria-orientation",
      "horizontal"
    );
    await expect(page.getByTestId("rail-pollutant-trigger")).toBeVisible();

    const box = await rail.boundingBox();
    // ancré en bas, et non sur toute la hauteur
    expect(box!.y).toBeGreaterThan(667 / 2);
  });

  test("rail vertical (viewport large) : contrôles visibles", async ({
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

    const rail = page.getByTestId("map-control-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("toolbar")).toHaveAttribute(
      "aria-orientation",
      "vertical"
    );
    for (const id of [
      "rail-pollutant-trigger",
      "rail-sources-trigger",
      "rail-timestep-trigger",
      "rail-info-button",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test("texte « À propos » conservé dans le DOM pour l'indexation", async ({
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
    // Masqué visuellement par sr-only, mais présent et non `display: none`
    const seo = page.locator('[data-testid="about-seo-text"]');
    await expect(seo).toHaveCount(1);
    const text = await seo.textContent();
    expect(text!.length).toBeGreaterThan(50);
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
    // Cherché dans la boîte de dialogue : au niveau page, le regex attrapait un
    // bouton situé sous l'overlay, dont le clic était intercepté.
    const closeButton = dialog
      .getByRole("button", { name: /fermer|close|window|fenêtre/i })
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
