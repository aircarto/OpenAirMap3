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
  signalAirSelectedTypes: ALL_TYPES,
  onSignalAirTypesChange: vi.fn(),
  signalAirDraftPeriod: { startDate: "2026-01-01", endDate: "2026-01-08" },
  onSignalAirDraftPeriodChange: vi.fn(),
  onSignalAirLoadRequest: vi.fn(),
  isSignalAirLoading: false,
  signalAirHasLoaded: true,
  signalAirReportsCount: 12,
  ...overrides,
});

const renderDisclosure = (overrides: Partial<MapControlsCommunitySources> = {}) => {
  const community = makeCommunity(overrides);
  const onLoaded = vi.fn();
  render(
    <SignalAirSourceDisclosure community={community} onLoaded={onLoaded} />
  );
  const header = screen.getByRole("button", { name: /^SignalAir/ });
  return { community, onLoaded, header };
};

/**
 * Le dépliant sépare trois actions que l'ancien `onSignalAirClick` confondait :
 * replier n'est qu'un geste d'affichage, masquer retire les marqueurs sans rien
 * perdre, désactiver rend la source au néant et réinitialise la sélection.
 *
 * Confondre les deux premières avec la troisième était le défaut : chaque
 * fermeture accidentelle du panneau jetait les signalements chargés. Ces tests
 * ne portent donc que sur cette frontière — le reste (types, période) relève de
 * composants déjà couverts ailleurs.
 */
describe("SignalAirSourceDisclosure", () => {
  it("replier ne touche ni à l'activation ni à la visibilité", () => {
    const { community, header } = renderDisclosure();

    // Déplié par un premier clic : `defaultOpen` est faux ici, les données
    // étant déjà chargées.
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

  it("désactiver éteint la source", () => {
    const { community, header } = renderDisclosure();
    fireEvent.click(header);

    fireEvent.click(screen.getByTestId("sources-signalair-disable"));

    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(false);
    expect(community.onSignalAirToggle).not.toHaveBeenCalled();
  });

  it("n'offre la désactivation que si la source est allumée", () => {
    const { header } = renderDisclosure({
      isSignalAirEnabled: false,
      hasSignalAirData: false,
      signalAirHasLoaded: false,
    });
    fireEvent.click(header);

    expect(screen.queryByTestId("sources-signalair-disable")).toBeNull();
  });

  it("s'ouvre de lui-même quand la source est allumée sans données chargées", () => {
    // Remplace l'auto-ouverture du panneau latéral et ses trois refs de garde :
    // le contenu du popover étant démonté à la fermeture, `defaultOpen` suffit.
    renderDisclosure({
      isSignalAirEnabled: true,
      signalAirHasLoaded: false,
      hasSignalAirData: false,
    });

    expect(screen.getByTestId("sources-signalair-body")).toBeInTheDocument();
  });

  it("charger allume la source si besoin, puis referme le menu", () => {
    const { community, onLoaded, header } = renderDisclosure({
      isSignalAirEnabled: false,
      hasSignalAirData: false,
      signalAirHasLoaded: false,
    });
    fireEvent.click(header);

    fireEvent.click(screen.getByTestId("sources-signalair-load"));

    expect(community.onSignalAirEnabledChange).toHaveBeenCalledWith(true);
    expect(community.onSignalAirLoadRequest).toHaveBeenCalledTimes(1);
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});
