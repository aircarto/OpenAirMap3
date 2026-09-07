import React from "react";
import { useTranslation } from "react-i18next";
import { StationInfo } from "../../types";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";
import PanelReopenBadge from "./PanelReopenBadge";

interface SensorCommunitySidePanelProps {
  isOpen: boolean;
  selectedStation: StationInfo | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange: (size: PanelSize) => void;
  initialPollutant: string;
  panelSize: PanelSize;
}

const SensorCommunitySidePanel: React.FC<SensorCommunitySidePanelProps> = ({
  isOpen,
  selectedStation,
  onClose,
  onHidden,
  onSizeChange,
  initialPollutant,
  panelSize,
}) => {
  const { t } = useTranslation();

  // Extraire l'ID du capteur depuis l'ID du device (format: sensorId_locationId)
  // ou depuis l'ID de la station si c'est directement le sensorId
  const getSensorId = (): string => {
    if (!selectedStation) return "";
    // Vérifier si l'ID contient un underscore (format sensorId_locationId)
    if (selectedStation.id.includes("_")) {
      return selectedStation.id.split("_")[0];
    }
    return selectedStation.id;
  };

  const sensorId = getSensorId();

  // URL Grafana pour le capteur
  const grafanaUrl = `https://api-rrd.madavi.de:3000/grafana/d-solo/000000004/single-sensor-view-for-map?orgId=1&var-node=${sensorId}&panelId=2&theme=light`;

  // Fonction pour rendre le contenu du panel
  const renderPanelContent = () => {
    if (!selectedStation) return null;
    
    return (
      <SidePanelShell
        isOpen={isOpen}
        panelSize={panelSize}
        onSizeChange={onSizeChange}
        onHidden={onHidden}
        testId="sensorcommunity-side-panel"
        title={selectedStation.name || selectedStation.id}
        subtitle={t("panels.sensorCommunitySidePanel.sensorLabel", { sensorId })}
        badge={
          <PanelReopenBadge
            label={t("panels.stationSidePanel.reopenButtonTooltip")}
          />
        }
      >
      {/* Graphique Grafana avec contrôles intégrés */}
      <div className="flex-1 min-h-80 sm:min-h-96 md:min-h-[28rem]">
        <h3 className="text-sm font-medium text-[color:var(--fg-muted)] mb-2 sm:mb-3">
          {t("panels.sensorCommunitySidePanel.dataHistoryTitle")}
        </h3>
        <div className="bg-white/60 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3 sm:p-4">
          {/* Sélection des polluants - en haut du graphique (GRISÉE) */}
          <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] mb-3 sm:mb-4 opacity-50 pointer-events-none">
            <button
              disabled
              className="w-full flex items-center justify-between p-2.5 sm:p-3 text-left rounded-[var(--r-md)] cursor-not-allowed"
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <svg
                  className="w-4 h-4 text-[color:var(--fg-muted)] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span className="text-sm font-medium text-[color:var(--fg-muted)] truncate">
                  {t("panels.sensorCommunitySidePanel.pollutantsDisplayed")}
                </span>
                <span className="text-xs text-[color:var(--fg-muted)] bg-[rgb(16_32_56_/_0.06)] px-2 py-1 rounded-full flex-shrink-0">
                  {t("panels.sensorCommunitySidePanel.notAvailable")}
                </span>
              </div>
              <svg
                className="w-4 h-4 text-[color:var(--fg-muted)] transition-transform flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Graphique Grafana */}
          <div className="bg-[rgb(16_32_56_/_0.03)] rounded-[var(--r-md)] p-4 mb-3 sm:mb-4">
            <div className="aspect-video w-full">
              <iframe
                src={grafanaUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                title={t("panels.sensorCommunitySidePanel.iframeTitle", { sensorId })}
                className="rounded-[var(--r-md)]"
              />
            </div>
            <div className="mt-3 text-xs text-[color:var(--fg-muted)]">
              <p>
                {t("panels.sensorCommunitySidePanel.chartProvidedBy")}{" "}
                <a
                  href="https://grafana.sensor.community"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {t("panels.sensorCommunitySidePanel.grafanaLink")}
                </a>
              </p>
            </div>
          </div>

          {/* Contrôles du graphique - en bas du graphique */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Contrôles de la période - Seul 24h est actif */}
            <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-2.5 sm:p-3">
              <div className="flex items-center space-x-2 mb-2.5 sm:mb-3">
                <svg
                  className="w-4 h-4 text-[color:var(--fg-muted)] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-[color:var(--fg-muted)]">
                  {t("panels.sensorCommunitySidePanel.historyLabel")}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {[
                  { key: "3h", labelKey: "period3h", active: false },
                  { key: "24h", labelKey: "period24h", active: true },
                  { key: "7d", labelKey: "period7d", active: false },
                  { key: "30d", labelKey: "period30d", active: false },
                ].map(({ key, labelKey, active }) => (
                  <button
                    key={key}
                    disabled={!active}
                    className={`px-1.5 py-1 text-xs rounded-[var(--r-sm)] transition-all duration-200 ${
                      !active
                        ? "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] cursor-not-allowed opacity-50"
                        : key === "24h"
                        ? "bg-[#4271B3] text-white shadow-sm"
                        : "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] hover:bg-black/10"
                    }`}
                  >
                    {t(`panels.sensorCommunitySidePanel.${labelKey}`)}
                  </button>
                ))}
              </div>
              {/* Bouton période personnalisée grisé */}
              <button
                disabled
                className="w-full px-2.5 py-1.5 text-xs rounded-[var(--r-sm)] transition-all duration-200 border bg-[rgb(16_32_56_/_0.03)] text-[color:var(--fg-muted)] border-[rgb(16_32_56_/_0.09)] cursor-not-allowed opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {t("historical.customPeriod")}
                  </span>
                </div>
              </button>
            </div>

            {/* Contrôles du pas de temps - Seul Scan 2min est actif */}
            <div className="flex-1 border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-2.5 sm:p-3">
              <div className="flex items-center space-x-2 mb-2.5 sm:mb-3">
                <svg
                  className="w-4 h-4 text-[color:var(--fg-muted)] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span className="text-sm font-medium text-[color:var(--fg-muted)]">
                  {t("controls.timeStep")}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { key: "instantane", labelKey: "timeStepScan2min", active: true },
                  { key: "quartHeure", labelKey: "timeStep15min", active: false },
                  { key: "heure", labelKey: "timeStep1h", active: false },
                  { key: "jour", labelKey: "timeStep1j", active: false },
                ].map(({ key, labelKey, active }) => (
                  <button
                    key={key}
                    disabled={!active}
                    className={`px-1.5 py-1 text-xs rounded-[var(--r-sm)] transition-all duration-200 ${
                      !active
                        ? "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] cursor-not-allowed opacity-50"
                        : key === "instantane"
                        ? "bg-[#4271B3] text-white shadow-sm"
                        : "bg-[rgb(16_32_56_/_0.06)] text-[color:var(--fg-muted)] hover:bg-black/10"
                    }`}
                  >
                    {t(`panels.sensorCommunitySidePanel.${labelKey}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Note d'information */}
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-[var(--r-md)]">
            <p className="text-xs text-blue-700">
              <strong>{t("panels.sensorCommunitySidePanel.noteLabel")}:</strong>{" "}
              {t("panels.sensorCommunitySidePanel.controlsNote")}
            </p>
          </div>
        </div>
      </div>
    </SidePanelShell>
    );
  };

  if (!selectedStation) {
    return null;
  }
  
  // Le montage, l'animation de sortie et son portail appartiennent
  // désormais à SidePanelShell : il ne reste que la garde sur les données.
  return renderPanelContent();
};

export default SensorCommunitySidePanel;

