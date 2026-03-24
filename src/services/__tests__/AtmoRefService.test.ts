import { describe, it, expect, vi, beforeEach } from "vitest";
import { AtmoRefService } from "../AtmoRefService";

const baseParams = {
  pollutant: "pm25",
  timeStep: "heure",
  sources: ["atmoRef"],
};

const buildStation = (overrides = {}) => ({
  id_station: "FR001",
  nom_station: "Station Marseille",
  departement_id: "13",
  adresse: "Marseille",
  latitude: 43.2965,
  longitude: 5.3698,
  en_service: true,
  date_debut_mesure: "2020-01-01T00:00:00Z",
  date_fin_mesure: null,
  variables: {
    "39": {
      label: "Particules en suspension <2.5 µm (masses) (PM2.5)",
      code_iso: "PM2.5",
      en_service: true,
    },
  },
  ...overrides,
});

const buildMeasure = (overrides = {}) => ({
  id_station: "FR001",
  nom_station: "Station Marseille",
  valeur: 12.5,
  unite: "µg/m³",
  date_debut: "2025-02-15T10:00:00Z",
  temporalite: "horaire",
  label_polluant: "Particules en suspension <2.5 µm (masses) (PM2.5)",
  validation: "validée",
  ...overrides,
});

describe("AtmoRefService", () => {
  let service: AtmoRefService;

  beforeEach(() => {
    // Reinitialiser le cache statique pour isoler les tests.
    (AtmoRefService as any).stationsCache = null;
    (AtmoRefService as any).lastStationsFetch = 0;
    (AtmoRefService as any).stationsFetchPromise = null;
    service = new AtmoRefService();
  });

  it("retourne un tableau vide pour un polluant non supporté", async () => {
    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      ...baseParams,
      pollutant: "h2s",
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide pour un pas de temps non supporté", async () => {
    const makeRequestSpy = vi.spyOn(service as any, "makeRequest");

    const result = await service.fetchData({
      ...baseParams,
      timeStep: "deuxMin",
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("transforme les stations et mesures en MeasurementDevice", async () => {
    const stationsResponse = {
      stations: [buildStation()],
    };
    const measuresResponse = {
      mesures: [buildMeasure()],
    };

    const makeRequestSpy = vi
      .spyOn(service as any, "makeRequest")
      .mockResolvedValueOnce(stationsResponse)
      .mockResolvedValueOnce(measuresResponse);

    const result = await service.fetchData(baseParams);

    expect(makeRequestSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);

    const device = result[0];
    expect(device).toMatchObject({
      id: "FR001",
      name: "Station Marseille",
      latitude: 43.2965,
      longitude: 5.3698,
      source: "atmoRef",
      pollutant: "pm25",
      value: 12.5,
      unit: "µg/m³",
      status: "active",
      address: "Marseille",
      departmentId: "13",
    });
    expect(device).toHaveProperty("qualityLevel", "moyen");
  });

  it("marque la station comme inactive quand aucune mesure n'est disponible", async () => {
    const stationsResponse = {
      stations: [buildStation()],
    };
    const measuresResponse = {
      mesures: [],
    };

    vi.spyOn(service as any, "makeRequest")
      .mockResolvedValueOnce(stationsResponse)
      .mockResolvedValueOnce(measuresResponse);

    const result = await service.fetchData(baseParams);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "FR001",
      status: "inactive",
      value: 0,
      qualityLevel: "default",
    });
  });
});

