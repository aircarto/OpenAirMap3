import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SourceGroupCheckbox from "../SourceGroupCheckbox";

const SCOPE = ["a", "b", "c"];

const renderGroup = (selectedSources: string[], onToggle = vi.fn()) => {
  render(
    <SourceGroupCheckbox
      label="Autres capteurs communautaires"
      scope={SCOPE}
      selectedSources={selectedSources}
      onToggle={onToggle}
      hint={`${selectedSources.filter((s) => SCOPE.includes(s)).length}/${
        SCOPE.length
      }`}
      testId="group-all"
    />
  );
  return { checkbox: screen.getByTestId("group-all"), onToggle };
};

/**
 * L'ancienne implémentation posait `data-state="indeterminate"` en impératif
 * dans un effet, par-dessus l'attribut piloté par Radix, tout en laissant
 * `checked` booléen — donc `aria-checked="false"` sur un groupe partiellement
 * sélectionné. Ces tests portent sur l'attribut ARIA et non sur le visuel :
 * c'est lui qui était faux, et lui seul qu'un lecteur d'écran lit.
 */
describe("SourceGroupCheckbox", () => {
  it("annonce mixed sur un périmètre partiellement sélectionné", () => {
    const { checkbox } = renderGroup(["a"]);
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    expect(checkbox).toHaveAttribute("data-state", "indeterminate");
  });

  it("annonce true quand tout le périmètre est sélectionné", () => {
    const { checkbox } = renderGroup(["a", "b", "c"]);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("annonce false quand rien du périmètre n'est sélectionné", () => {
    const { checkbox } = renderGroup(["hors-perimetre"]);
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("ne compte que les sources du périmètre", () => {
    const { checkbox } = renderGroup(["a", "b", "c", "autre-source"]);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("n'expose qu'un seul élément interactif, et pas d'imbrication", () => {
    renderGroup(["a"]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("ne déclenche onToggle qu'une fois par clic sur la case", () => {
    const { checkbox, onToggle } = renderGroup(["a"]);
    fireEvent.click(checkbox);
    // L'ancien composant branchait `onToggle` sur le wrapper ET sur
    // `onCheckedChange`, donc deux fois pour un clic sur la case.
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("rend l'étiquette cliquable et associée à la case", () => {
    const { checkbox, onToggle } = renderGroup(["a"]);
    const label = screen.getByText("Autres capteurs communautaires");
    expect(label.closest("label")).toHaveAttribute("for", checkbox.id);
    fireEvent.click(label);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
