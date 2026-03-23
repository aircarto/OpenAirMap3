import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PurpleAirService } from "../PurpleAirService";

const baseParams = {
  pollutant: "pm25",
  timeStep: "instantane",
  sources: ["purpleair"],
};

const buildSensor = (overrides: Partial<Record<string, any>> = {}) => {
  const sensor = {
    sensor_index: 12345,
    last_seen: Math.floor(Date.now() / 1000),
    name: "PurpleAir Marseille",
    location_type: 0,
    rssi: -50,
    uptime: 123456,
    latitude: 43.2965,
    longitude: 5.3698,
    confidence: 90,
    humidity: 45,
    temperature: 21,
    "pm1.0_atm": 8.4,
    "pm2.5_atm": 12.5,
    "pm10.0_atm": 20.1,
    ...overrides,
  };

  // Retourner la forme tableau attendue par fetchOutdoorSensors
  return [
    sensor.sensor_index,
    sensor.last_seen,
    sensor.name,
    sensor.location_type,
    sensor.rssi,
    sensor.uptime,
    sensor.latitude,
    sensor.longitude,
    sensor.confidence,
    sensor.humidity,
    sensor.temperature,
    sensor["pm1.0_atm"],
    sensor["pm2.5_atm"],
    sensor["pm10.0_atm"],
  ];
};

describe("PurpleAirService", () => {
  let service: PurpleAirService;

  beforeEach(() => {
    service = new PurpleAirService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne un tableau vide pour un polluant non supporté", async () => {
    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      ...baseParams,
      pollutant: "no2",
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("transforme les capteurs PurpleAir en MeasurementDevice", async () => {
    const sensorArray = buildSensor();
    vi.spyOn(service as any, "makeRequest").mockResolvedValue({
      data: [sensorArray],
    });

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);
    const device = result[0];
    expect(device).toMatchObject({
      id: "12345",
      name: "PurpleAir Marseille",
      latitude: 43.2965,
      longitude: 5.3698,
      source: "purpleair",
      pollutant: "pm25",
      value: 12.5,
      unit: "µg/m³",
      status: "active",
      qualityLevel: "moyen",
      pm1Value: 8.4,
      pm25Value: 12.5,
      pm10Value: 20.1,
    });
  });

  it("filtre les capteurs en dehors des bornes géographiques", async () => {
    const inFrance = buildSensor();
    const outsideFrance = buildSensor({ latitude: 60, longitude: 15 });

    vi.spyOn(service as any, "makeRequest").mockResolvedValue({
      data: [inFrance, outsideFrance],
    });

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("PurpleAir Marseille");
  });

  it("intègre les métadonnées techniques (RSSI, uptime, etc.)", async () => {
    const sensorArray = buildSensor({ rssi: -80, confidence: 75 });
    vi.spyOn(service as any, "makeRequest").mockResolvedValue({
      data: [sensorArray],
    });

    const result = await service.fetchData(baseParams);

    const device = result[0];
    expect(device).toMatchObject({
      rssi: -80,
      confidence: 75,
      temperature: 21,
      humidity: 45,
    });
  });

  it("marque un capteur comme inactif si last_seen remonte à plus de 2 heures", async () => {
    const oldSensor = buildSensor({
      last_seen: Math.floor(Date.now() / 1000) - 3 * 3600,
    });

    vi.spyOn(service as any, "makeRequest").mockResolvedValue({
      data: [oldSensor],
    });

    const result = await service.fetchData(baseParams);
    expect(result[0].status).toBe("inactive");
  });
});

