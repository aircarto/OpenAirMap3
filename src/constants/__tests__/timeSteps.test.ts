import { describe, it, expect } from "vitest";
import {
  getAvailableTimeSteps,
  getDefaultTimeStep,
  isTimeStepAvailable,
} from "../timeSteps";

describe("timeSteps (branche AirCrowd)", () => {
  it("n’expose que le pas horaire", () => {
    expect(getAvailableTimeSteps()).toEqual(["heure"]);
    expect(getDefaultTimeStep()).toBe("heure");
    expect(isTimeStepAvailable("heure")).toBe(true);
    expect(isTimeStepAvailable("quartHeure")).toBe(false);
    expect(isTimeStepAvailable("instantane")).toBe(false);
    expect(isTimeStepAvailable("deuxMin")).toBe(false);
    expect(isTimeStepAvailable("jour")).toBe(false);
  });
});
