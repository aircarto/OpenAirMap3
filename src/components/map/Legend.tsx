import React from "react";
import { useTranslation } from "react-i18next";
import { pollutants } from "../../constants/pollutants";
import { QUALITY_COLORS } from "../../constants/qualityColors";

interface LegendProps {
  selectedPollutant: string;
  isSidePanelOpen?: boolean;
  panelSize?: "normal" | "fullscreen" | "hidden";
  isComparisonPanelVisible?: boolean;
}

const Legend: React.FC<LegendProps> = ({
  selectedPollutant,
  isSidePanelOpen = false,
  panelSize = "normal",
  isComparisonPanelVisible = false,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const colors = QUALITY_COLORS;

  const pollutant = pollutants[selectedPollutant];
  const thresholds = pollutant?.thresholds;

  if (!thresholds) {
    return null;
  }

  const legendItems = [
    {
      label: t("quality.noData"),
      shortLabel: "N/A",
      color: colors.noData,
    },
    {
      label: t("quality.bon"),
      shortLabel: t("quality.bon"),
      color: colors.bon,
      range: `${thresholds.bon.min}-${thresholds.bon.max}`,
    },
    {
      label: t("quality.moyen"),
      shortLabel: t("quality.moyen"),
      color: colors.moyen,
      range: `${thresholds.moyen.min}-${thresholds.moyen.max}`,
    },
    {
      label: t("quality.degrade"),
      shortLabel: t("quality.degrade"),
      color: colors.degrade,
      range: `${thresholds.degrade.min}-${thresholds.degrade.max}`,
    },
    {
      label: t("quality.mauvais"),
      shortLabel: t("quality.mauvais"),
      color: colors.mauvais,
      range: `${thresholds.mauvais.min}-${thresholds.mauvais.max}`,
    },
    {
      label: t("quality.tresMauvais"),
      shortLabel: t("quality.tresMauvaisShort"),
      color: colors.tresMauvais,
      range: `${thresholds.tresMauvais.min}-${thresholds.tresMauvais.max}`,
    },
    {
      label: t("quality.extrMauvais"),
      shortLabel: t("quality.extrMauvaisShort"),
      color: colors.extrMauvais,
      range: `${thresholds.extrMauvais.min}+`,
    },
  ];

  // Position fixe de la légende pour éviter les décalages
  const getLegendPosition = () => {
    // Mobile : à droite, au-dessus de l'encart d'attribution.
    // Desktop : centrée sur la partie de la carte réellement visible, c'est-à-dire
    // en tenant compte de l'emprise du rail publiée en --rail-inset. Remplace un
    // `ml-[-20px]` posé à la main, qui compensait approximativement les contrôles
    // du bord gauche.
    return "absolute bottom-3 right-2 lg:right-auto lg:left-[calc(50%+var(--rail-inset,0px)/2)] lg:-translate-x-1/2 lg:max-w-[calc(100%-26rem)]";
  };

  const visibilityClass =
    isComparisonPanelVisible && panelSize !== "hidden"
      ? "hidden"
      : isSidePanelOpen && panelSize !== "hidden"
      ? "hidden md:block"
      : "block";

  return (
    <div
      className={`${getLegendPosition()} z-map-info transition-all duration-300 ease-in-out max-w-[95vw] md:max-w-none ${visibilityClass}`}
      data-tour="global-legend"
    >
      <div className="glass-3 rounded-[var(--r-md)] px-2 py-1.5 lg:px-3 lg:py-2">
        {/* Grille des seuils - verticale sur mobile et petits écrans, horizontale sur grands écrans */}
        <div className="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:gap-2 lg:justify-center">
          {legendItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center space-x-1 lg:space-x-1.5 group relative"
              title={
                item.range
                  ? `${item.label}: ${item.range} ${pollutant.unit}`
                  : item.label
              }
            >
              {/* Indicateur de couleur - à gauche du texte en RTL */}
              <div
                className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-sm border border-gray-300/50 flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />

              {/* Texte - RTL uniquement sur le texte */}
              <span className="text-[10px] lg:text-xs font-medium whitespace-nowrap text-[color:var(--fg)]" dir={isRtl ? "rtl" : "ltr"}>
                <span className="lg:hidden">{item.shortLabel}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </span>

              {/* Tooltip au hover - grands écrans uniquement */}
              {item.range && (
                <div className="hidden lg:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-map-tooltip">
                  {item.range} {pollutant.unit}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Legend;
