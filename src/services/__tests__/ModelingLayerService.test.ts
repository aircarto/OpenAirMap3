import { describe, it, expect, vi } from "vitest";
import {
  getModelingLayerHour,
  formatHourLayerName,
  getIcairehLayerName,
  getPollutantLayerName,
  getModelingLegendUrl,
  getModelingLegendTitle,
  isModelingAvailable,
} from "../ModelingLayerService";

vi.mock("leaflet", () => ({
  default: {
    tileLayer: vi.fn(),
  },
}));

describe("ModelingLayerService utilitaires", () => {
  it("calcule correctement l'indice horaire pour les pas de temps supportés", () => {
    expect(getModelingLayerHour("heure")).toBe(23);
    expect(getModelingLayerHour("quartHeure")).toBeGreaterThanOrEqual(23);
    expect(getModelingLayerHour("deuxMin")).toBe(24);
    expect(getModelingLayerHour("instantane")).toBe(-1);
  });

  it("formate les noms de layer horaire et ICAIR'H", () => {
    expect(formatHourLayerName(4)).toBe("h04");
    expect(getIcairehLayerName("h24")).toBe("azur_heure:paca_icairh_h24");
  });

  it("génère les noms de layer par polluant ou lève en cas de polluant inconnu", () => {
    expect(getPollutantLayerName("pm25", "h24")).toBe(
      "azur_heure:paca_pm2_5_h24",
    );
    expect(() => getPollutantLayerName("h2s", "h24")).toThrow();
  });

  it("construit l'URL de légende WMS pour un layer valide", () => {
    const legendUrl = getModelingLegendUrl("azur_heure:paca_icairh_h24");
    expect(legendUrl).toContain("REQUEST=GetLegendGraphic");
    const decodedUrl = decodeURIComponent(legendUrl);
    expect(decodedUrl).toContain("LAYER=azur_heure:paca_icairh_h24");
  });

  it("lève une erreur pour les noms de layer invalides lorsqu'on construit la légende", () => {
    expect(() => getModelingLegendUrl("invalid-layer")).toThrow();
  });

  it("génère un titre de légende lisible selon le type de layer", () => {
    const title = getModelingLegendTitle("azur_heure:paca_pm2_5_h24");
    expect(title).toContain("Modélisation horaire");
    expect(title).toContain("PM");

    const icairhTitle = getModelingLegendTitle("azur_heure:paca_icairh_h23");
    expect(icairhTitle).toContain("ICAIR'H");
  });

  it("indique si la modélisation est disponible pour un pas de temps donné", () => {
    expect(isModelingAvailable("heure")).toBe(true);
    expect(isModelingAvailable("instantane")).toBe(false);
    expect(isModelingAvailable("scan")).toBe(false);
  });
});

