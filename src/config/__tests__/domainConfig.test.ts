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

  it("differencie bien le titre et la description entre atmosud et default", () => {
    expect(DOMAIN_CONFIG.atmosud.title).not.toBe(DOMAIN_CONFIG.default.title);
    expect(DOMAIN_CONFIG.atmosud.description).not.toBe(
      DOMAIN_CONFIG.default.description
    );
  });
});
