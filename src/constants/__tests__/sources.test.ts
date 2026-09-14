import { describe, expect, it } from "vitest";
import {
  sources,
  COMMUNAUTAIRE_SOURCE_CODES,
  getDefaultSources,
} from "../sources";

describe("sources AtmoSud uniquement", () => {
  it("n'expose que atmoRef et atmoMicro", () => {
    expect(Object.keys(sources)).toEqual(["atmoRef", "atmoMicro"]);
  });

  it("n'expose aucune sous-source communautaire", () => {
    expect(COMMUNAUTAIRE_SOURCE_CODES).toEqual([]);
  });

  it("active atmoRef et atmoMicro par défaut", () => {
    expect(getDefaultSources()).toEqual(["atmoRef", "atmoMicro"]);
  });
});
