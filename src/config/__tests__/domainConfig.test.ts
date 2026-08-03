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

  it("ne renseigne les mentions legales AtmoSud que pour la config atmosud", () => {
    expect(DOMAIN_CONFIG.default.legal).toBeUndefined();
    expect(DOMAIN_CONFIG.atmosud.legal).toBeDefined();
  });
});
