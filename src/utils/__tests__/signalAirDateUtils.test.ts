import { describe, expect, it } from "vitest";
import {
  extendSignalAirFetchStart,
  filterReportsByDisplayWindow,
  getReportPeriodInLocal,
  parseSignalDuration,
} from "../signalAirDateUtils";
import type { SignalAirReport } from "../../types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Dates locales sans fuseau : même convention que le flux SignalAir. */
const report = (signalDate: string, signalDuration: string): SignalAirReport =>
  ({
    id: `${signalDate}-${signalDuration}`,
    source: "signalair",
    signalType: "odeur",
    signalDate,
    signalDuration,
  }) as SignalAirReport;

const visibleAt = (r: SignalAirReport, slot: string, timeStep: string) =>
  filterReportsByDisplayWindow([r], slot, timeStep).length === 1;

describe("parseSignalDuration — catégories du flux SignalAir", () => {
  it.each([
    ["Moins d'une heure", HOUR],
    ["Moins d’une heure", HOUR],
    ["moins d'une heure", HOUR],
    ["Quelques heures", 3 * HOUR],
    ["QUELQUES HEURES", 3 * HOUR],
    ["Plusieurs jours", 3 * DAY],
    ["Quelques jours", 3 * DAY],
    ["Toute la journée", DAY],
  ])("« %s » → %d ms", (input, expected) => {
    expect(parseSignalDuration(input)).toBe(expected);
  });

  it.each(["Ne sait pas", "", "   ", undefined, null, "n'importe quoi"])(
    "durée inconnue (%j) → null",
    (input) => {
      expect(parseSignalDuration(input)).toBeNull();
    }
  );

  it.each([
    ["2h", 2 * HOUR],
    ["1,5 heure", 1.5 * HOUR],
    ["30 minutes", 30 * 60 * 1000],
    ["3 jours", 3 * DAY],
  ])("format numérique « %s » toujours lu", (input, expected) => {
    expect(parseSignalDuration(input)).toBe(expected);
  });
});

describe("getReportPeriodInLocal", () => {
  it("durée inconnue : de l'heure déclarée jusqu'à minuit", () => {
    const { startMs, endMs } = getReportPeriodInLocal(
      report("2026-11-27 15:00:00", "Ne sait pas")
    );
    expect(startMs).toBe(new Date(2026, 10, 27, 15).getTime());
    expect(endMs).toBe(new Date(2026, 10, 27, 23, 59, 59, 999).getTime());
  });

  it("sans date déclarée : exclu", () => {
    expect(getReportPeriodInLocal(report("", "Quelques heures"))).toEqual({
      startMs: 0,
      endMs: 0,
    });
  });
});

describe("filterReportsByDisplayWindow — n'afficher que les nuisances de la période", () => {
  it("« Quelques heures » à 9 h 36 : visible de 9 h à 12 h, plus à 13 h", () => {
    const r = report("2026-11-27 09:36:00", "Quelques heures");
    for (const h of ["09", "10", "11", "12"]) {
      expect(visibleAt(r, `2026-11-27T${h}:00:00`, "heure")).toBe(true);
    }
    expect(visibleAt(r, "2026-11-27T13:00:00", "heure")).toBe(false);
    expect(visibleAt(r, "2026-11-27T08:00:00", "heure")).toBe(false);
  });

  it("« Moins d'une heure » déclarée pile à 15 h : visible sur le créneau 15 h", () => {
    const r = report("2026-11-27 15:00:00", "Moins d'une heure");
    expect(visibleAt(r, "2026-11-27T15:00:00", "heure")).toBe(true);
    expect(visibleAt(r, "2026-11-27T16:00:00", "heure")).toBe(false);
  });

  it("au pas jour, « Quelques heures » à 23 h déborde sur le lendemain", () => {
    const r = report("2026-11-26 23:00:00", "Quelques heures");
    expect(visibleAt(r, "2026-11-26T00:00:00", "jour")).toBe(true);
    expect(visibleAt(r, "2026-11-27T00:00:00", "jour")).toBe(true);
    expect(visibleAt(r, "2026-11-28T00:00:00", "jour")).toBe(false);
  });

  it("« Ne sait pas » à 15 h : visible jusqu'à 23 h, ni avant ni le lendemain", () => {
    const r = report("2026-11-27 15:00:00", "Ne sait pas");
    expect(visibleAt(r, "2026-11-27T14:00:00", "heure")).toBe(false);
    expect(visibleAt(r, "2026-11-27T15:00:00", "heure")).toBe(true);
    expect(visibleAt(r, "2026-11-27T23:00:00", "heure")).toBe(true);
    expect(visibleAt(r, "2026-11-28T00:00:00", "heure")).toBe(false);
  });

  it("« Plusieurs jours » le 20 : visible du 20 au 23, plus le 24", () => {
    const r = report("2026-11-20 10:00:00", "Plusieurs jours");
    for (const d of ["20", "21", "22", "23"]) {
      expect(visibleAt(r, `2026-11-${d}T00:00:00`, "jour")).toBe(true);
    }
    expect(visibleAt(r, "2026-11-24T00:00:00", "jour")).toBe(false);
  });
});

describe("extendSignalAirFetchStart — marge de chargement", () => {
  it("recule de 3 jours, y compris à travers un changement de mois ou d'année", () => {
    expect(extendSignalAirFetchStart("2026-11-27")).toBe("2026-11-24");
    expect(extendSignalAirFetchStart("2026-12-02")).toBe("2026-11-29");
    expect(extendSignalAirFetchStart("2026-01-01")).toBe("2025-12-29");
  });

  it("laisse une date illisible intacte", () => {
    expect(extendSignalAirFetchStart("")).toBe("");
    expect(extendSignalAirFetchStart("n/a")).toBe("n/a");
  });

  it("une nuisance « Plusieurs jours » commencée à la date reculée reste dans la période qu'elle couvre", () => {
    // Pas horaire, buffer du 27 : chargement depuis le 24, nuisance du 24 à
    // 20 h qui court jusqu'au 27 à 20 h → visible au créneau 27/11 10 h.
    const r = report("2026-11-24 20:00:00", "Plusieurs jours");
    expect(visibleAt(r, "2026-11-27T10:00:00", "heure")).toBe(true);
  });
});
