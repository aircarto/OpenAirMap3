import { test, expect, type Locator, type Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Ouverture des panneaux de sélection SignalAir et MobileAir depuis le menu
 * « Sources spéciales » du rail.
 *
 * Trois défauts que ce fichier a laissé passer, et qui expliquent sa forme
 * actuelle :
 *
 * 1. **Le nom accessible doit être ancré.** L'aria-label du déclencheur du rail
 *    est « Sources spéciales (SignalAir, MobileAir) », donc l'ancien
 *    `page.getByRole("button", {name: /signalair/i}).first()` désignait ce
 *    déclencheur et non l'entrée du menu. Depuis que `dropdown-menu` est en
 *    `modal={false}` (863bc36), plus rien ne bloque ce clic : il refermait le
 *    menu et le panneau n'apparaissait jamais — auparavant le
 *    `pointer-events: none` du mode modal masquait l'erreur de sélecteur.
 *    `/^SignalAir/` exclut aussi « Masquer SignalAir », le bouton de visibilité
 *    qui apparaît dans le menu dès que des données sont chargées. Le scoping au
 *    contenu du menu est la seconde ceinture, pas le correctif.
 *
 * 2. **Aucun `test.skip` sur l'échafaudage.** Les neuf `try/catch → test.skip`
 *    précédents rapportaient quatre tests « ignorés » — donc verts — pendant
 *    que le flux était cassé. Seule la disponibilité réelle des données
 *    justifierait un contournement, et il serait alors circonscrit à
 *    l'assertion concernée.
 *
 * 3. **La locale conditionne tout locator textuel** (voir `test.use` ci-dessous).
 */

const load = async (page: Page) => {
  await seedToursCompleted(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 15000,
  });
};

/** Ouvre le menu et renvoie son contenu — le seul périmètre de recherche valide. */
const openSpecialSourcesMenu = async (page: Page): Promise<Locator> => {
  const trigger = page.getByTestId("rail-special-sources-trigger");
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible({ timeout: 5000 });
  return menu;
};

const openPanelFor = async (page: Page, source: RegExp): Promise<void> => {
  const menu = await openSpecialSourcesMenu(page);
  await menu.getByRole("button", { name: source }).click();
};

test.describe("Flux SignalAir et MobileAir", () => {
  // Locale figée : i18next suit `navigator.language`, et Chromium démarre en
  // en-US. Sans cela les assertions textuelles portent sur des libellés
  // anglais alors que le reste du dépôt raisonne en français.
  test.use({ viewport: { width: 1280, height: 720 }, locale: "fr-FR" });

  test.beforeEach(async ({ page }) => {
    await load(page);
  });

  test("ouvrir menu Sources spéciales puis panel SignalAir", async ({
    page,
  }) => {
    await openPanelFor(page, /^SignalAir/);

    await expect(page.getByTestId("signalair-selection-panel")).toBeVisible({
      timeout: 15000,
    });
  });

  test("panel SignalAir : sélection et bouton Charger activés", async ({
    page,
  }) => {
    await openPanelFor(page, /^SignalAir/);

    const panel = page.getByTestId("signalair-selection-panel");
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Les quatre types sont cochés par défaut (SIGNAL_AIR_DEFAULT_TYPES), le
    // bouton doit donc être actionnable et pas seulement présent : c'est
    // `isLoadDisabled` qui décide, et un défaut vide passerait inaperçu sous un
    // simple `toBeVisible`.
    const loadBtn = panel.getByTestId("signalair-load-reports");
    await expect(loadBtn).toBeVisible({ timeout: 10000 });
    await expect(loadBtn).toBeEnabled();
  });

  test("ouvrir menu Sources spéciales puis panel MobileAir", async ({
    page,
  }) => {
    await openPanelFor(page, /^MobileAir/);

    await expect(page.getByTestId("mobileair-selection-panel")).toBeVisible({
      timeout: 20000,
    });
  });

  test("panel MobileAir : les trois sections sont rendues", async ({
    page,
  }) => {
    await openPanelFor(page, /^MobileAir/);

    const panel = page.getByTestId("mobileair-selection-panel");
    await expect(panel).toBeVisible({ timeout: 20000 });

    // Ces trois en-têtes sont rendus quel que soit l'état du catalogue
    // (chargement, erreur réseau, liste vide) : ils décrivent la structure du
    // panneau, pas les données.
    await expect(
      panel.getByRole("heading", { name: /capteurs disponibles/i }),
    ).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: /période d'analyse/i }),
    ).toBeVisible();
    // Le libellé de l'appel à l'action bascule selon qu'un capteur est
    // présélectionné ou non : les deux formes sont acceptées, seule sa présence
    // est en jeu ici.
    await expect(
      panel.getByRole("button", {
        name: /^(charger le parcours|sélectionnez un capteur)/i,
      }),
    ).toBeVisible();
  });
});
