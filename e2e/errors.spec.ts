import { test, expect } from "@playwright/test";

test.describe("Gestion des erreurs (optionnel)", () => {
  test("simulation 500 sur une API : bannière ou message d’erreur affiché", async ({
    page,
  }) => {
    test.skip(
      true,
      "Optionnel : l'app peut ne pas afficher d'erreur globale si une seule API échoue (plusieurs sources)."
    );
    await page.route("**/api.atmosud.org/**", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15000,
    });
    const errorBanner = page
      .getByRole("alert")
      .or(page.getByText(/erreur|error/i).first());
    await expect(errorBanner).toBeVisible({ timeout: 15000 });
  });
});
