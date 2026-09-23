import { describe, expect, it } from "vitest";
import {
  formatMobileAirPeriodRange,
  getMobileAirMapPeriod,
} from "../mobileAirPeriodUtils";

describe("getMobileAirMapPeriod", () => {
  const defaultPeriod = {
    startDate: "2024-01-10T00:00:00.000Z",
    endDate: "2024-01-12T00:00:00.000Z",
  };

  it("retourne la période par défaut si aucun capteur", () => {
    expect(getMobileAirMapPeriod(defaultPeriod, {}, [])).toEqual(defaultPeriod);
  });

  it("calcule l’enveloppe min/max sur overrides et défaut", () => {
    const envelope = getMobileAirMapPeriod(
      defaultPeriod,
      {
        a: {
          startDate: "2024-01-09T00:00:00.000Z",
          endDate: "2024-01-11T00:00:00.000Z",
        },
        b: {
          startDate: "2024-01-11T00:00:00.000Z",
          endDate: "2024-01-14T00:00:00.000Z",
        },
      },
      ["a", "b"]
    );
    expect(envelope).toEqual({
      startDate: "2024-01-09T00:00:00.000Z",
      endDate: "2024-01-14T00:00:00.000Z",
    });
  });
});

describe("formatMobileAirPeriodRange", () => {
  it("formate une plage lisible", () => {
    const label = formatMobileAirPeriodRange(
      {
        startDate: "2024-01-10T00:00:00.000Z",
        endDate: "2024-01-12T00:00:00.000Z",
      },
      "fr"
    );
    expect(label).toMatch(/10/);
    expect(label).toMatch(/12/);
    expect(label).toContain("–");
  });
});
