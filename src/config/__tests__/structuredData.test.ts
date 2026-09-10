import { describe, it, expect } from "vitest";
import { buildStructuredData } from "../structuredData";
import { DOMAIN_CONFIG } from "../domainConfig";

describe("buildStructuredData", () => {
  it("produit un JSON-LD de type Dataset avec l'URL fournie", () => {
    const data = buildStructuredData(
      DOMAIN_CONFIG.atmosud,
      "https://openairmap.atmosud.org/"
    );

    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Dataset");
    expect(data.url).toBe("https://openairmap.atmosud.org/");
  });

  it("utilise seoTitle en priorite pour le champ name, sinon title", () => {
    const withSeoTitle = buildStructuredData(DOMAIN_CONFIG.atmosud, "https://example.org/");
    expect(withSeoTitle.name).toBe(DOMAIN_CONFIG.atmosud.seoTitle);

    const withoutSeoTitle = buildStructuredData(
      { ...DOMAIN_CONFIG.default, seoTitle: undefined },
      "https://example.org/"
    );
    expect(withoutSeoTitle.name).toBe(DOMAIN_CONFIG.default.title);
  });

  it("derive spatialCoverage.geo.box a partir de mapBounds ([sud, ouest] / [nord, est])", () => {
    const data = buildStructuredData(DOMAIN_CONFIG.atmosud, "https://example.org/");
    const [[south, west], [north, east]] = DOMAIN_CONFIG.atmosud.mapBounds;

    expect(data.spatialCoverage.geo.box).toBe(`${south} ${west} ${north} ${east}`);
  });

  it("declare temporalCoverage pour atmosud depuis sa premiere mesure, en periode ouverte", () => {
    const data = buildStructuredData(DOMAIN_CONFIG.atmosud, "https://example.org/");

    expect(data.temporalCoverage).toBe(
      `${DOMAIN_CONFIG.atmosud.earliestMeasurementDate}/..`
    );
  });

  it("ne declare pas temporalCoverage pour default (date de premiere mesure inconnue pour cette instance)", () => {
    expect(DOMAIN_CONFIG.default.earliestMeasurementDate).toBeUndefined();

    const data = buildStructuredData(DOMAIN_CONFIG.default, "https://example.org/");

    expect(data).not.toHaveProperty("temporalCoverage");
  });

  it("ne declare pas de license (page a propos pas encore disponible)", () => {
    const data = buildStructuredData(DOMAIN_CONFIG.atmosud, "https://example.org/");

    expect(data).not.toHaveProperty("license");
  });

  it("differencie spatialCoverage et creator entre atmosud (region Sud) et default (France)", () => {
    const atmosudData = buildStructuredData(DOMAIN_CONFIG.atmosud, "https://example.org/");
    const defaultData = buildStructuredData(DOMAIN_CONFIG.default, "https://example.org/");

    expect(atmosudData.spatialCoverage.geo.box).not.toBe(
      defaultData.spatialCoverage.geo.box
    );
    expect(atmosudData.creator.name).toBe("AtmoSud");
    expect(defaultData.creator.name).toBe("AtmoSud et AirCarto");
  });
});
