import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileAirService } from "../MobileAirService";

const baseParams = {
  pollutant: "pm25",
  timeStep: "deuxMin",
  sources: ["mobileair"],
  selectedSensors: [],
};

const buildSensor = (overrides: Partial<Record<string, any>> = {}) => ({
  sensorId: "mob-001",
  sensorToken: "token-001",
  time: new Date().toISOString(),
  PM25: "12.5",
  PM10: "20.1",
  PM1: "8.4",
  latitude: "43.29",
  longitude: "5.37",
  connected: true,
  ...overrides,
});

const buildDataPoint = (overrides: Partial<Record<string, any>> = {}) => ({
  time: "2025-02-15T10:00:00Z",
  sessionId: 42,
  sensorId: "mob-001",
  lat: 43.2901,
  lon: 5.3705,
  PM25: 14.2,
  PM10: 22.6,
  PM1: 9.1,
  ...overrides,
});

describe("MobileAirService", () => {
  let service: MobileAirService;

  beforeEach(() => {
    service = new MobileAirService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne un tableau vide si la source MobileAir n'est pas sélectionnée", async () => {
    const fetchSensorsSpy = vi.spyOn(service as any, "fetchSensors");

    const result = await service.fetchData({
      ...baseParams,
      sources: ["atmoRef"],
    });

    expect(result).toEqual([]);
    expect(fetchSensorsSpy).not.toHaveBeenCalled();
  });

  it("retourne un device placeholder lorsqu'aucun capteur spécifique n'est choisi", async () => {
    vi.spyOn(service as any, "fetchSensors").mockResolvedValue(undefined);
    (service as any).sensors = [buildSensor()];

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "mobileair-placeholder",
      name: expect.stringContaining("Sélectionnez des capteurs"),
      source: "mobileair",
      status: "active",
    });
  });

  it("retourne un tableau vide pour un polluant non supporté", async () => {
    const fetchSensorsSpy = vi.spyOn(service as any, "fetchSensors");

    (service as any).sensors = [buildSensor()];

    const result = await service.fetchData({
      ...baseParams,
      pollutant: "so2",
    });

    expect(result).toEqual([]);
    expect(fetchSensorsSpy).not.toHaveBeenCalled();
  });

  it("récupère les parcours et crée des devices pour les capteurs sélectionnés", async () => {
    (service as any).sensors = [buildSensor()];

    const firstSession = buildDataPoint({ sessionId: 42 });
    const secondSession = buildDataPoint({
      sessionId: 43,
      time: "2025-02-15T11:00:00Z",
      PM25: 18.4,
    });

    const makeRequestSpy = vi
      .spyOn(service as any, "makeRequest")
      .mockResolvedValue([firstSession, secondSession]);

    const params = {
      ...baseParams,
      selectedSensors: ["mob-001"],
    };

    const result = await service.fetchData(params);

    expect(makeRequestSpy).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);

    const firstDevice = result.find((device) =>
      device.id.includes("session-42"),
    );
    expect(firstDevice).toMatchObject({
      pollutant: "pm25",
      source: "mobileair",
      status: "active",
    });
    expect(firstDevice).toHaveProperty("mobileAirRoute");
    expect((firstDevice as any).mobileAirRoute.points).toHaveLength(1);
  });

  it("ignore les capteurs inconnus dans selectedSensors", async () => {
    (service as any).sensors = [buildSensor()];

    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      ...baseParams,
      selectedSensors: ["unknown"],
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });
});

