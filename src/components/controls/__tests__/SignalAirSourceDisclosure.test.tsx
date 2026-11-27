import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../../i18n";
import SignalAirSourceDisclosure from "../SignalAirSourceDisclosure";
import type { MapControlsCommunitySources } from "../../../contexts/mapControlsContext";

const ALL_TYPES = ["odeur", "bruit", "brulage", "visuel"];

const makeCommunity = (
  overrides: Partial<MapControlsCommunitySources> = {}
): MapControlsCommunitySources => ({
  isSignalAirEnabled: true,
  onSignalAirEnabledChange: vi.fn(),
  isMobileAirEnabled: false,
  onMobileAirEnabledChange: vi.fn(),
  isSignalAirVisible: true,
  onSignalAirToggle: vi.fn(),
  isMobileAirVisible: true,
  onMobileAirToggle: vi.fn(),
  hasSignalAirData: true,
  hasMobileAirData: false,
  selectedMobileAirSensors: [],
  mobileAirDefaultPeriod: { startDate: "2026-01-01", endDate: "2026-01-08" },
  mobileAirSensorPeriods: {},
  mobileAirSensorVisibility: {},
  mobileAirSensorStatus: {},
  isMobileAirLoading: false,
  onMobileAirSensorRemove: vi.fn(),
  onMobileAirSensorPeriodChange: vi.fn(),
  onMobileAirSensorVisibilityChange: vi.fn(),
  signalAirSelectedTypes: ALL_TYPES,
  onSignalAirTypesChange: vi.fn(),
  isSignalAirLoading: false,
  signalAirHasLoaded: true,
  signalAirReportsCount: 12,
  isMobileAirMobilityMode: false,
  onExitMobilityModeViaSignalAir: vi.fn(),
  mobileAirLiveEnabled: false,
  onMobileAirLiveEnabledChange: vi.fn(),
  selectedTimeStep: "heure",
  ...overrides,
});

const renderGroup = (
  overrides: Partial<MapControlsCommunitySources> = {},
  selectedTimeStep = "heure"
) => {
  const community = makeCommunity(overrides);
  render(
    <SignalAirSourceDisclosure
      community={community}
      selectedTimeStep={selectedTimeStep}
    />
  );
  return { community, parent: screen.getByTestId("sources-signalair-enable") };
};

const type = (id: string) => screen.getByTestId(`sources-signalair-type-${id}`);

/**
 * Groupe SignalAir : case parente à trois états + une ligne par type, sur le
 * modèle des « Autres capteurs communautaires ».
 */
describe("SignalAirSourceDisclosure", () => {
  it("tout est visible d'emblée, sans dépliant ni bouton de masquage", () => {
    renderGroup();

    expect(screen.queryByRole("button", { expanded: false })).toBeNull();
    expect(screen.queryByTestId("sources-signalair-visibility")).toBeNull();
    ALL_TYPES.forEach((id) => expect(type(id)).toBeInTheDocument());
  });

  it("case parente cochée quand la source est allumée avec tous les types", () => {
    const { parent } = renderGroup();
    expect(parent).toHaveAttribute("aria-checked", "true");
  });

  it("case parente indéterminée quand seuls certains types sont retenus", () => {
    const { parent } = renderGroup({ signalAirSelectedTypes: ["odeur"] });
    expect(parent).toHaveAttribute("aria-checked", "mixed");
    expect(type("odeur")).toHaveAttribute("aria-checked", "true");
    expect(type("bruit")).toHaveAttribute("aria-checked", "false");
  });

  it("source éteinte : parente et types décochés", () => {
    const { parent } = renderGroup({ isSignalAirEnabled: false });
    expect(parent).toHaveAttribute("aria-checked", "false");
    ALL_TYPES.forEach((id) =>
      expect(type(id)).toHaveAttribute("aria-checked", "false")
    );
  });

  it("affiche le nombre de types retenus et de signalements chargés", () => {
    renderGroup({ signalAirSelectedTypes: ["odeur", "bruit"] });
    // Les traductions ne sont pas chargées en test : seul le suffixe est stable
    expect(screen.getByText(/· 12$/)).toBeInTheDocument();
  });

  it("cocher la parente allume la source avec tous les types", () => {
    const { community, parent } = renderGroup({ isSignalAirEnabled: false });
    fireEvent.click(parent);
    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(
      true,
      ALL_TYPES
    );
  });

  it("décocher la parente, même partielle, éteint la source", () => {
    const { community, parent } = renderGroup({
      signalAirSelectedTypes: ["odeur"],
    });
    fireEvent.click(parent);
    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(false);
  });

  it("cocher un type alors que la source est éteinte l'allume avec ce seul type", () => {
    const { community } = renderGroup({ isSignalAirEnabled: false });
    fireEvent.click(type("brulage"));
    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(true, [
      "brulage",
    ]);
    expect(community.onSignalAirTypesChange).not.toHaveBeenCalled();
  });

  it("décocher un type le retire de la sélection", () => {
    const { community } = renderGroup();
    fireEvent.click(type("bruit"));
    expect(community.onSignalAirTypesChange).toHaveBeenCalledWith([
      "odeur",
      "brulage",
      "visuel",
    ]);
  });

  it("décocher le dernier type demande une liste vide", () => {
    const { community } = renderGroup({ signalAirSelectedTypes: ["visuel"] });
    fireEvent.click(type("visuel"));
    expect(community.onSignalAirTypesChange).toHaveBeenCalledWith([]);
  });

  it("grise et bloque tout hors pas TimeBar", () => {
    const { community, parent } = renderGroup(
      { isSignalAirEnabled: false },
      "instantane"
    );

    expect(
      screen.getByTestId("sources-signalair-incompatible")
    ).toBeInTheDocument();
    expect(parent).toBeDisabled();
    expect(type("odeur")).toBeDisabled();
    fireEvent.click(parent);
    fireEvent.click(type("odeur"));
    expect(community.onSignalAirEnabledChange).not.toHaveBeenCalled();
  });

  it("en mode mobilité, un clic sur la parente ou un type sort du mode", () => {
    const { community, parent } = renderGroup({
      isMobileAirMobilityMode: true,
      isSignalAirEnabled: false,
    });

    expect(
      screen.getByTestId("sources-signalair-mobility-hint")
    ).toBeInTheDocument();
    fireEvent.click(parent);
    fireEvent.click(type("odeur"));
    expect(community.onExitMobilityModeViaSignalAir).toHaveBeenCalledTimes(2);
    expect(community.onSignalAirEnabledChange).not.toHaveBeenCalled();
    expect(community.onSignalAirTypesChange).not.toHaveBeenCalled();
  });
});
