import type { TFunction } from "i18next";
import { QUALITY_COLORS } from "../constants/qualityColors";
import type { Seuils } from "../types";

export const QUALITY_THRESHOLD_LEVELS = [
  "bon",
  "moyen",
  "degrade",
  "mauvais",
  "tresMauvais",
  "extrMauvais",
] as const;

export type QualityThresholdLevel = (typeof QUALITY_THRESHOLD_LEVELS)[number];

export interface QualityLegendItem {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  range?: string;
}

const SHORT_LABEL_KEYS: Partial<Record<QualityThresholdLevel, string>> = {
  tresMauvais: "quality.tresMauvaisShort",
  extrMauvais: "quality.extrMauvaisShort",
};

/**
 * Formate la plage d'un palier. Le dernier niveau est ouvert (`min+`),
 * comme sur la légende carte.
 */
export const formatThresholdRange = (
  level: QualityThresholdLevel,
  thresholds: Seuils
): string => {
  const seuil = thresholds[level];
  if (level === "extrMauvais") {
    return `${seuil.min}+`;
  }
  return `${seuil.min}-${seuil.max}`;
};

/**
 * Construit les items de légende qualité à partir des seuils d'un polluant.
 * L'item « pas de donnée » est optionnel : utile sur la carte, hors sujet
 * pour les bandes du graphique.
 */
export const getQualityThresholdLegendItems = (
  thresholds: Seuils,
  t: TFunction,
  options: { includeNoData?: boolean } = {}
): QualityLegendItem[] => {
  const items: QualityLegendItem[] = [];

  if (options.includeNoData) {
    items.push({
      key: "noData",
      label: t("quality.noData"),
      shortLabel: "N/A",
      color: QUALITY_COLORS.noData,
    });
  }

  for (const level of QUALITY_THRESHOLD_LEVELS) {
    const shortKey = SHORT_LABEL_KEYS[level];
    items.push({
      key: level,
      label: t(`quality.${level}`),
      shortLabel: shortKey ? t(shortKey) : t(`quality.${level}`),
      color: QUALITY_COLORS[level],
      range: formatThresholdRange(level, thresholds),
    });
  }

  return items;
};
