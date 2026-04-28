import { describe, it, expect, vi, beforeEach } from "vitest";
import { AtmoMicroService } from "../AtmoMicroService";

const baseParams = {
  pollutant: "pm25",
  timeStep: "quartHeure",
  sources: ["atmoMicro"],
};

const buildSite = (overrides = {}) => ({
  id_site: 101,
  nom_site: "Capteur Quartier",
  type_site: "urbain",
  influence: "Résidentiel",
  lon: 5.3698,
  lat: 43.2965,
  code_station_commun: "13",
  date_debut_site: "2024-01-01T00:00:00Z",
  date_fin_site: null,
  variables: "PM2.5, PM10",
  modele_capteur: "SDS011",
  ...overrides,
});

const buildMeasure = (overrides = {}) => ({
  id_site: 101,
  nom_site: "Capteur Quartier",
  lat: 43.297,
  lon: 5.3701,
  time: "2025-02-15T10:15:00Z",
  unite: "µg/m³",
  valeur: 10.5,
  valeur_brute: 14.2,
  valeur_ref: 12.1,
  aggregation: "quart-horaire",
  ...overrides,
});

describe("AtmoMicroService", () => {
  let service: AtmoMicroService;

  beforeEach(() => {
    (AtmoMicroService as any).sitesCache = null;
    (AtmoMicroService as any).lastSitesFetch = 0;
    (AtmoMicroService as any).sitesFetchPromise = null;
    service = new AtmoMicroService();
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
      timeStep: "jour",
    });

    expect(result).toEqual([]);
    expect(makeRequestSpy).not.toHaveBeenCalled();
  });

  it("transforme sites et mesures en appareils de mesure enrichis", async () => {
    const sitesResponse = [buildSite()];
    const measuresResponse = [buildMeasure()];

    const makeRequestSpy = vi
      .spyOn(service as any, "makeRequest")
      .mockResolvedValueOnce(sitesResponse) // fetchSites
      .mockResolvedValueOnce(measuresResponse); // fetchMeasures

    const result = await service.fetchData(baseParams);

    expect(makeRequestSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);

    const device = result[0];
    expect(device).toMatchObject({
      id: "101",
      name: "Capteur Quartier",
      latitude: 43.297,
      longitude: 5.3701,
      source: "atmoMicro",
      pollutant: "pm25",
      value: 12.1, // valeur_ref utilisée pour quart-horaire
      unit: "µg/m³",
      status: "active",
      address: "Capteur Quartier, Résidentiel",
      departmentId: "13",
      has_correction: true,
      corrected_value: 10.5,
      raw_value: 14.2,
    });
    expect(device).toHaveProperty("qualityLevel", "moyen");
    expect(service.isMeasuresUnavailableIncident()).toBe(false);
  });

  it("ajoute un device inactif lorsque le site n'a pas de mesure", async () => {
    const sitesResponse = [buildSite(), buildSite({ id_site: 202, nom_site: "Site Sans Mesure" })];
    const measuresResponse = [buildMeasure()];

    vi.spyOn(service as any, "makeRequest")
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(measuresResponse);

    const result = await service.fetchData(baseParams);

    const inactiveDevice = result.find((device) => device.id === "202");
    expect(inactiveDevice).toBeTruthy();
    expect(inactiveDevice).toMatchObject({
      id: "202",
      name: "Site Sans Mesure",
      status: "inactive",
      value: 0,
      qualityLevel: "default",
    });
  });

  it("garde les sites en inactif et active l'incident quand mesures/dernieres renvoie 204 (null)", async () => {
    vi.spyOn(service as any, "makeRequest")
      .mockResolvedValueOnce([buildSite()])
      .mockResolvedValueOnce(null);

    const result = await service.fetchData(baseParams);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "101",
      status: "inactive",
      value: 0,
      qualityLevel: "default",
    });
    expect(service.isMeasuresUnavailableIncident()).toBe(true);
  });

  it("garde les sites en inactif et active l'incident quand mesures/dernieres renvoie un tableau vide", async () => {
    vi.spyOn(service as any, "makeRequest")
      .mockResolvedValueOnce([buildSite()])
      .mockResolvedValueOnce([]);

    const result = await service.fetchData(baseParams);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "101",
      status: "inactive",
      value: 0,
      qualityLevel: "default",
    });
    expect(service.isMeasuresUnavailableIncident()).toBe(true);
  });
});








