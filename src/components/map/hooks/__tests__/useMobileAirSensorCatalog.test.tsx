import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { DataServiceFactory } from "../../../../services/DataServiceFactory";
import type { MobileAirService } from "../../../../services/MobileAirService";
import { useMobileAirSensorCatalog } from "../useMobileAirSensorCatalog";

const buildSensor = (id = "mob-001") => ({
  sensorId: id,
  sensorToken: `token-${id}`,
  time: new Date().toISOString(),
  PM25: "12.5",
  PM10: "20.1",
  PM1: "8.4",
  latitude: "43.29",
  longitude: "5.37",
  connected: true,
  displayMap: true,
});

/** Le hook lit le singleton : il faut le remettre à zéro entre les cas. */
const resetSingleton = (): MobileAirService => {
  const service = DataServiceFactory.getService(
    "mobileair"
  ) as MobileAirService;
  (service as unknown as { sensors: unknown[] }).sensors = [];
  (service as unknown as { sensorsPromise: unknown }).sensorsPromise = null;
  return service;
};

describe("useMobileAirSensorCatalog", () => {
  let service: MobileAirService;

  beforeEach(() => {
    service = resetSingleton();
  });

  it("ne relance aucun appel réseau au remontage : le catalogue est amorcé depuis le singleton", async () => {
    const fetchSensors = vi
      .spyOn(service as unknown as { fetchSensors: () => Promise<void> }, "fetchSensors")
      .mockImplementation(async () => {
        (service as unknown as { sensors: unknown[] }).sensors = [buildSensor()];
      });

    const first = renderHook(() => useMobileAirSensorCatalog());
    await waitFor(() => expect(first.result.current.sensors).toHaveLength(1));
    first.unmount();

    const second = renderHook(() => useMobileAirSensorCatalog());

    // Synchrone, sans passe intermédiaire à liste vide — c'est tout l'intérêt
    // du `useState(() => service.getSensors())`.
    expect(second.result.current.sensors).toHaveLength(1);
    expect(second.result.current.loading).toBe(false);
    expect(fetchSensors).toHaveBeenCalledTimes(1);
  });

  it("déduplique deux consommateurs montés dans le même tick", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchSensors = vi
      .spyOn(service as unknown as { fetchSensors: () => Promise<void> }, "fetchSensors")
      .mockImplementation(async () => {
        await gate;
        (service as unknown as { sensors: unknown[] }).sensors = [buildSensor()];
      });

    const a = renderHook(() => useMobileAirSensorCatalog());
    const b = renderHook(() => useMobileAirSensorCatalog());
    release!();

    await waitFor(() => expect(a.result.current.sensors).toHaveLength(1));
    await waitFor(() => expect(b.result.current.sensors).toHaveLength(1));
    expect(fetchSensors).toHaveBeenCalledTimes(1);
  });

  it("passe par ensureSensorsLoaded et jamais par fetchData", async () => {
    vi.spyOn(service as unknown as { fetchSensors: () => Promise<void> }, "fetchSensors")
      .mockImplementation(async () => {
        (service as unknown as { sensors: unknown[] }).sensors = [buildSensor()];
      });
    const fetchData = vi.spyOn(service, "fetchData");

    const { result } = renderHook(() => useMobileAirSensorCatalog());
    await waitFor(() => expect(result.current.sensors).toHaveLength(1));

    // `fetchData` sort avant de charger le catalogue si le polluant courant
    // n'est pas supporté par MobileAir : le chemin qu'utilisait l'ancien
    // panneau laissait donc la liste vide, sans erreur, dès que NO₂ était
    // sélectionné.
    expect(fetchData).not.toHaveBeenCalled();
  });

  it("ne charge rien tant que enabled est faux", () => {
    const fetchSensors = vi.spyOn(
      service as unknown as { fetchSensors: () => Promise<void> },
      "fetchSensors"
    );

    const { result } = renderHook(() => useMobileAirSensorCatalog(false));

    expect(result.current.sensors).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetchSensors).not.toHaveBeenCalled();
  });

  it("expose une clé i18n en cas d'échec, et n'insiste pas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSensors = vi
      .spyOn(service as unknown as { fetchSensors: () => Promise<void> }, "fetchSensors")
      .mockRejectedValue(new Error("réseau indisponible"));

    const { result } = renderHook(() => useMobileAirSensorCatalog());

    await waitFor(() => expect(result.current.error).toBe("loadError"));
    expect(result.current.loading).toBe(false);
    expect(result.current.sensors).toEqual([]);
    // Un échec ne doit pas relancer de boucle de tentatives.
    expect(fetchSensors).toHaveBeenCalledTimes(1);
  });
});
