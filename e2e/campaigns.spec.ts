import { test, expect, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seedToursCompleted } from "./tourSetup";

/**
 * Page « Campagnes » (extraction microspot réservée aux utilisateurs connectés).
 *
 * La session Keycloak est simulée : un utilisateur OIDC est déposé dans
 * sessionStorage (clé oidc-client-ts), et l'API microspot est interceptée.
 * Aucun appel réel à Keycloak ni à microspot.
 */

const KEYCLOAK_AUTHORITY = "https://auth.atmosud.org/realms/master";
const KEYCLOAK_CLIENT_ID = "openairmap";

const seedFakeSession = async (page: Page) => {
  await page.addInitScript(
    ({ key }) => {
      const now = Math.floor(Date.now() / 1000);
      sessionStorage.setItem(
        key,
        JSON.stringify({
          id_token: "fake-id-token",
          access_token: "fake-access-token",
          token_type: "Bearer",
          scope: "openid profile email",
          profile: { sub: "e2e", preferred_username: "e2e.user", iss: "x", aud: "y", exp: now + 3600, iat: now },
          expires_at: now + 3600,
        })
      );
    },
    { key: `oidc.user:${KEYCLOAK_AUTHORITY}:${KEYCLOAK_CLIENT_ID}` }
  );
};

const CAMPAIGNS = [
  {
    id: 71,
    name: "GPMM",
    start_date: "2026-08-01T00:00:00+00:00",
    end_date: "2026-08-21T00:00:00+00:00",
    study_id: 7,
    devices: [
      { id: "dev-a", start_date: "2026-08-01T00:00:00+00:00", end_date: null },
      { id: "dev-b", start_date: "2026-08-05T00:00:00+00:00", end_date: "2026-08-10T00:00:00+00:00" },
    ],
  },
  {
    id: 53,
    name: "Capt'Air Citoyen",
    start_date: null,
    end_date: null,
    study_id: 8,
    devices: [{ id: "dev-c", start_date: "2024-11-15T00:00:00+00:00", end_date: null }],
  },
];

const STUDIES = [
  { id: 7, name: "Port", campaign: 71, start_date: null, end_date: null },
  { id: 8, name: "Citoyens", campaign: 53, start_date: null, end_date: null },
];

const LOCATIONS = [
  {
    id: "L1",
    name: "Port Nord",
    typology: null,
    influence: null,
    lat: 43.33,
    lon: 5.35,
    alt: null,
    start_date: null,
    end_date: null,
    campaigns: [{ campaign_id: 71, campaign_name: "GPMM", start_date: null, end_date: null }],
    devices_history: [
      { device: "dev-a", device_name: "Capteur A", study: "Port", campaign: "GPMM", start_date: null, end_date: null },
      { device: "dev-b", device_name: "Capteur B", study: "Port", campaign: "GPMM", start_date: null, end_date: null },
    ],
  },
];

/** Historique des positions (/lists/devices?locations_history=true). */
const DEVICES = [
  {
    id: "dev-a",
    name: "Capteur A",
    locations_history: [
      { study: "Port", campaign: "GPMM", location: "Port Nord", lat: "43.33", lon: "5.35", start_date: "2026-08-01T00:00:00+00:00", end_date: null },
    ],
  },
  {
    // Déménage du site nommé vers une position déclarée (« auto created »)
    id: "dev-b",
    name: "Capteur B",
    locations_history: [
      { study: "Port", campaign: "GPMM", location: "Port Nord", lat: "43.33", lon: "5.35", start_date: "2026-08-05T00:00:00+00:00", end_date: "2026-08-07T00:00:00+00:00" },
      { study: "Port", campaign: "GPMM", location: "auto created for device 99", lat: "43.30", lon: "5.37", start_date: "2026-08-07T00:00:00+00:00", end_date: "2026-08-10T00:00:00+00:00" },
    ],
  },
];

const HOUR = 3_600_000;
const DEV_B_MOVE = Date.parse("2026-08-07T00:00:00Z");

/** Génère des lignes horaires pour la requête reçue (une par variable et par heure). */
const observationsFor = (url: URL) => {
  const deviceId = url.searchParams.get("device_id")!;
  const variables = url.searchParams.get("variable")!.split(",");
  const from = Date.parse(url.searchParams.get("from_date_time")!);
  const to = Date.parse(url.searchParams.get("date_time")!);
  const rows = [];
  for (let t = from; t < to; t += HOUR) {
    const moved = deviceId === "dev-b" && t >= DEV_B_MOVE;
    for (const v of variables) {
      rows.push({
        id: deviceId,
        name: deviceId,
        location_id: moved ? "dev-b_uuid" : "L1",
        location_name: moved ? "auto created for device 99" : "Port Nord",
        variable_iso_code: v,
        variable_name: v === "39" ? "PM 2.5" : "PM 10",
        time: new Date(t).toISOString().replace(".000Z", "+00:00"),
        lat: moved ? 43.3 : 43.33,
        lon: moved ? 5.37 : 5.35,
        value: 10,
        value_ref: 10 + ((t / HOUR) % 5),
        value_raw: 12,
        value_n1: 10,
        is_n1_applied: true,
        is_n2_applied: false,
        manually_validated: false,
        brand: "AQMesh",
        model: "AQMesh",
        unit: "µg/m3",
      });
    }
  }
  return rows;
};

const mockMicrospot = async (page: Page) => {
  const seenAuth: (string | null)[] = [];
  const observationUrls: URL[] = [];
  // Géocodage inverse BAN (Géoplateforme IGN)
  await page.route("**/geocodage/reverse**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [{ properties: { name: "Quai du Lazaret", postcode: "13002", city: "Marseille", distance: 15 } }],
      }),
    })
  );
  await page.route("**/microspot/**", async (route: Route) => {
    const url = new URL(route.request().url());
    seenAuth.push(await route.request().headerValue("authorization"));
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/lists/campaigns")) return json(CAMPAIGNS);
    if (url.pathname.endsWith("/lists/studies")) return json(STUDIES);
    if (url.pathname.endsWith("/lists/locations")) return json(LOCATIONS);
    if (url.pathname.endsWith("/lists/devices")) return json(DEVICES);
    if (url.pathname.endsWith("/lists/observations/status_code")) return json([]);
    if (url.pathname.endsWith("/observations")) {
      observationUrls.push(url);
      return json(observationsFor(url));
    }
    return route.fulfill({ status: 204 });
  });
  return { seenAuth, observationUrls };
};

test.describe("Page Campagnes", () => {
  test.beforeEach(async ({ page }) => {
    await seedToursCompleted(page);
  });

  test("sans session : écran de connexion et pas de lien dans le rail", async ({ page }) => {
    await page.goto("/en/campagnes");
    await expect(page.getByTestId("campaigns-login-required")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("campaigns-login")).toBeVisible();

    await page.goto("/en");
    await expect(page.getByTestId("rail-language-trigger")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("rail-campaigns-link")).toHaveCount(0);
  });

  test("avec session : choix étude → campagne, chargement horaire complet et export CSV", async ({ page }) => {
    await seedFakeSession(page);
    const { seenAuth } = await mockMicrospot(page);

    await page.goto("/en/campagnes");
    await expect(page.getByTestId("campaigns-list")).toBeVisible({ timeout: 30000 });

    // Filtre étude
    await page.getByTestId("campaigns-study-select").selectOption("7");
    await expect(page.getByRole("option", { name: /GPMM/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Capt'Air/ })).toHaveCount(0);

    await page.getByRole("option", { name: /GPMM/ }).click();
    // Période préremplie avec les dates de la campagne (fin incluse)
    await expect(page.getByTestId("campaigns-from")).toHaveValue("2026-08-01");
    await expect(page.getByTestId("campaigns-to")).toHaveValue(/2026-08-2[01]/);

    // Entrée par localisation : site nommé + position déclarée (adresse BAN)
    const sites = page.getByTestId("campaigns-site");
    await expect(sites).toHaveCount(2);
    await expect(sites.first()).toContainText("Port Nord");
    await expect(sites.nth(1)).toContainText("Capteur B · Quai du Lazaret, 13002 Marseille");

    await page.getByTestId("campaigns-load").click();
    const exportButton = page.getByTestId("campaigns-export");
    await expect(exportButton).toBeVisible({ timeout: 30000 });

    // Le Bearer accompagne tous les appels microspot
    expect(seenAuth.length).toBeGreaterThan(0);
    expect(seenAuth.every((h) => h === "Bearer fake-access-token")).toBe(true);

    const downloadPromise = page.waitForEvent("download");
    await exportButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^campagne_71_gpmm_2026-08-01_2026-08-2[01]_horaire\.csv$/);

    const content = (await readFile((await download.path())!, "utf-8")).replace(/^\uFEFF/, "");
    const lines = content.trimEnd().split("\n");
    expect(lines[0]).toMatch(/^time_utc,time_local,study_id,study_name,campaign_id,campaign_name,device_id/);
    // dev-b : du 5 au 10 août = 5 jours × 24 h × 2 polluants (PM2.5, PM10 cochés par défaut)
    const devB = lines.filter((l) => l.includes(",dev-b,"));
    expect(devB).toHaveLength(5 * 24 * 2);
    expect(lines[1]).toContain(",7,Port,71,GPMM,");
    // Colonnes de localisation : dev-b passe de Port Nord à sa position déclarée
    expect(lines[0]).toContain(",lat,lon,site_key,site_label,variable_iso_code,");
    expect(devB.filter((l) => l.includes(",named:portnord,Port Nord,"))).toHaveLength(2 * 24 * 2);
    expect(devB.filter((l) => l.includes(",declared:dev-b:0,"))).toHaveLength(3 * 24 * 2);
  });

  test("avec session : une localisation décochée n'est pas extraite", async ({ page }) => {
    await seedFakeSession(page);
    const { observationUrls } = await mockMicrospot(page);

    await page.goto("/en/campagnes");
    await expect(page.getByTestId("campaigns-list")).toBeVisible({ timeout: 30000 });
    await page.getByRole("option", { name: /GPMM/ }).click();

    const portNord = page.locator('[data-testid="campaigns-site"][data-site-key="named:portnord"]');
    await portNord.getByTestId("campaigns-site-checkbox").uncheck();
    await expect(page.getByText(/1 request planned/)).toBeVisible();

    await page.getByTestId("campaigns-load").click();
    await expect(page.getByTestId("campaigns-export")).toBeVisible({ timeout: 30000 });

    // Seule la présence de dev-b sur sa position déclarée est demandée
    expect(observationUrls.length).toBe(1);
    expect(observationUrls[0]!.searchParams.get("device_id")).toBe("dev-b");
    expect(observationUrls[0]!.searchParams.get("from_date_time")).toBe("2026-08-07T00:00:00Z");
    expect(observationUrls[0]!.searchParams.get("date_time")).toBe("2026-08-10T00:00:00Z");
  });
});
