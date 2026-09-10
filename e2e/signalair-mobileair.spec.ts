import { test, expect, type Locator, type Page } from "@playwright/test";
import { seedToursCompleted } from "./tourSetup";

/**
 * Dépliants SignalAir et MobileAir dans le menu Sources du rail.
 *
 * Ils ont remplacé deux panneaux latéraux ouverts depuis un menu « Sources
 * spéciales », lui-même supprimé. Trois enseignements de l'ancienne version de
 * ce fichier restent valables et expliquent sa forme :
 *
 * 1. **Le nom accessible doit être ancré.** `/^SignalAir/` exclut « Masquer
 *    SignalAir », le bouton de visibilité qui apparaît dans le corps du
 *    dépliant dès que des données sont chargées. Le scoping au flyout est la
 *    seconde ceinture, pas le correctif.
 *
 * 2. **Aucun `test.skip` sur l'échafaudage.** Les neuf `try/catch → test.skip`
 *    d'une version antérieure rapportaient quatre tests « ignorés » — donc
 *    verts — pendant que le flux était cassé. Seule la disponibilité réelle des
 *    données justifierait un contournement, et il serait alors circonscrit à
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

/** Ouvre le menu Sources et renvoie son contenu — le seul périmètre valide. */
const openSourcesMenu = async (page: Page): Promise<Locator> => {
  const trigger = page.getByTestId("rail-sources-trigger");
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();

  const flyout = page.getByTestId("sources-flyout");
  await expect(flyout).toBeVisible({ timeout: 5000 });
  return flyout;
};

/** Déplie un des deux sous-groupes et renvoie son en-tête, pour le replier ensuite. */
const expandDisclosure = async (
  page: Page,
  source: RegExp
): Promise<{ flyout: Locator; header: Locator }> => {
  const flyout = await openSourcesMenu(page);
  const header = flyout.getByRole("button", { name: source });
  await expect(header).toBeVisible({ timeout: 10000 });
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  return { flyout, header };
};

test.describe("Dépliants SignalAir et MobileAir du menu Sources", () => {
  // Locale figée : i18next suit `navigator.language`, et Chromium démarre en
  // en-US. Sans cela les assertions textuelles portent sur des libellés
  // anglais alors que le reste du dépôt raisonne en français.
  test.use({ viewport: { width: 1280, height: 720 }, locale: "fr-FR" });

  test.beforeEach(async ({ page }) => {
    await load(page);
  });

  test("ouvrir le menu Sources puis déplier SignalAir", async ({ page }) => {
    await expandDisclosure(page, /^SignalAir/);

    await expect(page.getByTestId("sources-signalair-body")).toBeVisible({
      timeout: 15000,
    });
  });

  test("SignalAir : sélection par défaut et bouton Charger actionnable", async ({
    page,
  }) => {
    await expandDisclosure(page, /^SignalAir/);

    const body = page.getByTestId("sources-signalair-body");
    await expect(body).toBeVisible({ timeout: 15000 });

    // Les quatre types sont cochés par défaut (SIGNAL_AIR_DEFAULT_TYPES), le
    // bouton doit donc être actionnable et pas seulement présent : c'est la
    // longueur de la sélection qui décide, et un défaut vide passerait
    // inaperçu sous un simple `toBeVisible`.
    for (const type of ["odeur", "bruit", "brulage", "visuel"]) {
      await expect(
        page.getByTestId(`sources-signalair-type-${type}`)
      ).toHaveAttribute("aria-checked", "true");
    }

    const loadBtn = page.getByTestId("sources-signalair-load");
    await expect(loadBtn).toBeVisible();
    await expect(loadBtn).toBeEnabled();
  });

  test("SignalAir : replier le dépliant ne touche pas à la sélection", async ({
    page,
  }) => {
    const { header } = await expandDisclosure(page, /^SignalAir/);

    const odeur = page.getByTestId("sources-signalair-type-odeur");
    await odeur.click();
    await expect(odeur).toHaveAttribute("aria-checked", "false");

    // Le repli n'est qu'un geste d'affichage. C'est précisément ce que
    // l'ancien `onSignalAirClick` confondait avec une désactivation, jetant la
    // sélection à chaque fermeture accidentelle.
    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("sources-signalair-body")).toBeHidden();

    await header.click();
    await expect(
      page.getByTestId("sources-signalair-type-odeur")
    ).toHaveAttribute("aria-checked", "false");
  });

  test("ouvrir le menu Sources puis déplier MobileAir", async ({ page }) => {
    await expandDisclosure(page, /^MobileAir/);

    await expect(page.getByTestId("sources-mobileair-body")).toBeVisible({
      timeout: 20000,
    });
  });

  test("MobileAir : les trois sections sont rendues", async ({ page }) => {
    await expandDisclosure(page, /^MobileAir/);

    const body = page.getByTestId("sources-mobileair-body");
    await expect(body).toBeVisible({ timeout: 20000 });

    // Ces trois repères sont rendus quel que soit l'état du catalogue
    // (chargement, erreur réseau, liste vide) : ils décrivent la structure du
    // dépliant, pas les données. Rien qui dépende des capteurs reçus, donc :
    // l'en-tête « Capteurs disponibles » n'est qu'un `aria-label` sur la liste,
    // et il disparaît du DOM pendant le chargement.
    await expect(body.getByText(/un seul capteur MobileAir/i)).toBeVisible();
    // `historical.periodLabel`, en-tête du sélecteur de période partagé avec le
    // mode historique.
    await expect(body.getByText(/^Historique$/).first()).toBeVisible();

    // Le champ de recherche n'apparaît qu'une fois le catalogue non vide.
    const search = page.getByTestId("sources-mobileair-search");
    await expect(search).toBeVisible({ timeout: 20000 });
    await search.fill("zzz-inexistant");
    await expect(
      page.getByTestId("sources-mobileair-search-empty")
    ).toBeVisible();
    await search.fill("");

    // Désactivé tant qu'aucun capteur n'est choisi : sa présence seule ne
    // dirait rien, son état dit que le dépliant attend une sélection.
    const loadBtn = page.getByTestId("sources-mobileair-load");
    await expect(loadBtn).toBeVisible();
    await expect(loadBtn).toBeDisabled();
  });
});
