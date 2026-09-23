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
  ...overrides,
});

const renderDisclosure = (
  overrides: Partial<MapControlsCommunitySources> = {},
  selectedTimeStep = "heure"
) => {
  const community = makeCommunity(overrides);
  const onLoaded = vi.fn();
  render(
    <SignalAirSourceDisclosure
      community={community}
      selectedTimeStep={selectedTimeStep}
      onLoaded={onLoaded}
    />
  );
  const header = screen
    .getAllByRole("button")
    .find((button) => button.hasAttribute("aria-expanded"));
  if (!header) {
    throw new Error("En-tête SignalAir introuvable");
  }
  return { community, onLoaded, header };
};

/**
 * Le dépliant sépare trois actions : replier, masquer les marqueurs, désactiver.
 */
describe("SignalAirSourceDisclosure", () => {
  it("replier ne touche ni à l'activation ni à la visibilité", () => {
    const { community, header } = renderDisclosure();

    fireEvent.click(header);
    expect(screen.getByTestId("sources-signalair-body")).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("sources-signalair-body")).toBeNull();
    expect(community.onSignalAirEnabledChange).not.toHaveBeenCalled();
    expect(community.onSignalAirToggle).not.toHaveBeenCalled();
    expect(community.onSignalAirTypesChange).not.toHaveBeenCalled();
  });

  it("masquer les marqueurs bascule la seule visibilité, sans désactiver", () => {
    const { community, header } = renderDisclosure();
    fireEvent.click(header);

    fireEvent.click(screen.getByTestId("sources-signalair-visibility"));

    expect(community.onSignalAirToggle).toHaveBeenCalledWith(false);
    expect(community.onSignalAirEnabledChange).not.toHaveBeenCalled();
  });

  it("n'offre le masquage que lorsqu'il y a des marqueurs à masquer", () => {
    const { header } = renderDisclosure({ hasSignalAirData: false });
    fireEvent.click(header);

    expect(screen.queryByTestId("sources-signalair-visibility")).toBeNull();
  });

  it("désactiver via la case éteint la source", () => {
    const { community, header } = renderDisclosure();
    fireEvent.click(header);

    fireEvent.click(screen.getByTestId("sources-signalair-enable"));

    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(false);
    expect(community.onSignalAirToggle).not.toHaveBeenCalled();
  });

  it("activer via la case allume la source", () => {
    const { community, header } = renderDisclosure({
      isSignalAirEnabled: false,
      hasSignalAirData: false,
      signalAirHasLoaded: false,
    });
    fireEvent.click(header);

    fireEvent.click(screen.getByTestId("sources-signalair-enable"));

    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(true);
  });

  it("s'ouvre de lui-même quand la source est allumée sans données chargées", () => {
    renderDisclosure({
      isSignalAirEnabled: true,
      signalAirHasLoaded: false,
      hasSignalAirData: false,
    });

    expect(screen.getByTestId("sources-signalair-body")).toBeInTheDocument();
  });

  it("grise et bloque l'activation hors pas TimeBar", () => {
    const { community, header } = renderDisclosure(
      {
        isSignalAirEnabled: false,
        hasSignalAirData: false,
        signalAirHasLoaded: false,
      },
      "instantane"
    );
    fireEvent.click(header);

    expect(screen.getByTestId("sources-signalair-incompatible")).toBeInTheDocument();
    const enable = screen.getByTestId("sources-signalair-enable");
    expect(enable).toBeDisabled();
    fireEvent.click(enable);
    expect(community.onSignalAirEnabledChange).not.toHaveBeenCalled();
  });

  it("tout décocher les types demande une liste vide", () => {
    const { community, header } = renderDisclosure();
    fireEvent.click(header);

    fireEvent.click(
      screen.getByRole("button", {
        name: /aucun|none|deselect|tout désélectionner/i,
      })
    );

    expect(community.onSignalAirTypesChange).toHaveBeenCalledWith([]);
  });

  it("en mode mobilité, un clic sur activer sort du mode", () => {
    const { community, header } = renderDisclosure({
      isMobileAirMobilityMode: true,
      isSignalAirEnabled: false,
      signalAirHasLoaded: false,
    });

    // Ouvrir le dépliant si besoin
    if (header.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(header);
    }

    expect(screen.getByTestId("sources-signalair-mobility-hint")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sources-signalair-enable"));
    expect(community.onExitMobilityModeViaSignalAir).toHaveBeenCalledTimes(1);
    expect(community.onSignalAirEnabledChange).not.toHaveBeenCalled();
  });
});
