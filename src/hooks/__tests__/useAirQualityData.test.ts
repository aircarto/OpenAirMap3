import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAirQualityData } from "../useAirQualityData";
import { DataServiceFactory } from "../../services/DataServiceFactory";
import type { MeasurementDevice } from "../../types";

vi.mock("../../services/DataServiceFactory", () => ({
  DataServiceFactory: {
    getServices: vi.fn(),
    getService: vi.fn(),
  },
}));

const mobileAirDevice = (
  sensorId: string,
  sessionId: number,
  extras?: Partial<MeasurementDevice>
): MeasurementDevice & {
  mobileAirRoute: { sensorId: string; sessionId: number };
} =>
  ({
    id: `${sensorId}-session-${sessionId}`,
    name: `Parcours ${sensorId}`,
    latitude: 43.3,
    longitude: 5.4,
    source: "mobileair",
    pollutant: "pm25",
    value: 10,
    unit: "µg/m³",
    timestamp: "2026-09-25T10:00:00Z",
    status: "active",
    qualityLevel: "bon",
    mobileAirRoute: { sensorId, sessionId },
    ...extras,
  }) as MeasurementDevice & {
    mobileAirRoute: { sensorId: string; sessionId: number };
  };

describe("useAirQualityData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DataServiceFactory.getServices).mockReturnValue([]);
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

  it("conserve les sessions des autres capteurs lors d’un refetch partiel MobileAir", async () => {
    const deviceA1 = mobileAirDevice("sensor-a", 1);
    const deviceB1 = mobileAirDevice("sensor-b", 1);
    const deviceA2 = mobileAirDevice("sensor-a", 2, { value: 22 });

    const fetchData = vi
      .fn()
      .mockResolvedValueOnce([deviceA1, deviceB1])
      .mockResolvedValueOnce([deviceA2]);

    vi.mocked(DataServiceFactory.getService).mockReturnValue({
      fetchData,
      clearRoutes: vi.fn(),
    } as any);

    const period = {
      startDate: "2026-09-18T00:00:00Z",
      endDate: "2026-09-25T00:00:00Z",
    };

    const { result, rerender } = renderHook(
      (props: {
        partialSensors: string[];
        partialToken: number;
        sensorPeriods: Record<string, typeof period>;
      }) =>
        useAirQualityData({
          selectedPollutant: "pm25",
          // Mode mobilité : mobileair hors selectedSources (cas qui révélait le bug)
          selectedSources: [],
          selectedTimeStep: "heure",
          autoRefreshEnabled: false,
          selectedMobileAirSensors: ["sensor-a", "sensor-b"],
          mobileAirPeriod: period,
          mobileAirSensorPeriods: props.sensorPeriods,
          mobileAirPartialRefetchSensors: props.partialSensors,
          mobileAirPartialRefetchToken: props.partialToken,
        }),
      {
        initialProps: {
          partialSensors: [] as string[],
          partialToken: 0,
          sensorPeriods: {} as Record<string, typeof period>,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.devices).toHaveLength(2);
    });

    expect(
      result.current.devices.map(
        (d) =>
          (d as MeasurementDevice & { mobileAirRoute?: { sensorId: string } })
            .mobileAirRoute?.sensorId
      )
    ).toEqual(expect.arrayContaining(["sensor-a", "sensor-b"]));

    await act(async () => {
      rerender({
        partialSensors: ["sensor-a"],
        partialToken: 1,
        sensorPeriods: {
          "sensor-a": {
            startDate: "2026-09-20T00:00:00Z",
            endDate: "2026-09-25T00:00:00Z",
          },
        },
      });
    });

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(2);
      const sensorIds = result.current.devices.map(
        (d) =>
          (d as MeasurementDevice & { mobileAirRoute?: { sensorId: string } })
            .mobileAirRoute?.sensorId
      );
      expect(sensorIds).toContain("sensor-b");
      expect(sensorIds).toContain("sensor-a");
    });

    const deviceA = result.current.devices.find(
      (d) =>
        (d as MeasurementDevice & { mobileAirRoute?: { sensorId: string } })
          .mobileAirRoute?.sensorId === "sensor-a"
    );
    expect(deviceA?.value).toBe(22);
    expect(result.current.devices).toHaveLength(2);

    // Le 2e appel doit être partiel (un seul capteur)
    expect(fetchData.mock.calls[1][0]).toMatchObject({
      selectedSensors: ["sensor-a"],
      mobileAirPartialReplace: true,
    });
  });
});
