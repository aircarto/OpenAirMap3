import { test, expect, Page } from "@playwright/test";

/**
 * Non-régression : au changement de pas de temps (heure <-> 15 min) dans le side
 * panel d'une station de référence, la courbe doit rester affichée.
 *
 * Le bug d'origine était une course. Pendant le chargement, le graphique reçoit
 * d'abord les anciennes données re-échantillonnées sur la nouvelle grille
 * (points isolés entourés de null, donc aucune ligne avec connect: false), puis
 * les vraies données. La mise à jour différée des séries (setTimeout après leur
 * recréation) capturait ce jeu intermédiaire dans sa closure : si elle se
 * déclenchait après l'arrivée des vraies données, elle le réappliquait et la
 * courbe disparaissait jusqu'au prochain changement.
 *
 * Pour rendre cet ordre déterministe, le test rejoue les réponses API avec une
 * latence courte et rallonge le délai de la mise à jour différée.
 */

const O3_COLOR = { r: 0xf5, g: 0xd0, b: 0x45 };
const MIN_CURVE_PIXELS = 300;
const API_REPLAY_DELAY_MS = 25;
/** Délai (ms) utilisé par useAmChartsChart après recréation des séries. */
const SERIES_UPDATE_DELAY_MS = 50;

/** Compte les pixels de la couleur de la série O₃ (amCharts rend en canvas). */
async function countCurvePixels(page: Page): Promise<number> {
  return await page.evaluate(({ r, g, b }) => {
    const canvases = Array.from(
      document.querySelectorAll("canvas")
    ) as HTMLCanvasElement[];
    let total = 0;
    for (const canvas of canvases) {
      if (canvas.width < 200 || canvas.height < 100) continue;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      let image: ImageData;
      try {
        image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        continue;
      }
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - r) < 18 &&
          Math.abs(data[i + 1] - g) < 18 &&
          Math.abs(data[i + 2] - b) < 18 &&
          data[i + 3] > 200
        ) {
          total++;
        }
      }
    }
    return total;
  }, O3_COLOR);
}

test("side panel station : la courbe reste affichée au changement de pas de temps", async ({
  page,
}) => {
  test.setTimeout(180000);

  // Réponses API resservies avec une latence courte : la réponse arrive après le
  // rendu intermédiaire du graphique.
  await page.addInitScript((delayMs) => {
    const cache = new Map<string, string>();
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (!url.includes("/observations/stations/mesures?")) {
        return realFetch(input, init);
      }
      const key = url.replace(/date_debut=[^&]*&date_fin=[^&]*/, "dates");
      const cached = cache.get(key);
      if (cached !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return new Response(cached, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const response = await realFetch(input, init);
      cache.set(key, await response.clone().text());
      return response;
    };
  }, API_REPLAY_DELAY_MS);

  // Forcer la mise à jour différée des séries à tomber après l'arrivée des
  // données : c'est l'ordre qui faisait disparaître la courbe.
  await page.addInitScript((seriesDelay) => {
    const realSetTimeout = window.setTimeout;
    (window as any).setTimeout = (
      handler: any,
      delay?: number,
      ...args: any[]
    ) => realSetTimeout(handler, delay === seriesDelay ? 900 : delay, ...args);
  }, SERIES_UPDATE_DELAY_MS);

  // Ne pas laisser le tour guidé intercepter les clics
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.setItem(
      "openairmap-tours-completed",
      JSON.stringify({
        app_overview: { completedAt: now, skipped: true },
        historical_mode: { completedAt: now, skipped: true },
      })
    );
  });

  await page.goto("/?pollutant=o3&sources=atmoRef");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 20000,
  });

  const marker = page.locator(".custom-marker-container.atmoRef").first();
  try {
    await expect(marker).toBeVisible({ timeout: 30000 });
  } catch {
    test.skip(true, "Aucune station de référence affichée (API vide ou lente)");
  }
  await marker.click({ force: true });

  const panel = page.locator('[data-testid="station-side-panel"]');
  try {
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel.locator("canvas").first()).toBeVisible({
      timeout: 30000,
    });
  } catch {
    test.skip(true, "Graphique de la station non affiché (API vide ou lente)");
  }
  await page.waitForTimeout(2000);

  const timeStepButtons = panel.locator(
    'button[role="radio"]:has(span.time-step-button-full)'
  );
  await expect(timeStepButtons).toHaveCount(4, { timeout: 20000 });
  const quarterHour = timeStepButtons.nth(1);
  const hour = timeStepButtons.nth(2);

  if ((await countCurvePixels(page)) < MIN_CURVE_PIXELS) {
    test.skip(true, "Pas de données O₃ pour cette station");
  }

  for (let i = 0; i < 5; i++) {
    for (const [label, button] of [
      ["15 min", quarterHour],
      ["heure", hour],
    ] as const) {
      await button.click();
      await page.waitForTimeout(2000);
      const pixels = await countCurvePixels(page);
      expect(
        pixels,
        `courbe absente après passage au pas de temps ${label} (itération ${i})`
      ).toBeGreaterThanOrEqual(MIN_CURVE_PIXELS);
    }
  }
});
