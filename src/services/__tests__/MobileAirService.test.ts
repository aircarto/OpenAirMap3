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

  describe("ensureSensorsLoaded", () => {
    it("charge le catalogue même pour un polluant non supporté", async () => {
      // fetchData() sort avant fetchSensors() si le polluant n'est pas supporté,
      // ce qui laissait l'interface de sélection vide sans erreur ni explication.
      const makeRequest = vi
        .spyOn(service as any, "makeRequest")
        .mockResolvedValue([buildSensor()]);

      const sensors = await service.ensureSensorsLoaded();

      expect(makeRequest).toHaveBeenCalledTimes(1);
      expect(sensors).toHaveLength(1);
      expect(service.getSensors()).toHaveLength(1);
    });

    it("ne recharge pas un catalogue déjà présent", async () => {
      (service as any).sensors = [buildSensor()];
      const makeRequest = vi.spyOn(service as any, "makeRequest");

      await service.ensureSensorsLoaded();

      expect(makeRequest).not.toHaveBeenCalled();
    });

    it("déduplique les appels concurrents", async () => {
      // Un menu qui s'ouvre peut déclencher plusieurs appels dans le même tick.
      const makeRequest = vi
        .spyOn(service as any, "makeRequest")
        .mockResolvedValue([buildSensor()]);

      const [a, b, c] = await Promise.all([
        service.ensureSensorsLoaded(),
        service.ensureSensorsLoaded(),
        service.ensureSensorsLoaded(),
      ]);

      expect(makeRequest).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
      expect(b).toBe(c);
    });

    it("réessaie après un échec au lieu de rester bloqué", async () => {
      const makeRequest = vi
        .spyOn(service as any, "makeRequest")
        .mockRejectedValueOnce(new Error("réseau"))
        .mockResolvedValueOnce([buildSensor()]);

      await expect(service.ensureSensorsLoaded()).rejects.toThrow();
      // La promesse en vol doit avoir été relâchée, sinon toute tentative
      // ultérieure renverrait l'échec initial pour toujours.
      await expect(service.ensureSensorsLoaded()).resolves.toHaveLength(1);
      expect(makeRequest).toHaveBeenCalledTimes(2);
    });

    it("clearRoutes ne vide pas le catalogue de capteurs", async () => {
      // Le menu lit le catalogue sur le MÊME singleton que celui dont
      // handleMobileAirSensorsSelected nettoie les parcours.
      (service as any).sensors = [buildSensor()];
      (service as any).routes = [{ sensorId: "mob-001", points: [] }];

      service.clearRoutes();

      expect(service.getRoutes()).toEqual([]);
      expect(service.getSensors()).toHaveLength(1);
    });
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

  it("récupère plusieurs capteurs en parallèle", async () => {
    (service as any).sensors = [
      buildSensor({ sensorId: "mob-001", sensorToken: "token-001" }),
      buildSensor({ sensorId: "mob-002", sensorToken: "token-002" }),
    ];

    const makeRequestSpy = vi
      .spyOn(service as any, "makeRequest")
      .mockImplementation(async (url: string) => {
        if (url.includes("token-001")) {
          return [buildDataPoint({ sensorId: "mob-001", sessionId: 1 })];
        }
        if (url.includes("token-002")) {
          return [
            buildDataPoint({
              sensorId: "mob-002",
              sessionId: 2,
              time: "2025-02-15T12:00:00Z",
            }),
          ];
        }
        return [];
      });

    const result = await service.fetchData({
      ...baseParams,
      selectedSensors: ["mob-001", "mob-002"],
    });

    expect(makeRequestSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(service.getRoutes()).toHaveLength(2);
  });

  it("applique une période par capteur", async () => {
    (service as any).sensors = [
      buildSensor({ sensorId: "mob-001", sensorToken: "token-001" }),
      buildSensor({ sensorId: "mob-002", sensorToken: "token-002" }),
    ];

    const makeRequestSpy = vi
      .spyOn(service as any, "makeRequest")
      .mockResolvedValue([buildDataPoint()]);

    await service.fetchData({
      ...baseParams,
      selectedSensors: ["mob-001", "mob-002"],
      mobileAirPeriod: { startDate: "2025-01-01", endDate: "2025-01-07" },
      mobileAirPeriods: {
        "mob-002": { startDate: "2025-02-01", endDate: "2025-02-14" },
      },
    });

    const urls = makeRequestSpy.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("start=2025-01-01"))).toBe(true);
    expect(urls.some((url) => url.includes("start=2025-02-01"))).toBe(true);
  });

  it("refetch partiel conserve les routes des autres capteurs", async () => {
    (service as any).sensors = [
      buildSensor({ sensorId: "mob-001", sensorToken: "token-001" }),
      buildSensor({ sensorId: "mob-002", sensorToken: "token-002" }),
    ];

    vi.spyOn(service as any, "makeRequest").mockImplementation(
      async (url: string) => {
        if (url.includes("token-001")) {
          return [buildDataPoint({ sensorId: "mob-001", sessionId: 1 })];
        }
        return [
          buildDataPoint({
            sensorId: "mob-002",
            sessionId: 2,
            time: "2025-02-15T12:00:00Z",
            PM25: 20,
          }),
        ];
      }
    );

    await service.fetchData({
      ...baseParams,
      selectedSensors: ["mob-001", "mob-002"],
    });
    expect(service.getRoutes()).toHaveLength(2);

    vi.spyOn(service as any, "makeRequest").mockResolvedValue([
      buildDataPoint({
        sensorId: "mob-002",
        sessionId: 99,
        time: "2025-03-01T10:00:00Z",
        PM25: 30,
      }),
    ]);

    const partial = await service.fetchData({
      ...baseParams,
      selectedSensors: ["mob-002"],
      mobileAirPartialReplace: true,
    });

    expect(partial).toHaveLength(1);
    const routes = service.getRoutes();
    expect(routes.some((r) => r.sensorId === "mob-001")).toBe(true);
    expect(routes.filter((r) => r.sensorId === "mob-002")).toHaveLength(1);
    expect(routes.find((r) => r.sensorId === "mob-002")?.sessionId).toBe(99);
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

  it("propage moving=4 sur la route (mesure fixe)", async () => {
    (service as any).sensors = [buildSensor()];
    vi.spyOn(service as any, "makeRequest").mockResolvedValue([
      buildDataPoint({ moving: 4, sessionId: 7 }),
      buildDataPoint({
        moving: 4,
        sessionId: 7,
        time: "2025-02-15T10:01:00Z",
      }),
    ]);

    const result = await service.fetchData({
      ...baseParams,
      selectedSensors: ["mob-001"],
    });

    expect(result).toHaveLength(1);
    const route = (result[0] as any).mobileAirRoute;
    expect(route.moving).toBe(4);
    expect(route.sessionId).toBe(7);
  });

  it("filtre les live sans GPS (fixed null / points vides)", async () => {
    vi.spyOn(service as any, "makeRequest").mockResolvedValue([
      {
        id: 1,
        sensorId: "mobileair-001",
        sensorToken: "AAA",
        lastSeen: "2026-09-24T13:00:00Z",
        lastSeenSec: 10,
        fixed: null,
        sessionId: 1,
        moving: 0,
        points: [],
      },
      {
        id: 2,
        sensorId: "mobileair-002",
        sensorToken: "BBB",
        lastSeen: "2026-09-24T13:01:00Z",
        lastSeenSec: 5,
        fixed: true,
        sessionId: 2,
        moving: 4,
        points: [
          buildDataPoint({
            sensorId: "mobileair-002",
            sessionId: 2,
            moving: 4,
            lat: 43.3,
            lon: 5.4,
          }),
        ],
      },
    ]);

    const live = await service.fetchLiveSensors("5m");
    expect(live).toHaveLength(1);
    expect(live[0].sensorId).toBe("mobileair-002");

    const devices = service.createLiveDevices(live, "pm25");
    expect(devices).toHaveLength(1);
    expect(devices[0].source).toBe("mobileair-live");
    expect(devices[0].latitude).toBe(43.3);
  });

  it("fetchContext appelle get_context avec capteur_id", async () => {
    const spy = vi
      .spyOn(service as any, "makeRequest")
      .mockResolvedValue([{ id: 1, context_type: "fire" }]);

    const rows = await service.fetchContext("mobileair-012", {
      startDate: "2026-09-01T00:00:00.123Z",
      endDate: "2026-09-02T00:00:00.456Z",
    });

    expect(rows).toHaveLength(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("/context/get_context");
    expect(url).toContain("capteur_id=mobileair-012");
    // Pas de millisecondes : l’API renvoie 400 sinon
    expect(url).toContain("start=2026-09-01T00%3A00%3A00Z");
    expect(url).toContain("end=2026-09-02T00%3A00%3A00Z");
    expect(url).not.toMatch(/\.000Z|\.\d{3}Z/);
  });
});

