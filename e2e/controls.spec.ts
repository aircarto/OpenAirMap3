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
    ["sources spéciales", "rail-special-sources-trigger"],
  ] as const;

  for (const [label, testId] of menuTriggers) {
    test(`menu ${label} : ouverture et fermeture`, async ({ page }) => {
      const trigger = page.getByTestId(testId);
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

  test("fond de carte : panneau ouvert, cliquable et fonctionnel", async ({
    page,
  }) => {
    const trigger = page.getByTestId("rail-basemap-trigger");
    await trigger.click();

    const panel = page.locator("[data-radix-popper-content-wrapper]");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // `toBeVisible` ne détecte PAS le rognage par l'overflow d'un ancêtre : la
    // première version de ce test passait alors que le panneau, rendu à
    // l'intérieur de la zone défilante du rail, était entièrement invisible et
    // recevait ses clics sur la carte. On vérifie donc le test de survol réel.
    const hitsPanel = await panel.evaluate((el) => {
      const inner = el.firstElementChild as HTMLElement;
      const r = inner.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 30);
      return inner.contains(hit);
    });
    expect(hitsPanel).toBe(true);

    // Et surtout : choisir un fond change effectivement le fond de carte.
    const labelBefore = await trigger.getAttribute("aria-label");
    await page.getByRole("button", { name: /satellite/i }).first().click();
    await expect(trigger).not.toHaveAttribute("aria-label", labelBefore!);
    await expect(panel).toHaveCount(0);

    // Le chrome s'opacifie sur imagerie sombre, sans basculer de thème
    await expect(page.locator("#main-content")).toHaveAttribute(
      "data-basemap",
      "satellite"
    );
  });

  test("fond de carte : une bascule de calque garde le panneau ouvert", async ({
    page,
  }) => {
    await page.getByTestId("rail-basemap-trigger").click();
    const panel = page.locator("[data-radix-popper-content-wrapper]");
    await expect(panel).toBeVisible({ timeout: 5000 });

    const layerToggle = page
      .getByRole("button", { name: /communal|découpage|boundaries/i })
      .first();
    if (!(await layerToggle.count())) {
      test.skip(true, "Aucun calque optionnel disponible");
    }
    await layerToggle.click();
    // Un calque n'est pas un choix exclusif : le panneau doit rester ouvert pour
    // permettre d'en activer plusieurs.
    await expect(panel).toBeVisible();
  });

  test("fond de carte : sous-menus modélisation et incendie", async ({ page }) => {
    await page.getByTestId("rail-basemap-trigger").click();
    const panel = page.locator("[data-radix-popper-content-wrapper]");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // La modélisation n'est plus un item du rail : elle vit dans ce panneau.
    await expect(page.getByTestId("rail-modeling-trigger")).toHaveCount(0);

    const disclosures = panel.locator("button[aria-expanded]");
    await expect(disclosures).toHaveCount(2);

    // Replié par défaut, et chaque en-tête pilote une région identifiée
    for (let i = 0; i < 2; i++) {
      await expect(disclosures.nth(i)).toHaveAttribute("aria-expanded", "false");
      await expect(disclosures.nth(i)).toHaveAttribute("aria-controls", /.+/);
    }

    // Modélisation : déplier, choisir une couche, le panneau reste ouvert
    const modeling = disclosures.first();
    await modeling.click();
    await expect(modeling).toHaveAttribute("aria-expanded", "true");

    const options = page.locator('[data-testid="modeling-inline"] button');
    const count = await options.count();
    if (count === 0) {
      test.skip(true, "Modélisation indisponible pour ce pas de temps");
    }
    const wind = options.last();
    await wind.click();
    await expect(wind).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toBeVisible();

    // Recliquer l'option active la désélectionne
    await wind.click();
    await expect(wind).toHaveAttribute("aria-pressed", "false");

    // Incendie : déplier expose les couches EFFIS
    await disclosures.nth(1).click();
    await expect(disclosures.nth(1)).toHaveAttribute("aria-expanded", "true");
    await expect(
      panel.getByRole("button", { name: /hotspots|chaleur/i }).first()
    ).toBeVisible();
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
