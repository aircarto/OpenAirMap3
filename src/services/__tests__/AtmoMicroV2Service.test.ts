import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AtmoMicroV2Service } from "../AtmoMicroV2Service";

const baseParams = {
  pollutant: "pm25",
  timeStep: "quartHeure",
  sources: ["atmoMicro"],
};

const buildDevice = (overrides = {}) => ({
  id: "05C1A382",
  internal_id: 3001,
  name: "Neb-pro104",
  brand: "AirCarto",
  model: "NebuleAir Pro",
  variables: [
    { variable_iso_code: "24", variable_name: "PM 10", scan_interval: null },
    { variable_iso_code: "39", variable_name: "PM 2.5", scan_interval: null },
  ],
  actual_location: "Meyreuil Fauvettes",
  location_id: "103",
  lat: 43.4757,
  lon: 5.4971,
  alt: null,
  ...overrides,
});

const buildLocation = (overrides = {}) => ({
  id: "103",
  name: "Meyreuil Fauvettes",
  typology: "Périurbaine",
  influence: "Fond",
  lat: 43.4757,
  lon: 5.4971,
  alt: null,
  start_date: "2026-02-06T15:36:37+00:00",
  end_date: null,
  campaigns: [],
  ...overrides,
});

const buildObservation = (overrides = {}) => ({
  id: "05C1A382",
  name: "Neb-pro104",
  location_id: "103",
  location_name: "Meyreuil Fauvettes",
  variable_iso_code: "39",
  variable_name: "PM 2.5",
  time: "2026-09-03T07:45:00+00:00",
  lat: 43.475,
  lon: 5.497,
  value: 10.5,
  value_ref: 12.1,
  value_raw: 14.2,
  unit: "µg/m3",
  ...overrides,
});

/** Signature de la méthode protégée que les tests interceptent. */
type RequestingService = { makeRequest: (url: string) => Promise<unknown> };

/**
 * Route les appels selon l'URL plutôt que selon leur ordre.
 *
 * Le service lance ses trois requêtes en Promise.all : un mock séquentiel
 * (mockResolvedValueOnce) coupleraient les tests à l'ordre d'évaluation.
 */
const mockRoutes = (
  service: AtmoMicroV2Service,
  routes: {
    observations?: unknown | (() => unknown);
    devices?: unknown | (() => unknown);
    locations?: unknown | (() => unknown);
  }
) => {
  const resolve = (value: unknown) =>
    typeof value === "function" ? (value as () => unknown)() : value;

  return vi
    .spyOn(service as unknown as RequestingService, "makeRequest")
    .mockImplementation((...args: unknown[]) => {
      const url = String(args[0]);

      if (url.includes("/lists/devices")) {
        return Promise.resolve(resolve(routes.devices ?? []));
      }
      if (url.includes("/lists/locations")) {
        return Promise.resolve(resolve(routes.locations ?? []));
      }
      if (url.includes("/observations")) {
        return Promise.resolve(resolve(routes.observations ?? []));
      }

      throw new Error(`URL non mockée: ${url}`);
    });
};

/** Collecte les URLs passées à makeRequest, pour inspecter les paramètres. */
const requestedUrls = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls.map((call) => String(call[0]));

describe("AtmoMicroV2Service", () => {
  let service: AtmoMicroV2Service;

  beforeEach(() => {
    AtmoMicroV2Service.resetCaches();
    service = new AtmoMicroV2Service();
    // Les logs de capteurs écartés sont volontairement bavards : on les tait
    // ici, tout en pouvant vérifier qu'ils ont bien été émis.
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("garde-fous d'entrée", () => {
    it("retourne un tableau vide pour un polluant non supporté", async () => {
      const spy = mockRoutes(service, {});

      const result = await service.fetchData({
        ...baseParams,
        pollutant: "h2s",
      });

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("retourne un tableau vide pour un pas de temps non supporté", async () => {
      const spy = mockRoutes(service, {});

      const result = await service.fetchData({
        ...baseParams,
        timeStep: "jour",
      });

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("correspondances polluant et agrégation", () => {
    it.each([
      ["pm25", "39"],
      ["pm10", "24"],
      ["pm1", "68"],
      ["no2", "03"],
      ["o3", "08"],
      ["so2", "01"],
    ])("traduit %s en code ISO %s", async (pollutant, isoCode) => {
      const spy = mockRoutes(service, {});

      await service.fetchData({ ...baseParams, pollutant });

      const observationUrl = requestedUrls(spy).find((url) =>
        url.includes("/observations/latest")
      );
      expect(observationUrl).toContain(`variable=${isoCode}`);
    });

    it.each([
      ["instantane", "scan", 181],
      ["deuxMin", "scan", 3],
      ["quartHeure", "quarter-hourly", 19],
      ["heure", "hourly", 64],
    ])(
      "traduit le pas de temps %s en agrégation %s (delay=%i)",
      async (timeStep, aggregation, delay) => {
        const spy = mockRoutes(service, {});

        await service.fetchData({ ...baseParams, timeStep });

        const observationUrl = requestedUrls(spy).find((url) =>
          url.includes("/observations/latest")
        );
        expect(observationUrl).toContain(`aggregation=${aggregation}`);
        expect(observationUrl).toContain(`delay=${delay}`);
      }
    );

    it("demande toujours la limite maximale et les valeurs brutes", async () => {
      const spy = mockRoutes(service, {});

      await service.fetchData(baseParams);

      const observationUrl = requestedUrls(spy).find((url) =>
        url.includes("/observations/latest")
      );
      // Le défaut de l'API est 500 et tronque en silence.
      expect(observationUrl).toContain("limit=500000");
      // Sans raw_value, la détection de correction est impossible.
      expect(observationUrl).toContain("include=raw_value,device_model");
      expect(observationUrl).toContain("decimals=1");
    });
  });

  describe("construction des marqueurs", () => {
    it("transforme une observation en appareil de mesure enrichi", async () => {
      mockRoutes(service, {
        observations: [buildObservation()],
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "05C1A382",
        name: "Meyreuil Fauvettes",
        latitude: 43.475,
        longitude: 5.497,
        source: "atmoMicro",
        pollutant: "pm25",
        // value_ref : la meilleure valeur disponible, plus de cascade
        value: 12.1,
        unit: "µg/m3",
        timestamp: "2026-09-03T07:45:00+00:00",
        status: "active",
        qualityLevel: "moyen",
        address: "Meyreuil Fauvettes, Fond",
        has_correction: true,
        corrected_value: 10.5,
        raw_value: 14.2,
      });
      // code_station_commun n'a pas d'équivalent côté microspot
      expect(result[0].departmentId).toBe("");
      expect(service.isMeasuresUnavailableIncident()).toBe(false);
    });

    it("utilise l'identifiant capteur, pas le site — deux capteurs sur un même site donnent deux marqueurs", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({ id: "CAPTEUR_A", value_ref: 8 }),
          buildObservation({ id: "CAPTEUR_B", value_ref: 20 }),
        ],
        devices: [
          buildDevice({ id: "CAPTEUR_A" }),
          buildDevice({ id: "CAPTEUR_B" }),
        ],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result.map((device) => device.id).sort()).toEqual([
        "CAPTEUR_A",
        "CAPTEUR_B",
      ]);
      // La dispersion entre capteurs co-localisés reste visible
      expect(result.map((device) => device.value).sort((a, b) => a - b)).toEqual(
        [8, 20]
      );
    });

    it("ajoute un marqueur inactif pour un capteur sans mesure récente", async () => {
      mockRoutes(service, {
        observations: [buildObservation()],
        devices: [
          buildDevice(),
          buildDevice({
            id: "SANS_MESURE",
            name: "Neb-999",
            actual_location: "Site Sans Mesure",
            location_id: "999",
          }),
        ],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      const inactive = result.find((device) => device.id === "SANS_MESURE");
      expect(inactive).toMatchObject({
        id: "SANS_MESURE",
        name: "Site Sans Mesure",
        status: "inactive",
        value: 0,
        qualityLevel: "default",
      });
    });

    it("ne garde que les capteurs mesurant la variable demandée", async () => {
      mockRoutes(service, {
        observations: [],
        devices: [
          buildDevice({ id: "MESURE_PM25" }),
          buildDevice({
            id: "SANS_PM25",
            location_id: "500",
            variables: [
              {
                variable_iso_code: "03",
                variable_name: "Dioxyde d'azote (NO2)",
                scan_interval: null,
              },
            ],
          }),
          buildDevice({ id: "SANS_VARIABLES", location_id: "501", variables: [] }),
        ],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result.map((device) => device.id)).toEqual(["MESURE_PM25"]);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[AtmoMicro][EXCLUDED] id=SANS_PM25")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[AtmoMicro][EXCLUDED] id=SANS_VARIABLES")
      );
    });
  });

  describe("règle de nom affichable", () => {
    it("préfère location_name quand il est renseigné et que name est null", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({
            name: null,
            location_name: "Marseille_7_avenue_Andre_Roussin",
          }),
        ],
        devices: [buildDevice()],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0].name).toBe("Marseille_7_avenue_Andre_Roussin");
    });

    it("retombe sur name quand location_name est le placeholder 'auto created for device'", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({
            name: "Neb-139",
            location_name: "auto created for device 103F66F9D108",
          }),
        ],
        devices: [buildDevice()],
      });

      const result = await service.fetchData(baseParams);
      // Le placeholder interne de l'API ne doit jamais atteindre l'UI
      expect(result[0].name).toBe("Neb-139");
    });

    it("retombe sur l'identifiant quand ni name ni location_name ne sont exploitables", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({ id: "ORPHELIN", name: null, location_name: null }),
        ],
        devices: [buildDevice()],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0].name).toBe("ORPHELIN");
    });
  });

  describe("détection de correction", () => {
    it("marque has_correction quand value est renseignée", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({ value: 10.5, value_raw: 14.2, value_ref: 10.5 }),
        ],
        devices: [buildDevice()],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0]).toMatchObject({
        has_correction: true,
        corrected_value: 10.5,
        raw_value: 14.2,
      });
    });

    it("ne marque PAS has_correction quand value est null malgré un value_raw présent", async () => {
      // Le faux positif de l'ancien service : `undefined !== null` rendait la
      // comparaison toujours vraie dès que valeur_brute n'était pas demandé.
      mockRoutes(service, {
        observations: [
          buildObservation({ value: null, value_raw: 9.4, value_ref: 9.4 }),
        ],
        devices: [buildDevice()],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0]).toMatchObject({
        has_correction: false,
        corrected_value: undefined,
        raw_value: 9.4,
        value: 9.4, // value_ref retombe sur la brute
      });
    });
  });

  describe("capteurs non plaçables", () => {
    it("écarte les capteurs sans location_id, avec une raison journalisée", async () => {
      mockRoutes(service, {
        observations: [],
        devices: [buildDevice({ id: "SANS_SITE", location_id: null })],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toEqual([]);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "[AtmoMicro][POST_FILTER_EXCLUDED] id=SANS_SITE"
        )
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("capteur sans location_id")
      );
    });

    it("écarte les capteurs aux coordonnées nulles", async () => {
      mockRoutes(service, {
        observations: [],
        devices: [buildDevice({ id: "SANS_COORD", lat: null, lon: null })],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toEqual([]);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("coordonnees invalides dans lists/devices")
      );
    });

    it("écarte une observation aux coordonnées hors bornes, sans la rétrograder en marqueur gris", async () => {
      // Le capteur mesure : l'afficher « inactif » affirmerait le contraire.
      // Faute de position exploitable, il n'est pas affiché du tout.
      mockRoutes(service, {
        observations: [buildObservation({ lat: 999, lon: 5.497 })],
        devices: [buildDevice()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toEqual([]);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("coordonnees invalides dans observations/latest")
      );
    });
  });

  describe("jointure influence", () => {
    it("compose l'adresse avec influence quand le site est connu", async () => {
      mockRoutes(service, {
        observations: [buildObservation()],
        devices: [buildDevice()],
        locations: [buildLocation({ influence: "Trafic" })],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0].address).toBe("Meyreuil Fauvettes, Trafic");
    });

    it("se limite au nom quand le site est absent de /lists/locations", async () => {
      // Cas fréquent : la route ne couvre qu'une partie des location_id.
      mockRoutes(service, {
        observations: [buildObservation()],
        devices: [buildDevice()],
        locations: [],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0].address).toBe("Meyreuil Fauvettes");
    });

    it("se limite au nom quand influence est nulle", async () => {
      mockRoutes(service, {
        observations: [buildObservation()],
        devices: [buildDevice()],
        locations: [buildLocation({ influence: null })],
      });

      const result = await service.fetchData(baseParams);
      expect(result[0].address).toBe("Meyreuil Fauvettes");
    });

    it("garde les marqueurs si /lists/locations échoue", async () => {
      mockRoutes(service, {
        observations: [buildObservation()],
        devices: [buildDevice()],
        locations: () => Promise.reject(new Error("HTTP error! status: 503")),
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("Meyreuil Fauvettes");
    });
  });

  describe("réponse vide et incidents", () => {
    it("traite un 204 (null) comme une réponse valide, SANS incident", async () => {
      mockRoutes(service, {
        observations: null,
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ status: "inactive", value: 0 });
      // Changement de comportement assumé : « aucune donnée » n'est pas une panne.
      expect(service.isMeasuresUnavailableIncident()).toBe(false);
    });

    it("traite un tableau vide comme une réponse valide, SANS incident", async () => {
      mockRoutes(service, {
        observations: [],
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ status: "inactive" });
      expect(service.isMeasuresUnavailableIncident()).toBe(false);
    });

    it("lève l'incident sur une erreur HTTP, en gardant les capteurs en inactif", async () => {
      mockRoutes(service, {
        observations: () => Promise.reject(new Error("HTTP error! status: 503")),
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        status: "inactive",
        value: 0,
        qualityLevel: "default",
      });
      expect(service.isMeasuresUnavailableIncident()).toBe(true);
    });

    it("lève l'incident sur un format de réponse inattendu", async () => {
      mockRoutes(service, {
        observations: { unexpected: "shape" },
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(service.isMeasuresUnavailableIncident()).toBe(true);
    });

    it("avertit quand une réponse atteint la limite demandée", () => {
      // Les en-têtes X-Truncated ne sont pas exposés par CORS : la détection se
      // fait sur le nombre de lignes. Le garde-fou est exercé directement plutôt
      // que par un jeu factice, la limite étant désormais de 500 000 lignes.
      const warnIfTruncated = (
        service as unknown as {
          warnIfTruncated: (n: number, limit: number, ctx: string) => boolean;
        }
      ).warnIfTruncated.bind(service);

      expect(warnIfTruncated(500000, 500000, "observations")).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("réponse probablement tronquée")
      );
    });

    it("reste silencieux quand la réponse tient sous la limite", () => {
      const warnIfTruncated = (
        service as unknown as {
          warnIfTruncated: (n: number, limit: number, ctx: string) => boolean;
        }
      ).warnIfTruncated.bind(service);

      expect(warnIfTruncated(499999, 500000, "observations")).toBe(false);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("propage l'échec de parsing d'une réponse coupée en cours de transfert", async () => {
      // Au-delà d'une vingtaine de mégaoctets, le serveur répond 200 puis
      // interrompt le flux : le corps JSON est invalide. Cela doit se traduire
      // par un incident, pas par une carte silencieusement vide.
      mockRoutes(service, {
        observations: () =>
          Promise.reject(new SyntaxError("Unexpected end of JSON input")),
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      const result = await service.fetchData(baseParams);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ status: "inactive" });
      expect(service.isMeasuresUnavailableIncident()).toBe(true);
    });
  });

  describe("caches de référentiels", () => {
    it("ne récupère les référentiels qu'une fois pour deux appels", async () => {
      const spy = mockRoutes(service, {
        observations: [buildObservation()],
        devices: [buildDevice()],
        locations: [buildLocation()],
      });

      await service.fetchData(baseParams);
      await service.fetchData(baseParams);

      const urls = requestedUrls(spy);
      expect(urls.filter((url) => url.includes("/lists/devices"))).toHaveLength(1);
      expect(urls.filter((url) => url.includes("/lists/locations"))).toHaveLength(1);
      // Les observations, elles, sont rappelées à chaque fois
      expect(
        urls.filter((url) => url.includes("/observations/latest"))
      ).toHaveLength(2);
    });

    it("partage le cache entre instances, et resetCaches le vide", async () => {
      const firstSpy = mockRoutes(service, { devices: [buildDevice()] });
      await service.fetchData(baseParams);
      expect(
        requestedUrls(firstSpy).filter((url) => url.includes("/lists/devices"))
      ).toHaveLength(1);

      const otherInstance = new AtmoMicroV2Service();
      const secondSpy = mockRoutes(otherInstance, { devices: [buildDevice()] });
      await otherInstance.fetchData(baseParams);
      expect(
        requestedUrls(secondSpy).filter((url) => url.includes("/lists/devices"))
      ).toHaveLength(0);

      AtmoMicroV2Service.resetCaches();
      await otherInstance.fetchData(baseParams);
      expect(
        requestedUrls(secondSpy).filter((url) => url.includes("/lists/devices"))
      ).toHaveLength(1);
    });
  });

  describe("fetchSiteVariables", () => {
    it("mappe les codes ISO vers les polluants internes et remonte le modèle", async () => {
      mockRoutes(service, {
        devices: [
          buildDevice({
            variables: [
              { variable_iso_code: "24", variable_name: "PM 10", scan_interval: null },
              { variable_iso_code: "39", variable_name: "PM 2.5", scan_interval: null },
              { variable_iso_code: "03", variable_name: "NO2", scan_interval: null },
            ],
          }),
        ],
      });

      const result = await service.fetchSiteVariables("05C1A382");

      expect(Object.keys(result.variables).sort()).toEqual([
        "no2",
        "pm10",
        "pm25",
      ]);
      expect(result.variables.pm25).toMatchObject({
        code_iso: "39",
        en_service: true,
      });
      expect(result.sensorModel).toBe("NebuleAir Pro");
    });

    it("retourne un objet vide pour un capteur inconnu", async () => {
      mockRoutes(service, { devices: [buildDevice()] });

      const result = await service.fetchSiteVariables("INEXISTANT");

      expect(result).toEqual({ variables: {} });
    });

    it("n'émet aucune requête supplémentaire (lecture du cache)", async () => {
      const spy = mockRoutes(service, { devices: [buildDevice()] });

      await service.fetchSiteVariables("05C1A382");
      await service.fetchSiteVariables("05C1A382");

      expect(
        requestedUrls(spy).filter((url) => url.includes("/lists/devices"))
      ).toHaveLength(1);
    });
  });

  describe("fetchSensorTimeStep", () => {
    it("lit scan_interval depuis include=metadata des observations", async () => {
      const spy = mockRoutes(service, {
        observations: [buildObservation({ scan_interval: 60 })],
      });

      const result = await service.fetchSensorTimeStep("05C1A382", "pm25");

      expect(result).toBe(60);
      const url = requestedUrls(spy)[0];
      // La cadence capteur vient des observations, pas de /lists/devices dont
      // le scan_interval par variable n'est presque jamais renseigné.
      expect(url).toContain("include=metadata");
      expect(url).toContain("aggregation=scan");
      expect(url).toContain("device_id=05C1A382");
    });

    it("retourne null quand aucune mesure n'est disponible", async () => {
      mockRoutes(service, { observations: null });

      const result = await service.fetchSensorTimeStep("05C1A382", "pm25");

      expect(result).toBeNull();
    });

    it("retourne null pour un polluant non supporté, sans requête", async () => {
      const spy = mockRoutes(service, {});

      const result = await service.fetchSensorTimeStep("05C1A382", "h2s");

      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("fetchSiteCoordinates", () => {
    it("privilégie les coordonnées de la dernière observation", async () => {
      mockRoutes(service, {
        observations: [buildObservation({ lat: 43.1, lon: 5.2 })],
        devices: [buildDevice({ lat: 40, lon: 4 })],
      });

      const result = await service.fetchSiteCoordinates("05C1A382");

      expect(result).toEqual({ latitude: 43.1, longitude: 5.2 });
    });

    it("se replie sur le référentiel sans mesure récente", async () => {
      mockRoutes(service, {
        observations: null,
        devices: [buildDevice({ lat: 43.4757, lon: 5.4971 })],
      });

      const result = await service.fetchSiteCoordinates("05C1A382");

      expect(result).toEqual({ latitude: 43.4757, longitude: 5.4971 });
    });

    it("retourne null quand le capteur est introuvable", async () => {
      mockRoutes(service, { observations: null, devices: [] });

      const result = await service.fetchSiteCoordinates("INEXISTANT");

      expect(result).toBeNull();
    });
  });

  describe("fetchHistoricalData", () => {
    it("interroge /observations filtré sur le capteur, avec gapfill", async () => {
      const spy = mockRoutes(service, {
        observations: [buildObservation()],
      });

      const result = await service.fetchHistoricalData({
        siteId: "05C1A382",
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
      });

      const url = requestedUrls(spy)[0];
      expect(url).toContain("device_id=05C1A382");
      expect(url).toContain("aggregation=hourly");
      expect(url).toContain("variable=39");
      expect(url).toContain("gapfill=true");
      expect(url).toContain("include=raw_value");
      expect(url).toContain("limit=500000");

      expect(result[0]).toMatchObject({
        timestamp: "2026-09-03T07:45:00+00:00",
        value: 12.1,
        unit: "µg/m3",
        corrected_value: 10.5,
        raw_value: 14.2,
        has_correction: true,
      });
    });

    it("retourne un tableau vide sur 204", async () => {
      mockRoutes(service, { observations: null });

      const result = await service.fetchHistoricalData({
        siteId: "05C1A382",
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
      });

      expect(result).toEqual([]);
    });

    it("retourne un tableau vide pour un pas de temps non supporté", async () => {
      const spy = mockRoutes(service, {});

      const result = await service.fetchHistoricalData({
        siteId: "05C1A382",
        pollutant: "pm25",
        timeStep: "jour",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
      });

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("fetchTemporalData", () => {
    /** Fenêtre temporelle demandée par une URL d'observations. */
    const chunkWindow = (url: string) => ({
      // `[?&]` évite de capturer le `from_date_time` avec `date_time`.
      from: /from_date_time=([^&]+)/.exec(url)?.[1] ?? "",
      to: /[?&]date_time=([^&]+)/.exec(url)?.[1] ?? "",
    });

    /** Largeur, en jours, de cette fenêtre. */
    const chunkWidthInDays = (url: string): number => {
      const { from, to } = chunkWindow(url);
      return (
        (new Date(to).getTime() - new Date(from).getTime()) /
        (24 * 60 * 60 * 1000)
      );
    };

    it("découpe en tranches de 12 jours maximum en horaire", async () => {
      const spy = mockRoutes(service, { observations: [] });

      await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-08-04",
        endDate: "2026-09-03",
      });

      const urls = requestedUrls(spy).filter((url) =>
        url.includes("/observations?")
      );
      // Une tranche unique de 30 jours dépasserait le plafond de 50 000 lignes
      // de l'API, qui tronquerait en silence.
      expect(urls.length).toBeGreaterThan(1);
      urls.forEach((url) => {
        expect(chunkWidthInDays(url)).toBeLessThanOrEqual(12);
        expect(url).toContain("aggregation=hourly");
        expect(url).toContain("limit=500000");
        expect(url).toContain("include=raw_value");
      });
    });

    it("découpe plus fin en quart-horaire — 3 jours maximum par tranche", async () => {
      const spy = mockRoutes(service, { observations: [] });

      await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "quartHeure",
        startDate: "2026-08-28",
        endDate: "2026-09-03",
      });

      const urls = requestedUrls(spy).filter((url) =>
        url.includes("/observations?")
      );
      expect(urls.length).toBeGreaterThan(1);
      urls.forEach((url) => {
        expect(chunkWidthInDays(url)).toBeLessThanOrEqual(3);
        expect(url).toContain("aggregation=quarter-hourly");
      });
    });

    it("découpe sous la journée en scan, l'agrégation la plus volumineuse", async () => {
      const spy = mockRoutes(service, { observations: [] });

      await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "instantane",
        startDate: "2026-09-01",
        endDate: "2026-09-03",
      });

      const urls = requestedUrls(spy).filter((url) =>
        url.includes("/observations?")
      );
      urls.forEach((url) => {
        expect(chunkWidthInDays(url)).toBeLessThanOrEqual(0.5);
        expect(url).toContain("aggregation=scan");
      });
    });

    it("couvre la période demandée sans trou entre les tranches", async () => {
      const spy = mockRoutes(service, { observations: [] });

      await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-08-04T00:00:00Z",
        endDate: "2026-09-03T00:00:00Z",
      });

      const windows = requestedUrls(spy)
        .filter((url) => url.includes("/observations?"))
        .map(chunkWindow);

      // Chaque tranche reprend exactement là où la précédente s'arrête.
      for (let i = 1; i < windows.length; i++) {
        expect(windows[i].from).toBe(windows[i - 1].to);
      }
      expect(new Date(windows[0].from).toISOString()).toBe(
        "2026-08-04T00:00:00.000Z"
      );
      expect(
        new Date(windows[windows.length - 1].to).toISOString()
      ).toBe("2026-09-03T00:00:00.000Z");
    });

    it("regroupe les observations par horodatage et calcule la moyenne", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({
            id: "A",
            time: "2026-09-01T10:00:00+00:00",
            value_ref: 10,
          }),
          buildObservation({
            id: "B",
            time: "2026-09-01T10:00:00+00:00",
            value_ref: 20,
          }),
          buildObservation({
            id: "A",
            time: "2026-09-01T11:00:00+00:00",
            value_ref: 30,
          }),
        ],
      });

      const result = await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-09-01T00:00:00Z",
        endDate: "2026-09-01T23:00:00Z",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        timestamp: "2026-09-01T10:00:00+00:00",
        deviceCount: 2,
        averageValue: 15,
      });
      expect(result[1]).toMatchObject({
        timestamp: "2026-09-01T11:00:00+00:00",
        deviceCount: 1,
        averageValue: 30,
      });
      // Les points sont triés chronologiquement
      expect(
        new Date(result[0].timestamp).getTime()
      ).toBeLessThan(new Date(result[1].timestamp).getTime());
    });

    it("ignore les observations sans valeur exploitable", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({ id: "A", value_ref: 12 }),
          buildObservation({ id: "B", value_ref: null }),
        ],
      });

      const result = await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-09-01T00:00:00Z",
        endDate: "2026-09-01T12:00:00Z",
      });

      expect(result[0].deviceCount).toBe(1);
      expect(result[0].devices[0].id).toBe("A");
    });

    it("filtre sur les capteurs demandés", async () => {
      mockRoutes(service, {
        observations: [
          buildObservation({ id: "GARDE" }),
          buildObservation({ id: "IGNORE" }),
        ],
      });

      const result = await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-09-01T00:00:00Z",
        endDate: "2026-09-01T12:00:00Z",
        sites: ["GARDE"],
      });

      expect(result[0].devices.map((device) => device.id)).toEqual(["GARDE"]);
    });

    it("poursuit les autres tranches quand l'une échoue, en la journalisant", async () => {
      let call = 0;
      vi.spyOn(service as unknown as RequestingService, "makeRequest").mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return Promise.reject(new Error("HTTP error! status: 504"));
        }
        return Promise.resolve([buildObservation()]);
      });

      const result = await service.fetchTemporalData({
        pollutant: "pm25",
        timeStep: "heure",
        startDate: "2026-08-04",
        endDate: "2026-09-03",
      });

      // L'ancien service avalait l'erreur en silence
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Échec de la tranche"),
        expect.anything()
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it("retourne un tableau vide pour un polluant non supporté", async () => {
      const spy = mockRoutes(service, {});

      const result = await service.fetchTemporalData({
        pollutant: "h2s",
        timeStep: "heure",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
      });

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
