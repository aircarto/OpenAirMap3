import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { QUALITY_COLORS } from "../../constants/qualityColors";
import { seuilsPm1Pm25 } from "../../constants/pollutants";
import {
  formatThresholdRange,
  getQualityThresholdLegendItems,
  QUALITY_THRESHOLD_LEVELS,
} from "../qualityLegend";

const t = ((key: string) => key) as TFunction;

describe("formatThresholdRange", () => {
  it("formate un palier fermé en min-max", () => {
    expect(formatThresholdRange("bon", seuilsPm1Pm25)).toBe("0-6");
    expect(formatThresholdRange("tresMauvais", seuilsPm1Pm25)).toBe("91-141");
  });

  it("formate le dernier palier en min+", () => {
    expect(formatThresholdRange("extrMauvais", seuilsPm1Pm25)).toBe("141+");
  });
});

describe("getQualityThresholdLegendItems", () => {
  it("retourne les 6 niveaux sans noData par défaut", () => {
    const items = getQualityThresholdLegendItems(seuilsPm1Pm25, t);
    expect(items).toHaveLength(6);
    expect(items.map((item) => item.key)).toEqual([...QUALITY_THRESHOLD_LEVELS]);
    expect(items.some((item) => item.key === "noData")).toBe(false);
  });

  it("ajoute l'item pas de donnée quand demandé", () => {
    const items = getQualityThresholdLegendItems(seuilsPm1Pm25, t, {
      includeNoData: true,
    });
    expect(items).toHaveLength(7);
    expect(items[0]).toEqual({
      key: "noData",
      label: "quality.noData",
      shortLabel: "N/A",
      color: QUALITY_COLORS.noData,
    });
  });

  it("expose couleur, libellés et plages pour PM2.5", () => {
    const items = getQualityThresholdLegendItems(seuilsPm1Pm25, t);
    const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

    expect(byKey.bon).toMatchObject({
      label: "quality.bon",
      shortLabel: "quality.bon",
      color: QUALITY_COLORS.bon,
      range: "0-6",
    });
    expect(byKey.tresMauvais).toMatchObject({
      shortLabel: "quality.tresMauvaisShort",
      range: "91-141",
    });
    expect(byKey.extrMauvais).toMatchObject({
      shortLabel: "quality.extrMauvaisShort",
      color: QUALITY_COLORS.extrMauvais,
      range: "141+",
    });
  });
});
