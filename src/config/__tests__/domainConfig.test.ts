import { describe, it, expect } from "vitest";
import { getConfigForDomain, DOMAIN_CONFIG } from "../domainConfig";

describe("getConfigForDomain", () => {
  it("retourne la config atmosud pour le domaine de production", () => {
    expect(getConfigForDomain("openairmap.atmosud.org")).toBe(
      DOMAIN_CONFIG.atmosud
    );
  });

  it("retourne la config atmosud pour un sous-domaine atmosud.org (ex: preprod)", () => {
    expect(getConfigForDomain("preprod-openairmap.atmosud.org")).toBe(
      DOMAIN_CONFIG.atmosud
    );
  });

  it("retourne la config par defaut pour un domaine non-atmosud", () => {
    expect(getConfigForDomain("openairmap.fr")).toBe(DOMAIN_CONFIG.default);
  });

  it("retourne la config par defaut pour localhost", () => {
    expect(getConfigForDomain("localhost")).toBe(DOMAIN_CONFIG.default);
  });

  it("differencie le seoTitle et la description entre atmosud et default (le title affiche en navbar reste identique)", () => {
    expect(DOMAIN_CONFIG.atmosud.seoTitle).toBeDefined();
    expect(DOMAIN_CONFIG.atmosud.seoTitle).not.toBe(DOMAIN_CONFIG.default.title);
    expect(DOMAIN_CONFIG.atmosud.description).not.toBe(
      DOMAIN_CONFIG.default.description
    );
  });

  it("ne renseigne les mentions legales AtmoSud que pour la config atmosud (default garde les champs vides)", () => {
    const defaultLegal = DOMAIN_CONFIG.default.legal;
    expect(defaultLegal).toBeDefined();
    expect(defaultLegal?.siret).toBe("");
    expect(defaultLegal?.legalForm).toBe("");
    expect(defaultLegal?.address).toBe("");
    expect(defaultLegal?.legalRepresentative).toBe("");
    expect(defaultLegal?.publicationDirector).toBe("");
    expect(defaultLegal?.hosting).toBe("");
    expect(defaultLegal?.dpo).toBe("");
    expect(defaultLegal?.vatNumber).toBe("");
    expect(defaultLegal?.privacyPolicyUrl).toBe("");
    expect(defaultLegal?.hostingProvider?.siret).toBe("");

    const atmosudLegal = DOMAIN_CONFIG.atmosud.legal;
    expect(atmosudLegal?.siret).not.toBe("");
    expect(atmosudLegal?.address).not.toBe("");
  });

  it("differencie la zone geographique : default = France, atmosud = region Sud", () => {
    expect(DOMAIN_CONFIG.default.mapBounds).not.toEqual(
      DOMAIN_CONFIG.atmosud.mapBounds
    );
    expect(DOMAIN_CONFIG.default.mapCenter).not.toEqual(
      DOMAIN_CONFIG.atmosud.mapCenter
    );

    // Bounds region Sud contenues dans les bounds France (sanity check des valeurs)
    const [[defaultSouth, defaultWest], [defaultNorth, defaultEast]] =
      DOMAIN_CONFIG.default.mapBounds;
    const [[atmosudSouth, atmosudWest], [atmosudNorth, atmosudEast]] =
      DOMAIN_CONFIG.atmosud.mapBounds;

    expect(atmosudSouth).toBeGreaterThanOrEqual(defaultSouth);
    expect(atmosudWest).toBeGreaterThanOrEqual(defaultWest);
    expect(atmosudNorth).toBeLessThanOrEqual(defaultNorth);
    expect(atmosudEast).toBeLessThanOrEqual(defaultEast);
  });

  it("differencie organization : atmosud seul vs AtmoSud et AirCarto pour default", () => {
    expect(DOMAIN_CONFIG.atmosud.organization).toBe("AtmoSud");
    expect(DOMAIN_CONFIG.default.organization).toBe("AtmoSud et AirCarto");
    expect(DOMAIN_CONFIG.atmosud.organization).not.toBe(
      DOMAIN_CONFIG.default.organization
    );
  });
});
