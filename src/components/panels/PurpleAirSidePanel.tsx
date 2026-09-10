import React from "react";
import { useTranslation } from "react-i18next";
import { StationInfo } from "../../types";
import { getAirQualityLevel } from "../../utils";
import { pollutants } from "../../constants/pollutants";
import { QUALITY_COLORS } from "../../constants/qualityColors";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";
import PanelReopenBadge from "./PanelReopenBadge";

interface PurpleAirDeviceData {
  rssi: number;
  uptime: number;
  confidence: number;
  temperature: number;
  humidity: number;
  pm1Value: number;
  pm25Value: number;
  pm10Value: number;
}

interface PurpleAirSidePanelProps {
  isOpen: boolean;
  selectedStation: StationInfo | null;
  deviceData?: PurpleAirDeviceData;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange: (size: PanelSize) => void;
  initialPollutant: string;
  panelSize: PanelSize;
}

const PurpleAirSidePanel: React.FC<PurpleAirSidePanelProps> = ({
  isOpen,
  selectedStation,
  deviceData,
  onClose,
  onHidden,
  onSizeChange,
  initialPollutant,
  panelSize,
}) => {
  const { t } = useTranslation();

  // Récupérer les valeurs des 3 polluants
  const pm1Value = deviceData.pm1Value;
  const pm25Value = deviceData.pm25Value;
  const pm10Value = deviceData.pm10Value;

  // Calculer les niveaux de qualité pour chaque polluant
  const pm1Level =
    pm1Value > 0
      ? getAirQualityLevel(pm1Value, pollutants.pm1.thresholds)
      : "default";
  const pm25Level = getAirQualityLevel(
    pm25Value,
    pollutants.pm25.thresholds
  );
  const pm10Level =
    pm10Value > 0
      ? getAirQualityLevel(pm10Value, pollutants.pm10.thresholds)
      : "default";

  // Couleurs des cartes selon le niveau de qualité
  const getCardColor = (level: string) => {
    const color =
      QUALITY_COLORS[level as keyof typeof QUALITY_COLORS] ||
      QUALITY_COLORS.noData;
    return {
      backgroundColor: `${color}20`, // 20% d'opacité
      borderColor: color,
    };
  };

  // Couleurs des indicateurs selon le niveau de qualité
  const getIndicatorColor = (level: string) => {
    return (
      QUALITY_COLORS[level as keyof typeof QUALITY_COLORS] ||
      QUALITY_COLORS.noData
    );
  };

  // Couleurs du texte selon le niveau de qualité
  const getTextColor = (level: string) => {
    return (
      QUALITY_COLORS[level as keyof typeof QUALITY_COLORS] ||
      QUALITY_COLORS.noData
    );
  };

  // Labels des niveaux de qualité (i18n)
  const getQualityLabel = (level: string) =>
    level === "default" ? t("quality.noData") : t(`quality.${level}`);

  // Lien vers PurpleAir
  const purpleAirUrl = `https://www.purpleair.com/map?select=${selectedStation?.id || ""}`;

  // Fonction pour rendre le contenu du panel
  const renderPanelContent = () => {
    if (!selectedStation || !deviceData) return null;
    
    return (
      <SidePanelShell
        isOpen={isOpen}
        panelSize={panelSize}
        onSizeChange={onSizeChange}
        onHidden={onHidden}
        testId="purpleair-side-panel"
        title={selectedStation.name}
        subtitle={t("panels.purpleAirSidePanel.sensorLabel", {
          id: selectedStation.id,
        })}
        badge={
          <PanelReopenBadge
            label={t("panels.stationSidePanel.reopenButtonTooltip")}
          />
        }
      >
      {/* Informations générales */}
      <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
        <h3 className="text-sm font-medium text-[color:var(--fg-muted)] mb-3">
          {t("panels.purpleAirSidePanel.sensorInfoTitle")}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-[color:var(--fg-muted)] block text-xs mb-1">
              {t("panels.purpleAirSidePanel.confidence")}
            </span>
            <span
              className={`font-medium block ${
                deviceData.confidence >= 90
                  ? "text-green-600"
                  : deviceData.confidence >= 70
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {deviceData.confidence}%
            </span>
            <span className="text-xs text-[color:var(--fg-muted)]">
              {deviceData.confidence >= 90
                ? t("panels.purpleAirSidePanel.confidenceExcellent")
                : deviceData.confidence >= 70
                ? t("panels.purpleAirSidePanel.confidenceGood")
                : t("panels.purpleAirSidePanel.confidenceLow")}
            </span>
          </div>
          <div>
            <span className="text-[color:var(--fg-muted)] block text-xs mb-1">
              {t("panels.purpleAirSidePanel.temperature")}
            </span>
            <span className="font-medium text-[color:var(--fg)]">
              {Math.round(((deviceData.temperature - 32) * 5) / 9)}°C
            </span>
          </div>
          <div>
            <span className="text-[color:var(--fg-muted)] block text-xs mb-1">{t("panels.purpleAirSidePanel.humidity")}</span>
            <span className="font-medium text-[color:var(--fg)]">
              {deviceData.humidity}%
            </span>
          </div>
        </div>
      </div>

      {/* Cartes des polluants */}
      <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
        <h3 className="text-sm font-medium text-[color:var(--fg-muted)] mb-3 sm:mb-4">
          {t("panels.purpleAirSidePanel.airQualityMeasures")}
        </h3>

        <div className="space-y-3 sm:space-y-4">
          {/* PM1 */}
          {pm1Value > 0 && (
            <div
              className="p-3 sm:p-4 rounded-[var(--r-md)] border-2"
              style={{
                backgroundColor: getCardColor(pm1Level).backgroundColor,
                borderColor: getCardColor(pm1Level).borderColor,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getIndicatorColor(pm1Level) }}
                  ></div>
                  <span className="text-sm font-medium text-[color:var(--fg-muted)]">
                    {t("pollutants.pm1")}
                  </span>
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ color: getTextColor(pm1Level) }}
                >
                  {pm1Value} µg/m³
                </span>
              </div>
              <div
                className="text-sm font-medium"
                style={{ color: getTextColor(pm1Level) }}
              >
                {getQualityLabel(pm1Level)}
              </div>
            </div>
          )}

          {/* PM2.5 */}
          <div
            className="p-3 sm:p-4 rounded-[var(--r-md)] border-2"
            style={{
              backgroundColor: getCardColor(pm25Level).backgroundColor,
              borderColor: getCardColor(pm25Level).borderColor,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: getIndicatorColor(pm25Level),
                  }}
                ></div>
                <span className="text-sm font-medium text-[color:var(--fg-muted)]">
                  {t("pollutants.pm25")}
                </span>
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: getTextColor(pm25Level) }}
              >
                {pm25Value} µg/m³
              </span>
            </div>
            <div
              className="text-sm font-medium"
              style={{ color: getTextColor(pm25Level) }}
            >
              {getQualityLabel(pm25Level)}
            </div>
          </div>

          {/* PM10 */}
          {pm10Value > 0 && (
            <div
              className="p-3 sm:p-4 rounded-[var(--r-md)] border-2"
              style={{
                backgroundColor: getCardColor(pm10Level).backgroundColor,
                borderColor: getCardColor(pm10Level).borderColor,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: getIndicatorColor(pm10Level),
                    }}
                  ></div>
                  <span className="text-sm font-medium text-[color:var(--fg-muted)]">
                    {t("pollutants.pm10")}
                  </span>
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ color: getTextColor(pm10Level) }}
                >
                  {pm10Value} µg/m³
                </span>
              </div>
              <div
                className="text-sm font-medium"
                style={{ color: getTextColor(pm10Level) }}
              >
                {getQualityLabel(pm10Level)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bouton PurpleAir */}
      <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
        <a
          href={purpleAirUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 sm:py-3 px-4 rounded-[var(--r-sm)] transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span className="text-sm sm:text-base">
            {t("panels.purpleAirSidePanel.viewOnPurpleAir")}
          </span>
        </a>

        <div className="text-xs text-[color:var(--fg-muted)] mt-3 space-y-1">
          <p>{t("panels.purpleAirSidePanel.realtimeCommunity")}</p>
          <p>
            {t("panels.purpleAirSidePanel.confidenceDescription")}
          </p>
        </div>
      </div>
    </SidePanelShell>
    );
  };

  if (!selectedStation || !deviceData) {
    return null;
  }
  
  // Le montage, l'animation de sortie et son portail appartiennent
  // désormais à SidePanelShell : il ne reste que la garde sur les données.
  return renderPanelContent();
};

export default PurpleAirSidePanel;

