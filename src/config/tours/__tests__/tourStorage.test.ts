import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTourCompleted,
  markTourCompleted,
  readToursCompleted,
  resetTourCompletion,
  writeToursCompleted,
} from "../tourStorage";
import { TOUR_STORAGE_KEY } from "../types";

describe("tourStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("retourne un objet vide si aucune donnée n'est stockée", () => {
    expect(readToursCompleted()).toEqual({});
    expect(isTourCompleted("historical_mode")).toBe(false);
  });

  it("persiste et relit l'état de complétion d'un tutoriel", () => {
    markTourCompleted("historical_mode", false);

    expect(isTourCompleted("historical_mode")).toBe(true);
    expect(readToursCompleted().historical_mode?.skipped).toBe(false);
    expect(readToursCompleted().historical_mode?.completedAt).toBeTruthy();
  });

  it("marque un tutoriel comme ignoré", () => {
    markTourCompleted("historical_mode", true);

    expect(readToursCompleted().historical_mode?.skipped).toBe(true);
  });

  it("réinitialise la complétion d'un tutoriel", () => {
    markTourCompleted("historical_mode");
    resetTourCompletion("historical_mode");

    expect(isTourCompleted("historical_mode")).toBe(false);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("{}");
  });

  it("retourne un objet vide si le JSON stocké est invalide", () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "{invalid");

    expect(readToursCompleted()).toEqual({});
  });

  it("ignore les erreurs d'écriture localStorage", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(() => writeToursCompleted({ historical_mode: { completedAt: "x", skipped: false } })).not.toThrow();
    setItemSpy.mockRestore();
  });
});
