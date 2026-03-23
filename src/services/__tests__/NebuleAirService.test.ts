import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NebuleAirService } from "../NebuleAirService";

const baseParams = {
  pollutant: "pm25",
  timeStep: "quartHeure",
  sources: ["nebuleair"],
};

const buildSensor = (overrides: Partial<Record<string, any>> = {}) => {
  const now = new Date().toISOString();
  return {
    sensorId: "neb-001",
    time: now,
    timeUTC: now,
    latitude: "43.2965",
    longitude: "5.3698",
    displayMap: true,
    PM25: "8.2",
    PM25_qh: "12.4",
    PM25_h: "13.1",
    PM10: "20.5",
    COV: "-1",
    wifi_signal: "-70",
    AtmoSud: false,
    last_seen_sec: 120,
    connected: true,
    check_token: false,
    room: null,
    etage: null,
    ...overrides,
  };
};

describe("NebuleAirService", () => {
  let service: NebuleAirService;

  beforeEach(() => {
    service = new NebuleAirService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne un tableau vide pour un polluant non supporté", async () => {
    const fetchSpy = vi.spyOn(service as any, "fetchSensorsData");

    const result = await service.fetchData({
      ...baseParams,
      pollutant: "no2",
    });

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide pour un pas de temps non supporté", async () => {
    const fetchSpy = vi.spyOn(service as any, "fetchSensorsData");

    const result = await service.fetchData({
      ...baseParams,
      timeStep: "mois",
    });

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("transforme les capteurs NebuleAir en MeasurementDevice actifs", async () => {
    vi.spyOn(service as any, "fetchSensorsData").mockResolvedValue([
      buildSensor(),
    ]);

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);
    const device = result[0];

    expect(device).toMatchObject({
      id: "neb-001",
      name: "NebuleAir neb-001",
      latitude: 43.2965,
      longitude: 5.3698,
      source: "nebuleair",
      pollutant: "pm25",
      value: 12.4,
      unit: "µg/m³",
      status: "active",
      qualityLevel: "moyen",
    });
  });

  it("crée un device inactif quand la donnée est obsolète ou absente", async () => {
    vi.spyOn(service as any, "fetchSensorsData").mockResolvedValue([
      buildSensor({
        sensorId: "neb-old",
        time: "2020-01-01T00:00:00Z",
        PM25_qh: null,
      }),
    ]);

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "neb-old",
      status: "inactive",
      value: 0,
      qualityLevel: "default",
    });
  });
});








