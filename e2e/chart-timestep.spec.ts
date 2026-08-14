import { test, expect, Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

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
      const extraDelay = (window as any).__replayDelayMs as number | undefined;
      const cached = cache.get(key);
      if (cached !== undefined) {
        await new Promise((resolve) =>
          setTimeout(resolve, extraDelay ?? delayMs)
        );
        return new Response(cached, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const response = await realFetch(input, init);
      cache.set(key, await response.clone().text());
      if (extraDelay !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, extraDelay));
      }
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

  await seedToursCompleted(page);

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

  // Marquer les canvas actuels : ils doivent survivre aux changements de pas de
  // temps. Un voile de chargement est affiché par-dessus le graphique, qui reste
  // monté — l'instance amCharts n'est donc pas détruite/recréée.
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-testid="station-side-panel"] canvas')
      .forEach((canvas) => canvas.setAttribute("data-e2e-persist", "1"));
  });
  const persistedCanvas = panel.locator("canvas[data-e2e-persist='1']");
  const initialCanvasCount = await persistedCanvas.count();
  expect(initialCanvasCount).toBeGreaterThan(0);

  // Chargement volontairement lent : le voile doit être visible pendant ce
  // temps, et les contrôles désactivés.
  await page.evaluate(() => {
    (window as any).__replayDelayMs = 1500;
  });
  await quarterHour.click();
  const overlay = panel.getByRole("status");
  await expect(overlay).toBeVisible({ timeout: 3000 });
  await expect(hour).toBeDisabled();
  await expect(persistedCanvas).toHaveCount(initialCanvasCount);
  await expect(overlay).toBeHidden({ timeout: 15000 });
  await expect(hour).toBeEnabled();
  await page.evaluate(() => {
    (window as any).__replayDelayMs = undefined;
  });
  expect(
    await countCurvePixels(page),
    "courbe absente après le chargement lent"
  ).toBeGreaterThanOrEqual(MIN_CURVE_PIXELS);

  for (let i = 0; i < 5; i++) {
    for (const [label, button] of [
      ["heure", hour],
      ["15 min", quarterHour],
    ] as const) {
      await button.click();
      await page.waitForTimeout(2000);
      const pixels = await countCurvePixels(page);
      expect(
        pixels,
        `courbe absente après passage au pas de temps ${label} (itération ${i})`
      ).toBeGreaterThanOrEqual(MIN_CURVE_PIXELS);
      // Le graphique ne doit jamais être remonté à un changement de pas de temps
      expect(
        await persistedCanvas.count(),
        `graphique remonté au pas de temps ${label} (itération ${i})`
      ).toBe(initialCanvasCount);
    }
  }
});

test("side panel microcapteur : voile de chargement sans remontage du graphique", async ({
  page,
}) => {
  test.setTimeout(180000);

  await seedToursCompleted(page);

  // Ralentir uniquement les mesures historiques du capteur, pour que le voile de
  // chargement soit observable sans ralentir tout le chargement de la carte.
  await page.route("**/observations/capteurs/mesures?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

  await page.goto("/?pollutant=pm25&sources=atmoMicro");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 20000,
  });

  const markers = page.locator(".custom-marker-container.atmoMicro");
  try {
    await expect(markers.first()).toBeVisible({ timeout: 30000 });
  } catch {
    test.skip(true, "Aucun microcapteur affiché (API vide ou lente)");
  }

  // Tous les capteurs n'ont pas de mesures sur les dernières 24 h : essayer
  // plusieurs marqueurs jusqu'à en trouver un avec un graphique.
  const panel = page.locator('[data-testid="micro-side-panel"]');
  const markerCount = Math.min(await markers.count(), 6);
  let chartFound = false;
  for (let i = 0; i < markerCount && !chartFound; i++) {
    await markers.nth(i).click({ force: true });
    try {
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(panel.locator("canvas").first()).toBeVisible({
        timeout: 12000,
      });
      chartFound = true;
    } catch {
      // Capteur sans mesure sur la période : essayer le suivant
    }
  }
  if (!chartFound) {
    test.skip(true, "Aucun microcapteur avec des mesures sur la période");
  }

  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document
      .querySelectorAll('[data-testid="micro-side-panel"] canvas')
      .forEach((canvas) => canvas.setAttribute("data-e2e-persist", "1"));
  });
  const persistedCanvas = panel.locator("canvas[data-e2e-persist='1']");
  const initialCanvasCount = await persistedCanvas.count();
  expect(initialCanvasCount).toBeGreaterThan(0);

  const timeStepButtons = panel.locator(
    'button[role="radio"]:has(span.time-step-button-full)'
  );
  const quarterHour = timeStepButtons.nth(1);
  if (await quarterHour.isDisabled()) {
    test.skip(true, "Pas de temps 15 min non supporté par ce capteur");
  }

  await quarterHour.click();
  const overlay = panel.getByRole("status");
  await expect(overlay).toBeVisible({ timeout: 5000 });
  await expect(persistedCanvas).toHaveCount(initialCanvasCount);
  await expect(overlay).toBeHidden({ timeout: 30000 });

  // Si le capteur n'a pas de mesures au pas de temps 15 min, le graphique est
  // légitimement retiré (message « Aucune donnée disponible ») : rien à vérifier.
  const hasNoData = await panel
    .getByText(/Aucune donnée disponible/i)
    .isVisible()
    .catch(() => false);
  if (hasNoData) {
    test.skip(true, "Pas de mesures 15 min pour ce capteur");
  }

  expect(
    await persistedCanvas.count(),
    "graphique remonté au changement de pas de temps"
  ).toBe(initialCanvasCount);
});
