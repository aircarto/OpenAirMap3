import { describe, expect, it } from "vitest";
import {
  compareSensorsByActivity,
  getSensorActivityRank,
  getSensorAgeSeconds,
  parseSensorTimestamp,
} from "../sensorLastSeen";

describe("parseSensorTimestamp", () => {
  it("lit un ISO complet", () => {
    expect(parseSensorTimestamp("2025-09-02T15:15:00Z")).toBe(
      Date.UTC(2025, 8, 2, 15, 15, 0)
    );
  });

  it("lit une date sans fuseau comme de l'UTC, et non comme une heure locale", () => {
    expect(parseSensorTimestamp("2025-02-07 17:29:43")).toBe(
      Date.UTC(2025, 1, 7, 17, 29, 43)
    );
  });

  it("respecte un décalage explicite", () => {
    expect(parseSensorTimestamp("2025-02-07T18:29:43+01:00")).toBe(
      Date.UTC(2025, 1, 7, 17, 29, 43)
    );
  });

  it("rend null sur une entrée vide ou illisible", () => {
    expect(parseSensorTimestamp(null)).toBeNull();
    expect(parseSensorTimestamp("")).toBeNull();
    expect(parseSensorTimestamp("hier")).toBeNull();
  });
});

describe("getSensorAgeSeconds", () => {
  const now = Date.UTC(2025, 8, 2, 16, 15, 0);

  it("compte l'ancienneté depuis timeUTC", () => {
    expect(
      getSensorAgeSeconds({ timeUTC: "2025-09-02T15:15:00Z" }, now)
    ).toBe(3600);
  });

  it("ignore last_seen_sec tant que timeUTC est lisible, car le catalogue dort en cache", () => {
    expect(
      getSensorAgeSeconds(
        { timeUTC: "2025-09-02T15:15:00Z", last_seen_sec: 120 },
        now
      )
    ).toBe(3600);
  });

  it("retombe sur last_seen_sec quand l'horodatage manque", () => {
    expect(getSensorAgeSeconds({ timeUTC: null, last_seen_sec: 120 }, now)).toBe(
      120
    );
  });

  it("ramène à zéro un horodatage dans le futur", () => {
    expect(
      getSensorAgeSeconds({ timeUTC: "2025-09-02T17:15:00Z" }, now)
    ).toBe(0);
  });

  it("rend null quand rien n'est exploitable", () => {
    expect(getSensorAgeSeconds({}, now)).toBeNull();
  });
});

describe("getSensorActivityRank", () => {
  const now = Date.UTC(2025, 8, 2, 16, 15, 0);

  it("place les capteurs connectés en tête", () => {
    expect(getSensorActivityRank({ connected: true }, now)).toBe(0);
  });

  it("classe l'activité récente sous les connectés", () => {
    expect(
      getSensorActivityRank(
        { connected: false, timeUTC: "2025-09-02T10:15:00Z" },
        now
      )
    ).toBe(1);
  });

  it("classe le reste comme inactif", () => {
    expect(
      getSensorActivityRank(
        { connected: false, timeUTC: "2025-08-01T16:15:00Z" },
        now
      )
    ).toBe(2);
  });
});

describe("compareSensorsByActivity", () => {
  const now = Date.UTC(2025, 8, 2, 16, 15, 0);

  it("ordonne connectés, activité récente, puis inactifs", () => {
    const connected = { connected: true, timeUTC: "2025-09-02T16:00:00Z" };
    const recent = { connected: false, timeUTC: "2025-09-02T10:15:00Z" };
    const inactive = { connected: false, timeUTC: "2025-08-01T16:15:00Z" };

    expect(
      [inactive, recent, connected].sort((a, b) =>
        compareSensorsByActivity(a, b, now)
      )
    ).toEqual([connected, recent, inactive]);
  });

  it("à rang égal, place le plus récent en premier", () => {
    const olderConnected = {
      connected: true,
      timeUTC: "2025-09-02T14:15:00Z",
    };
    const newerConnected = {
      connected: true,
      timeUTC: "2025-09-02T16:00:00Z",
    };

    expect(compareSensorsByActivity(olderConnected, newerConnected, now)).toBeGreaterThan(
      0
    );
  });
});
