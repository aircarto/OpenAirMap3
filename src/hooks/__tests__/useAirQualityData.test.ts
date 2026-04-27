import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAirQualityData } from "../useAirQualityData";
import { AtmoMicroMeasuresUnavailableError } from "../../services/AtmoMicroService";
import { DataServiceFactory } from "../../services/DataServiceFactory";

vi.mock("../../services/DataServiceFactory", () => ({
  DataServiceFactory: {
    getServices: vi.fn(),
    getService: vi.fn(),
  },
}));

describe("useAirQualityData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("active atmoMicroOutage et retire les devices AtmoMicro quand mesures/dernieres est indisponible", async () => {
    const mockAtmoMicroService = {
      fetchData: vi
        .fn()
        .mockRejectedValue(new AtmoMicroMeasuresUnavailableError()),
    };

    vi.mocked(DataServiceFactory.getServices).mockReturnValue([
      mockAtmoMicroService as any,
    ]);

    const { result } = renderHook(() =>
      useAirQualityData({
        selectedPollutant: "pm25",
        selectedSources: ["atmoMicro"],
        selectedTimeStep: "heure",
        autoRefreshEnabled: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.atmoMicroOutage).toBe(true);
    expect(result.current.devices).toEqual([]);
  });
});
