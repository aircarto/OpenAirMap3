import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissSensorPromo,
  isSensorPromoDismissed,
  SENSOR_PROMO_DISMISS_KEY,
} from "../useSensorPromoDismiss";

describe("useSensorPromoDismiss storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("retourne false si aucune donnée n'est stockée", () => {
    expect(isSensorPromoDismissed()).toBe(false);
  });

  it("persiste l'état de fermeture en sessionStorage", () => {
    dismissSensorPromo();

    expect(sessionStorage.getItem(SENSOR_PROMO_DISMISS_KEY)).toBe("true");
    expect(isSensorPromoDismissed()).toBe(true);
  });

  it("retourne false si sessionStorage est indisponible à la lecture", () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("sessionStorage blocked");
      });

    expect(isSensorPromoDismissed()).toBe(false);
    getItemSpy.mockRestore();
  });

  it("ignore les erreurs d'écriture sessionStorage", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(() => dismissSensorPromo()).not.toThrow();
    setItemSpy.mockRestore();
  });
});
