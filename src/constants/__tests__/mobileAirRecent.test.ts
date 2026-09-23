import { describe, expect, it } from "vitest";
import {
  mobileAirRouteKey,
  pickMostRecentMobileAirRoute,
} from "../../constants/mobileAir";

describe("pickMostRecentMobileAirRoute", () => {
  it("retourne null si liste vide", () => {
    expect(pickMostRecentMobileAirRoute([])).toBeNull();
  });

  it("choisit la session avec le endTime le plus récent", () => {
    const routes = [
      {
        sensorId: "a",
        sessionId: 1,
        startTime: "2024-01-01T10:00:00.000Z",
        endTime: "2024-01-01T11:00:00.000Z",
      },
      {
        sensorId: "a",
        sessionId: 2,
        startTime: "2024-01-02T10:00:00.000Z",
        endTime: "2024-01-02T12:00:00.000Z",
      },
      {
        sensorId: "a",
        sessionId: 3,
        startTime: "2024-01-01T18:00:00.000Z",
        endTime: "2024-01-01T19:00:00.000Z",
      },
    ];
    expect(pickMostRecentMobileAirRoute(routes)?.sessionId).toBe(2);
  });
});

describe("seed clés session récente", () => {
  it("produit une clé par capteur pour la session la plus récente", () => {
    const routes = [
      {
        sensorId: "s1",
        sessionId: 1,
        startTime: "2024-01-01T10:00:00.000Z",
        endTime: "2024-01-01T11:00:00.000Z",
      },
      {
        sensorId: "s1",
        sessionId: 2,
        startTime: "2024-01-03T10:00:00.000Z",
        endTime: "2024-01-03T11:00:00.000Z",
      },
      {
        sensorId: "s2",
        sessionId: 9,
        startTime: "2024-01-02T10:00:00.000Z",
        endTime: "2024-01-02T11:00:00.000Z",
      },
    ];
    const bySensor = new Map<string, typeof routes>();
    for (const route of routes) {
      const list = bySensor.get(route.sensorId) ?? [];
      list.push(route);
      bySensor.set(route.sensorId, list);
    }
    const keys = new Set<string>();
    for (const sensorRoutes of bySensor.values()) {
      const recent = pickMostRecentMobileAirRoute(sensorRoutes);
      if (recent) {
        keys.add(mobileAirRouteKey(recent.sensorId, recent.sessionId));
      }
    }
    expect(keys).toEqual(new Set(["s1-2", "s2-9"]));
  });
});
