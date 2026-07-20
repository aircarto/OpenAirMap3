import { describe, it, expect } from "vitest";
import {
  areAppUrlParamsEqual,
  buildAppUrlDefaults,
  parseAppUrlParams,
  serializeAppUrlParams,
} from "../appUrlParams";

const defaults = buildAppUrlDefaults({
  mapCenter: [43.7102, 7.262],
  mapZoom: 9,
});

describe("parseAppUrlParams", () => {
  it("retourne les défauts quand la query est vide", () => {
    expect(parseAppUrlParams("", defaults)).toEqual(defaults);
  });

  it("parse lat, lng, zoom et filtres valides", () => {
    const result = parseAppUrlParams(
      "?lat=43.5&lng=5.4&zoom=11&pollutant=no2&timeStep=quartHeure&sources=atmoRef,atmoMicro",
      defaults
    );

    expect(result).toEqual({
      lat: 43.5,
      lng: 5.4,
      zoom: 11,
      pollutant: "no2",
      timeStep: "quartHeure",
      sources: ["atmoRef", "atmoMicro"],
    });
  });

  it("ignore les coordonnées invalides", () => {
    const result = parseAppUrlParams("?lat=999&lng=abc&zoom=0", defaults);

    expect(result.lat).toBe(defaults.lat);
    expect(result.lng).toBe(defaults.lng);
    expect(result.zoom).toBe(defaults.zoom);
  });

  it("filtre les sources inconnues et retombe sur les défauts si liste vide", () => {
    const result = parseAppUrlParams(
      "?sources=atmoRef,unknown,communautaire.nebuleair",
      defaults
    );

    expect(result.sources).toEqual(["atmoRef", "communautaire.nebuleair"]);
  });

  it("corrige un polluant incompatible avec le pas de temps", () => {
    const result = parseAppUrlParams(
      "?pollutant=bruit&timeStep=heure",
      defaults
    );

    expect(result.timeStep).toBe("heure");
    expect(result.pollutant).toBe("pm25");
  });
});

describe("serializeAppUrlParams", () => {
  it("omet les paramètres identiques aux défauts", () => {
    expect(
      serializeAppUrlParams(defaults, { defaults, includeMapView: false })
    ).toBe("");
  });

  it("inclut la vue carte quand includeMapView est true", () => {
    const query = serializeAppUrlParams(defaults, {
      defaults,
      includeMapView: true,
    });

    expect(query).toBe("?lat=43.7102&lng=7.262&zoom=9");
  });

  it("sérialise les filtres modifiés", () => {
    const query = serializeAppUrlParams(
      {
        ...defaults,
        pollutant: "no2",
        timeStep: "quartHeure",
        sources: ["atmoMicro"],
      },
      { defaults, includeMapView: false }
    );

    expect(query).toBe(
      "?pollutant=no2&timeStep=quartHeure&sources=atmoMicro"
    );
  });

  it("arrondit lat/lng à 5 décimales", () => {
    const query = serializeAppUrlParams(
      {
        ...defaults,
        lat: 43.123456789,
        lng: 7.987654321,
        zoom: 12,
      },
      { defaults, includeMapView: true }
    );

    expect(query).toBe("?lat=43.12346&lng=7.98765&zoom=12");
  });
});

describe("areAppUrlParamsEqual", () => {
  it("compare les coordonnées avec tolérance", () => {
    expect(
      areAppUrlParamsEqual(
        { ...defaults, lat: 43.710200001 },
        { ...defaults, lat: 43.710200002 }
      )
    ).toBe(true);
  });

  it("détecte une différence de sources", () => {
    expect(
      areAppUrlParamsEqual(defaults, {
        ...defaults,
        sources: ["atmoMicro"],
      })
    ).toBe(false);
  });
});
