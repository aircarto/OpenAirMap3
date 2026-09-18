import React from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n, { ensureI18n } from "../../../i18n";
import ChartThresholdLegend from "../ChartThresholdLegend";

beforeAll(() => {
  ensureI18n("fr");
});

const renderLegend = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("ChartThresholdLegend", () => {
  it("affiche l'échelle quand les seuils sont communs", () => {
    renderLegend(
      <ChartThresholdLegend selectedPollutants={["pm25"]} source="atmoRef" />
    );

    const legend = screen.getByTestId("chart-threshold-legend");
    expect(legend).toHaveAttribute("aria-label", "Seuils de qualité (µg/m³)");
    expect(screen.getByText("0-6")).toBeInTheDocument();
    expect(screen.getByText("141+")).toBeInTheDocument();
    expect(screen.getByText("Bon")).toBeInTheDocument();
  });

  it("reste masquée si les polluants n'ont pas les mêmes seuils", () => {
    const { container } = renderLegend(
      <ChartThresholdLegend
        selectedPollutants={["pm25", "pm10"]}
        source="atmoRef"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("reste masquée en mode daltonien et sans données", () => {
    const { rerender, container } = renderLegend(
      <ChartThresholdLegend
        selectedPollutants={["pm25"]}
        source="atmoRef"
        hidden
      />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <I18nextProvider i18n={i18n}>
        <ChartThresholdLegend
          selectedPollutants={["pm25"]}
          source="atmoRef"
          hasData={false}
        />
      </I18nextProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
