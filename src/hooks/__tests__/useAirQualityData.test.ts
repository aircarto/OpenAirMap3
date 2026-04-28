import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAirQualityData } from "../useAirQualityData";
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

  it("active atmoMicroOutage et conserve les devices AtmoMicro inactifs quand mesures/dernieres est indisponible", async () => {
    const mockAtmoMicroService = {
      fetchData: vi
        .fn()
        .mockResolvedValue([
          {
            id: "101",
            name: "Capteur Quartier",
            latitude: 43.2965,
            longitude: 5.3698,
            source: "atmoMicro",
            pollutant: "pm25",
            value: 0,
            unit: "µg/m³",
            timestamp: "2025-02-15T10:15:00Z",
            status: "inactive",
          },
        ]),
      isMeasuresUnavailableIncident: vi.fn().mockReturnValue(true),
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
    expect(result.current.devices).toHaveLength(1);
    expect(result.current.devices[0]).toMatchObject({
      source: "atmoMicro",
      status: "inactive",
      value: 0,
    });
  });
});
