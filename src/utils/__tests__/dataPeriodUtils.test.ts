import { describe, it, expect } from "vitest";
import {
  getDisplayedPeriod,
  getObservedDailyPeriodStart,
} from "../dataPeriodUtils";

const device = (
  source: string,
  timestamp: string,
  status: "active" | "inactive" = "active"
) => ({ source, timestamp, status });

describe("getObservedDailyPeriodStart", () => {
  it("retient le jour le plus récent des sources à jour calendaire", () => {
    expect(
      getObservedDailyPeriodStart([
        device("atmoRef", "2026-11-25T00:00:00+00:00"),
        device("atmoMicro", "2026-11-24T00:00:00+00:00"),
        device("atmoMicro", "2026-11-25T00:00:00+00:00"),
      ])
    ).toBe("2026-11-25T00:00:00.000Z");
  });

  it("ignore les sources horodatées autrement (NebuleAir : heure du dernier envoi)", () => {
    expect(
      getObservedDailyPeriodStart([
        device("atmoMicro", "2026-11-25T00:00:00+00:00"),
        // Minuit UTC pile, mais NebuleAir n'a pas la sémantique jour calendaire.
        device("nebuleair", "2026-11-26T00:00:00+00:00"),
        device("nebuleair", "2026-11-26T15:12:00+00:00"),
      ])
    ).toBe("2026-11-25T00:00:00.000Z");
  });

  it("ignore les capteurs inactifs (marqueurs gris)", () => {
    expect(
      getObservedDailyPeriodStart([
        device("atmoMicro", "2026-11-26T00:00:00+00:00", "inactive"),
        device("atmoMicro", "2026-11-25T00:00:00+00:00"),
      ])
    ).toBe("2026-11-25T00:00:00.000Z");
  });

  it("ignore les horodatages hors minuit UTC (mesures horaires résiduelles)", () => {
    expect(
      getObservedDailyPeriodStart([
        device("atmoRef", "2026-11-26T14:00:00+00:00"),
        device("atmoRef", "2026-11-25T00:00:00+00:00"),
      ])
    ).toBe("2026-11-25T00:00:00.000Z");
  });

  it("renvoie undefined sans observation exploitable", () => {
    expect(getObservedDailyPeriodStart([])).toBeUndefined();
    expect(
      getObservedDailyPeriodStart([
        device("nebuleair", "2026-11-26T15:12:00+00:00"),
        device("atmoMicro", "pas une date"),
      ])
    ).toBeUndefined();
  });
});

describe("getDisplayedPeriod en pas de temps jour", () => {
  it("affiche le jour observé, formaté en UTC", () => {
    expect(
      getDisplayedPeriod(
        "jour",
        undefined,
        "fr",
        undefined,
        "2026-11-25T00:00:00.000Z"
      )
    ).toBe("25/11/26");
  });

  it("omet l'année en format compact", () => {
    expect(
      getDisplayedPeriod(
        "jour",
        undefined,
        "fr",
        { compact: true },
        "2026-11-25T00:00:00.000Z"
      )
    ).toBe("25/11");
  });

  it("donne la priorité à la date du mode historique", () => {
    const withObserved = getDisplayedPeriod(
      "jour",
      "2026-10-01T12:00:00.000Z",
      "fr",
      undefined,
      "2026-11-25T00:00:00.000Z"
    );
    expect(withObserved).toBe(
      getDisplayedPeriod("jour", "2026-10-01T12:00:00.000Z", "fr")
    );
  });

  it("n'utilise pas le jour observé pour les autres pas de temps", () => {
    expect(
      getDisplayedPeriod(
        "heure",
        undefined,
        "fr",
        undefined,
        "2026-11-25T00:00:00.000Z"
      )
    ).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
  });
});
