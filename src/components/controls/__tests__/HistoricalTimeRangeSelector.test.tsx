import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../../i18n";
import HistoricalTimeRangeSelector from "../HistoricalTimeRangeSelector";
import type { TimeRange } from "../../../utils/historicalTimeRange";

const PRESET: TimeRange = { type: "preset", preset: "24h" };

/**
 * Deux garanties du passage en flyout, invérifiables à l'œil :
 *
 * 1. En `inline`, aucun écouteur `document` n'est armé. L'écouteur `mousedown`
 *    du mode superposé ferait doublon avec le `DismissableLayer` d'un popover
 *    Radix hôte, qui écoute lui aussi sur `document` — et en phase de capture,
 *    donc un `stopPropagation` React n'y changerait rien.
 * 2. Les timers d'effacement du message de validation sont annulés au
 *    démontage. Dans un panneau latéral qui vit longtemps c'était anodin ; dans
 *    un contenu démonté à chaque fermeture de menu, ça devient la norme.
 */
describe("HistoricalTimeRangeSelector", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(document, "addEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mousedownRegistrations = () =>
    addSpy.mock.calls.filter(([type]) => type === "mousedown");

  it("arme l'écouteur de clic extérieur en présentation superposée (défaut)", () => {
    render(
      <HistoricalTimeRangeSelector
        timeRange={PRESET}
        onTimeRangeChange={vi.fn()}
      />
    );

    expect(mousedownRegistrations()).toHaveLength(1);
  });

  it("n'arme aucun écouteur document en présentation inline", () => {
    render(
      <HistoricalTimeRangeSelector
        timeRange={PRESET}
        onTimeRangeChange={vi.fn()}
        customRangePresentation="inline"
      />
    );

    expect(mousedownRegistrations()).toHaveLength(0);
  });

  it("le bloc personnalisé sort du flux positionné en inline, et y reste en superposé", async () => {
    const { unmount } = render(
      <HistoricalTimeRangeSelector
        timeRange={PRESET}
        onTimeRangeChange={vi.fn()}
        customRangePresentation="inline"
      />
    );

    const trigger = screen.getByRole("button", { expanded: false });
    fireEvent.click(trigger);

    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const inlinePanel = document.getElementById(panelId!);
    expect(inlinePanel).not.toBeNull();
    expect(inlinePanel!.className).not.toContain("absolute");
    unmount();

    render(
      <HistoricalTimeRangeSelector
        timeRange={PRESET}
        onTimeRangeChange={vi.fn()}
      />
    );
    const popoverTrigger = screen.getByRole("button", { expanded: false });
    fireEvent.click(popoverTrigger);
    const popoverPanel = document.getElementById(
      popoverTrigger.getAttribute("aria-controls")!
    );
    expect(popoverPanel!.className).toContain("absolute");
  });

  it("annule les timers d'erreur de validation au démontage", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(window, "clearTimeout");

    // `instantane` plafonne l'historique à 60 jours ; une période
    // personnalisée de ~150 jours le dépasse, ce qui arme le timer
    // d'effacement du message. À noter au passage : la branche « preset »
    // du même effet est inatteignable, le plus long preset (30 j) restant
    // sous le plus bas plafond (60 j).
    const { unmount } = render(
      <HistoricalTimeRangeSelector
        timeRange={{
          type: "custom",
          custom: { startDate: "2025-01-01", endDate: "2025-06-01" },
        }}
        onTimeRangeChange={vi.fn()}
        timeStep="instantane"
      />
    );

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    // Aucun timer ne doit survivre au démontage.
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });
});
