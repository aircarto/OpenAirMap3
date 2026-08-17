import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RAIL_ITEM_ATTR, useRailRoving } from "../useRailRoving";

/**
 * Le rail ramène onze contrôles à un seul arrêt de tabulation. Si l'invariant
 * « exactement un tabIndex = 0 » se casse — typiquement quand le groupe des
 * raccourcis de panneaux se démonte et emporte l'item actif — le rail devient
 * inatteignable au clavier. axe ne détecte pas ce cas, d'où ce test.
 */

const Harness: React.FC<{ withExtra?: boolean; disabledSecond?: boolean }> = ({
  withExtra = true,
  disabledSecond = false,
}) => {
  const { containerRef, onKeyDownCapture, onItemFocus } =
    useRailRoving("vertical");
  return (
    <div ref={containerRef} role="toolbar" onKeyDownCapture={onKeyDownCapture}>
      <button {...{ [RAIL_ITEM_ATTR]: "a" }} onFocus={onItemFocus}>
        a
      </button>
      <button
        {...{ [RAIL_ITEM_ATTR]: "b" }}
        onFocus={onItemFocus}
        disabled={disabledSecond}
      >
        b
      </button>
      {withExtra && (
        <button {...{ [RAIL_ITEM_ATTR]: "extra" }} onFocus={onItemFocus}>
          extra
        </button>
      )}
    </div>
  );
};

const tabbable = () =>
  screen
    .getAllByRole("button")
    .filter((el) => (el as HTMLButtonElement).tabIndex === 0);

describe("useRailRoving", () => {
  it("n'expose qu'un seul arrêt de tabulation au montage", () => {
    render(<Harness />);
    expect(tabbable()).toHaveLength(1);
    expect(tabbable()[0]).toHaveTextContent("a");
  });

  it("déplace l'arrêt avec les flèches, en bouclant", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    act(() => screen.getByText("a").focus());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("b")).toHaveFocus();
    expect(tabbable()).toHaveLength(1);
    expect(tabbable()[0]).toHaveTextContent("b");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByText("a")).toHaveFocus();
  });

  it("saute les items désactivés", async () => {
    const user = userEvent.setup();
    render(<Harness disabledSecond />);

    act(() => screen.getByText("a").focus());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("extra")).toHaveFocus();
    expect(tabbable()).toHaveLength(1);
  });

  it("retombe sur le premier item quand l'item actif est démonté", async () => {
    const user = userEvent.setup();

    const Wrapper: React.FC = () => {
      const [withExtra, setWithExtra] = useState(true);
      return (
        <>
          <button onClick={() => setWithExtra(false)}>retirer</button>
          <Harness withExtra={withExtra} />
        </>
      );
    };

    render(<Wrapper />);
    // rend « extra » actif, puis le démonte : c'est le scénario du groupe
    // contextuel des raccourcis de panneaux
    act(() => screen.getByText("extra").focus());
    expect(
      screen.getAllByRole("button").filter((el) => el.tabIndex === 0)
    ).toHaveLength(2); // « retirer » n'est pas un item de rail, tabIndex par défaut 0

    await user.click(screen.getByText("retirer"));

    const railItems = screen
      .getAllByRole("button")
      .filter((el) => el.hasAttribute(RAIL_ITEM_ATTR));
    expect(railItems.filter((el) => el.tabIndex === 0)).toHaveLength(1);
    expect(railItems.filter((el) => el.tabIndex === 0)[0]).toHaveTextContent(
      "a"
    );
  });

  it("ne gère que les items situés dans le conteneur", () => {
    // Non-régression : un bouton portant l'attribut mais rendu hors du
    // `role="toolbar"` échappe au roving et garderait tabIndex 0, ce qui
    // créerait un second arrêt de tabulation. C'est arrivé avec le bloc de
    // marque, désormais explicitement hors toolbar et sans l'attribut.
    const Outside: React.FC = () => {
      const { containerRef, onKeyDownCapture } = useRailRoving("vertical");
      return (
        <>
          <button {...{ [RAIL_ITEM_ATTR]: "orphan" }}>orphelin</button>
          <div ref={containerRef} role="toolbar" onKeyDownCapture={onKeyDownCapture}>
            <button {...{ [RAIL_ITEM_ATTR]: "a" }}>a</button>
            <button {...{ [RAIL_ITEM_ATTR]: "b" }}>b</button>
          </div>
        </>
      );
    };

    render(<Outside />);
    const inside = screen
      .getAllByRole("button")
      .filter((el) => el.closest('[role="toolbar"]') !== null);
    expect(inside.filter((el) => el.tabIndex === 0)).toHaveLength(1);
    // l'orphelin n'est pas piloté : le composant réel ne doit donc pas porter l'attribut
    expect(screen.getByText("orphelin").tabIndex).toBe(0);
  });

  it("Début et Fin atteignent les extrémités", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    act(() => screen.getByText("a").focus());
    await user.keyboard("{End}");
    expect(screen.getByText("extra")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByText("a")).toHaveFocus();
    expect(tabbable()).toHaveLength(1);
  });
});
