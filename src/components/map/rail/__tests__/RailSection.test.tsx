import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RailSection from "../RailSection";

/**
 * L'état gelé n'est atteignable dans l'application qu'en lecture historique
 * effective (mode historique actif ET lecture en cours), donc après chargement
 * de données. Ces tests couvrent le mécanisme lui-même.
 *
 * Le point important : le header utilisait `opacity-50 pointer-events-none`, qui
 * laisse les boutons dans l'ordre de tabulation — focalisables, sans effet et
 * sans raison annoncée. `inert` les en retire réellement.
 */
describe("RailSection", () => {
  it("ne pose ni inert ni raison quand le groupe est actif", () => {
    render(
      <RailSection label="Données">
        <button>a</button>
      </RailSection>
    );
    const group = screen.getByRole("group", { name: "Données" });
    expect(group).not.toHaveAttribute("inert");
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  it("pose inert et annonce la raison quand le groupe est gelé", () => {
    render(
      <RailSection
        label="Données"
        locked
        lockedReason="Indisponible pendant la lecture"
      >
        <button>a</button>
      </RailSection>
    );
    // `inert` retire le groupe de l'arbre d'accessibilité : on le récupère par
    // son attribut plutôt que par son rôle.
    const group = document.querySelector('[aria-label="Données"]');
    expect(group).toHaveAttribute("inert");
    expect(group).toHaveTextContent("Indisponible pendant la lecture");
  });

  it("porte le filet en bordure et non en frère, pour que le cas vide disparaisse", () => {
    const { container } = render(
      <RailSection label="Panneaux" separated>
        {null}
      </RailSection>
    );
    // Aucun <hr> orphelin : le filet est une bordure du groupe lui-même, donc
    // la règle CSS `.rail-section:empty` les fait disparaître ensemble.
    expect(container.querySelector("hr")).toBeNull();
    const group = container.querySelector(".rail-section");
    expect(group).toBeEmptyDOMElement();
    expect(group?.className).toContain("border-t");
  });
});
