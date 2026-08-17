import { test, expect } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Non-régression sur une classe de bug rencontrée deux fois pendant la refonte :
 * un panneau en `position: fixed` ou `absolute` rendu à l'intérieur d'un ancêtre
 * qui rogne (`overflow`) ou qui isole (`z-index`, `isolation`, `transform`).
 *
 * Le symptôme est trompeur : l'élément existe, ses dimensions sont correctes et
 * `toBeVisible()` passe — mais il est découpé, et les clics traversent vers la
 * carte. Les deux cas rencontrés étaient le panneau du fond de carte dans la zone
 * défilante du rail, et le panneau statistique dans la colonne bas-droite.
 *
 * On teste donc le survol RÉEL (`elementFromPoint`) et l'absence d'ancêtre
 * problématique, ce que les assertions de visibilité ne savent pas voir.
 */

const assertEscapesClippingAncestors = async (
  locator: import("@playwright/test").Locator
) => {
  const report = await locator.evaluate((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const offenders: string[] = [];
    const isolators: string[] = [];
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const s = getComputedStyle(parent);
      const clips = s.overflowX !== "visible" || s.overflowY !== "visible";
      const isolates =
        s.zIndex !== "auto" ||
        s.isolation === "isolate" ||
        s.transform !== "none" ||
        s.contain.includes("paint");
      // Seul le ROGNAGE est une faute en soi. L'isolation est simplement
      // rapportée : le wrapper d'un popover portalisé porte légitimement un
      // `transform`, et le vrai détecteur du plafonnement de z-index est le test
      // de survol ci-dessous.
      if (clips) {
        offenders.push(
          `${parent.tagName}.${(parent.className || "").toString().split(" ")[0]}`
        );
      }
      if (isolates) {
        isolators.push(
          `${parent.tagName}.${(parent.className || "").toString().split(" ")[0]}`
        );
      }
      parent = parent.parentElement;
    }
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + 40
    );
    return {
      offenders,
      isolators,
      hittable: hit ? el.contains(hit) : false,
      hitTag: hit ? hit.tagName + "." + (hit.className || "").toString().slice(0, 30) : "aucun",
    };
  });

  expect(
    report.offenders,
    `Ancêtres qui rognent le panneau : ${report.offenders.join(" | ")}`
  ).toEqual([]);
  expect(
    report.hittable,
    `Le point central touche ${report.hitTag} au lieu du panneau. ` +
      `Ancêtres isolants : ${report.isolators.join(" | ") || "aucun"}`
  ).toBe(true);
};

test.describe("Surfaces flottantes de la carte", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("panneau statistique : échappe à la colonne bas-droite", async ({
    page,
  }) => {
    const counters = page
      .getByText(/devices visible|appareils visible/i)
      .first();
    if (!(await counters.count())) {
      test.skip(true, "Encart de statistiques non affiché");
    }
    await counters.click({ force: true });

    const sheet = page.locator(".z-panel-sheet").first();
    await expect(sheet).toBeVisible({ timeout: 10000 });
    await expect(sheet.getByRole("heading").first()).toBeVisible();
    await assertEscapesClippingAncestors(sheet);
  });

  test("panneau du fond de carte : échappe à la zone défilante du rail", async ({
    page,
  }) => {
    await page.getByTestId("rail-basemap-trigger").click();
    const panel = page
      .locator("[data-radix-popper-content-wrapper] > *")
      .first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await assertEscapesClippingAncestors(panel);
  });

  test("bande instrument : dans l'angle et jamais sous le rail", async ({
    page,
  }) => {
    // Le rail n'occupe que le HAUT du bord gauche : la bande doit être dans
    // l'angle, sans décalage horizontal inutile. C'est le rail qui réserve la
    // place en bas via sa hauteur maximale.
    for (const height of [900, 620]) {
      await page.setViewportSize({ width: 1280, height });
      await page.waitForTimeout(800);

      const geo = await page.evaluate(() => {
        const box = (sel: string) =>
          document.querySelector(sel)?.getBoundingClientRect() ?? null;
        return {
          rail: box('[data-testid="map-control-rail"]'),
          compass: box('[data-testid="north-arrow"]'),
          scale: box(".leaflet-control-scale"),
        };
      });

      expect(geo.compass, "rose des vents absente").not.toBeNull();
      // dans l'angle : même bord gauche que le rail
      expect(Math.round(geo.compass!.left)).toBe(Math.round(geo.rail!.left));
      // le rail ne descend jamais jusqu'à la bande
      expect(
        geo.rail!.bottom,
        `À ${height}px de haut, le rail atteint la bande instrument`
      ).toBeLessThan(geo.compass!.top);
      // échelle après la rose des vents, sans chevauchement
      expect(geo.scale!.left).toBeGreaterThanOrEqual(geo.compass!.right);
    }
  });

  test("notices de carte : empilées sans chevauchement", async ({ page }) => {
    // Ralentit les requêtes de couches feux pour observer deux chargements
    // simultanés — le cas où les anciennes notices se superposaient sur top-32.
    await page.route(/effis|EFFIS|wms/i, async (route) => {
      await new Promise((r) => setTimeout(r, 9000));
      return route.continue();
    });

    await page.getByTestId("rail-basemap-trigger").click();
    const panel = page.locator("[data-radix-popper-content-wrapper]");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Les couches feux vivent dans le sous-menu « Incendie », replié par défaut.
    const fireGroup = panel.locator("button[aria-expanded]").nth(1);
    await fireGroup.click();
    await expect(fireGroup).toHaveAttribute("aria-expanded", "true");

    for (const name of [/hotspots|chaleur/i, /burned|brûl/i]) {
      const toggle = panel.getByRole("button", { name }).first();
      if (await toggle.count()) await toggle.click();
    }
    await page.keyboard.press("Escape");

    const stack = page.getByTestId("map-notifications");
    await expect(stack).toBeVisible({ timeout: 10000 });
    await expect(stack).toHaveAttribute("aria-live", "polite");

    const overlaps = await stack.evaluate((el) => {
      const rects = [...el.children]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.height > 0);
      return rects.some(
        (r, i) => i < rects.length - 1 && r.bottom > rects[i + 1].top + 1
      );
    });
    expect(overlaps).toBe(false);
  });
});
