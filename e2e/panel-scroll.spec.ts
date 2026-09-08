import { test, expect, type Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Un panneau latéral défile DANS sa propre zone ; il ne rend jamais la page
 * entière défilante.
 *
 * La régression que ce test attrape : `flex-1` laisse le `min-height: auto` par
 * défaut des éléments flex, donc <main> peut dépasser sa part de la colonne
 * `h-screen` et la zone de contenu refuse de se réduire sous la hauteur de son
 * contenu. Un panneau plus haut que le viewport faisait alors défiler toute la
 * SPA. Corrigé par `min-h-0` sur <main>, sur la coquille et sur sa zone
 * défilante — un `h-[calc(100vh-…)]` en dur ne ferait que le masquer.
 */

const PANELS = [
  "station-side-panel",
  "micro-side-panel",
  "nebuleair-side-panel",
  "sensorcommunity-side-panel",
  "purpleair-side-panel",
]
  .map((id) => `[data-testid="${id}"]`)
  .join(", ");

const geometry = (page: Page) =>
  page.evaluate((sel) => {
    const panel = document.querySelector(sel) as HTMLElement | null;
    const body = panel?.querySelector(".overflow-y-auto") as HTMLElement | null;
    const main = document.querySelector("main") as HTMLElement | null;
    const doc = document.documentElement;
    return {
      pageScrollable: doc.scrollHeight > doc.clientHeight + 1,
      mainH: Math.round(main?.getBoundingClientRect().height ?? 0),
      viewportH: doc.clientHeight,
      bodyAreaH: Math.round(body?.getBoundingClientRect().height ?? 0),
      bodyAreaScrollH: body?.scrollHeight ?? 0,
    };
  }, PANELS);

for (const { name, width, height } of [
  { name: "bureau", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 780 },
]) {
  test(`panneau ouvert (${name}) : la page ne défile pas`, async ({ page }) => {
    await seedToursCompleted(page);
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });

    const marker = page.locator(".custom-marker-container").first();
    try {
      await expect(marker).toBeVisible({ timeout: 25000 });
    } catch {
      test.skip(true, "Aucun marqueur affiché (API vide ou lente)");
    }

    const panel = page.locator(PANELS).first();

    // Clic et ouverture réessayés ensemble : un poll de données re-rend les
    // marqueurs, et le nôtre peut se détacher du DOM entre l'assertion de
    // visibilité et le clic — « element was detached from the DOM, retrying »,
    // puis échec sur le remplaçant pas encore visible. `force` n'y change rien,
    // il ne lève que les vérifications d'actionnabilité. Réessayer l'ensemble
    // jusqu'à ce que le panneau soit là est le seul point stable.
    await expect(async () => {
      await page.locator(".custom-marker-container").first().click({
        force: true,
      });
      await expect(panel).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 40000 });

    await page.waitForTimeout(2500);

    const g = await geometry(page);
    expect(g.pageScrollable, "la page entière est devenue défilante").toBe(false);
    expect(g.mainH, "<main> dépasse le viewport").toBeLessThanOrEqual(
      g.viewportH
    );

    // La molette sur le panneau ne doit pas emporter la page.
    const box = (await panel.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(() => window.scrollY),
      "la molette sur le panneau a fait défiler la SPA"
    ).toBe(0);

    // Et quand le contenu dépasse, c'est la zone du panneau qui l'absorbe.
    // Vérifié par programme et non à la molette : le centre du panneau tombe
    // souvent sur le graphique amCharts, qui consomme l'événement.
    if (g.bodyAreaScrollH > g.bodyAreaH + 1) {
      const scrolled = await page.evaluate((sel) => {
        const body = document
          .querySelector(sel)
          ?.querySelector(".overflow-y-auto") as HTMLElement | null;
        if (!body) return null;
        body.scrollTop = 200;
        return body.scrollTop;
      }, PANELS);
      expect(scrolled, "la zone de contenu du panneau ne défile pas").toBeGreaterThan(0);
    }
  });
}
