import { describe, it, expect, vi, beforeEach } from "vitest";
import { SensorCommunityService } from "../SensorCommunityService";
import { buildSensorCommunityDataPoint } from "../../tests/fixtures/sensorCommunity";

const baseParams = {
  pollutant: "pm10",
  timeStep: "instantane",
  sources: ["sensorCommunity"],
};

describe("SensorCommunityService", () => {
  let service: SensorCommunityService;

  beforeEach(() => {
    service = new SensorCommunityService();
  });

  it("retourne un tableau vide lorsque la source n'est pas sélectionnée", async () => {
    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      ...baseParams,
      sources: ["atmoRef"],
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide si le pas de temps n'est pas supporté", async () => {
    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      ...baseParams,
      timeStep: "heure",
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide si le polluant n'est pas supporté", async () => {
    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      pollutant: "no2",
      timeStep: "instantane",
      sources: ["sensorCommunity"],
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("transforme la réponse Sensor Community en appareils de mesure normalisés", async () => {
    const mockedData = [
      buildSensorCommunityDataPoint({
        sensor: {
          id: 1111,
        },
        location: {
          id: 999,
          latitude: "43.611",
          longitude: "3.877",
          altitude: "42",
        },
        sensordatavalues: [
          {
            id: 1,
            value: "12.3",
            value_type: "P1",
          },
          {
            id: 2,
            value: "8.4",
            value_type: "P2",
          },
        ],
      }),
      // Doublon pour vérifier la déduplication
      buildSensorCommunityDataPoint({
        sensor: {
          id: 1111,
        },
        location: {
          id: 999,
        },
      }),
      // Capteur sans valeur pertinente
      buildSensorCommunityDataPoint({
        sensor: {
          id: 2222,
        },
        location: {
          id: 998,
        },
        sensordatavalues: [
          {
            id: 3,
            value: "15.0",
            value_type: "temperature",
          },
        ],
      }),
    ];

    vi.spyOn(service as any, "makeRequest").mockResolvedValue(mockedData);

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);

    const device = result[0];
    expect(device).toMatchObject({
      id: "1111_999",
      name: expect.stringContaining("Sensor Community"),
      latitude: 43.611,
      longitude: 3.877,
      source: "sensorCommunity",
      pollutant: "pm10",
      value: 12.3,
      unit: "µg/m³",
      status: "active",
      address: "Altitude: 42m",
      departmentId: "FR",
      qualityLevel: "bon",
    });

    expect((device as any).sensorId).toBe("1111");
    expect((device as any).manufacturer).toBe("Luftdaten");
    expect((device as any).sensorType).toBe("Nova SDS011");
    expect((device as any).altitude).toBe("42");
  });
});

