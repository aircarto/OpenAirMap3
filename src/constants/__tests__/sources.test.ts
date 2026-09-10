import { describe, expect, it } from "vitest";
import {
  sources,
  COMMUNAUTAIRE_SOURCE_CODES,
  EXCLUDED_FROM_GROUP_TOGGLE,
  getDefaultSources,
} from "../sources";

describe("périmètre du tout-cocher communautaire", () => {
  it("couvre toutes les sous-sources communautaires sauf les exclues", () => {
    const allSubKeys = Object.keys(sources.communautaire.subSources ?? {});
    const expected = allSubKeys
      .filter(
        (key) => !(EXCLUDED_FROM_GROUP_TOGGLE as readonly string[]).includes(key)
      )
      .map((key) => `communautaire.${key}`);

    expect(COMMUNAUTAIRE_SOURCE_CODES).toEqual(expected);
  });

  /**
   * Le cœur du cahier des charges : MobileAir n'entre jamais dans
   * `selectedSources`, son activation passant par un booléen propre parce qu'elle
   * n'affiche rien avant qu'un capteur et une période aient été choisis puis
   * chargés. L'ajouter au périmètre RESSEMBLERAIT à un correctif — le tout-cocher
   * l'allumerait sans rien montrer, et le compte « n/total » mentirait.
   */
  it("exclut mobileair, qui n'appartient pas à selectedSources", () => {
    expect(COMMUNAUTAIRE_SOURCE_CODES).not.toContain("communautaire.mobileair");
    expect(EXCLUDED_FROM_GROUP_TOGGLE).toContain("mobileair");
  });

  it("ne contient que des codes réellement déclarés", () => {
    for (const code of COMMUNAUTAIRE_SOURCE_CODES) {
      const [group, sub] = code.split(".");
      expect(group).toBe("communautaire");
      expect(sources.communautaire.subSources?.[sub]).toBeDefined();
    }
  });

  it("laisse getDefaultSources inchangé", () => {
    // Les défauts dérivent de `activated`, pas du périmètre du tout-cocher :
    // les deux dérivations doivent rester indépendantes.
    expect(getDefaultSources()).toEqual([
      "atmoRef",
      "atmoMicro",
      "communautaire.nebuleair",
    ]);
  });
});
