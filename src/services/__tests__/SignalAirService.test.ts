import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignalAirService } from "../SignalAirService";

const buildFeature = (overrides: Partial<Record<string, any>> = {}) => ({
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [5.3698, 43.2965],
  },
  properties: {
    id: "sig-001",
    type: "odeur",
    created_at: "2025-02-15T10:00:00Z",
    "duree-de-la-nuisance": "1h",
    "avez-vous-des-symptomes-": "Oui",
    "si-oui-quels-symptomes-": "maux de tête",
    description: "odeur forte",
    address: "Marseille",
    department: "13",
    ...overrides,
  },
});

const buildGeoJson = (features = [buildFeature()]) => ({
  type: "FeatureCollection",
  features,
});

describe("SignalAirService", () => {
  let service: SignalAirService;

  beforeEach(() => {
    service = new SignalAirService();
    vi.spyOn(service as any, "fetchSignalAirData");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne un cache si la période n'a pas changé", async () => {
    (service as any).fetchSignalAirData.mockImplementation(
      async (type: string) => {
        if (type === "odeur") {
          return buildGeoJson([buildFeature({ id: "sig-001" })]);
        }
        return buildGeoJson([]);
      },
    );

    const period = { startDate: "2025-02-01", endDate: "2025-02-02" };
    const firstCall = await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirPeriod: period,
    });

    expect(firstCall).toHaveLength(1);
    expect((service as any).fetchSignalAirData).toHaveBeenCalledTimes(4); // 4 types par défaut

    (service as any).fetchSignalAirData.mockClear();
    const secondCall = await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirPeriod: period,
    });

    expect(secondCall).toEqual(firstCall);
    expect((service as any).fetchSignalAirData).not.toHaveBeenCalled();
  });

  it("rafraîchit les données quand la période change", async () => {
    (service as any).fetchSignalAirData.mockResolvedValue(buildGeoJson());

    await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirPeriod: { startDate: "2025-02-01", endDate: "2025-02-02" },
    });

    (service as any).fetchSignalAirData.mockClear();

    await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirPeriod: { startDate: "2025-02-03", endDate: "2025-02-04" },
    });

    expect((service as any).fetchSignalAirData).toHaveBeenCalled();
  });

  it("filtre les types de signalements selon la sélection", async () => {
    (service as any).fetchSignalAirData.mockImplementation(
      async (type: string) => {
        if (type === "odeur") {
          return buildGeoJson([buildFeature({ id: "sig-odeur" })]);
        }
        if (type === "visuel") {
          return buildGeoJson([buildFeature({ id: "sig-visuel", type: "visuel" })]);
        }
        return buildGeoJson([]);
      },
    );

    const reports = await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirSelectedTypes: ["odeur", "visuel"],
      signalAirPeriod: { startDate: "2025-02-01", endDate: "2025-02-02" },
    });

    expect(reports).toHaveLength(2);
    expect(reports.map((r) => r.signalType).sort()).toEqual(["odeur", "visuel"]);
  });

  it("ignore les types non supportés", async () => {
    (service as any).fetchSignalAirData.mockResolvedValue(buildGeoJson());

    const reports = await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirSelectedTypes: ["odeur", "inconnu"],
      signalAirPeriod: { startDate: "2025-02-01", endDate: "2025-02-02" },
    });

    expect((service as any).fetchSignalAirData).toHaveBeenCalledTimes(1);
    expect(reports).toHaveLength(1);
  });

  it("transforme le GeoJSON en SignalAirReport complet", async () => {
    (service as any).fetchSignalAirData.mockResolvedValue(
      buildGeoJson([
        buildFeature({
          id: "sig-002",
          type: "bruit",
          description: "nuisance sonore",
        }),
      ]),
    );

    const reports = await service.fetchData({
      pollutant: "pm25",
      timeStep: "heure",
      sources: ["signalair"],
      signalAirSelectedTypes: ["bruit"],
      signalAirPeriod: { startDate: "2025-02-01", endDate: "2025-02-02" },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      id: "sig-002",
      name: "Signalement bruit",
      latitude: 43.2965,
      longitude: 5.3698,
      signalType: "bruit",
      signalDescription: "nuisance sonore",
    });
  });
});

