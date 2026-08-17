import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { StationInfo } from "../../types";

interface SensorCommunitySidePanelProps {
  isOpen: boolean;
  selectedStation: StationInfo | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange?: (size: "normal" | "fullscreen" | "hidden") => void;
  initialPollutant: string;
  panelSize?: "normal" | "fullscreen" | "hidden";
}

type PanelSize = "normal" | "fullscreen" | "hidden";

const SensorCommunitySidePanel: React.FC<SensorCommunitySidePanelProps> = ({
  isOpen,
  selectedStation,
  onClose,
  onHidden,
  onSizeChange,
  initialPollutant,
  panelSize: externalPanelSize,
}) => {
  const { t } = useTranslation();
  const [internalPanelSize, setInternalPanelSize] =
    useState<PanelSize>("normal");
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Utiliser la taille externe si fournie, sinon la taille interne
  const currentPanelSize = externalPanelSize || internalPanelSize;

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

  const handlePanelSizeChange = (newSize: PanelSize) => {
    // Si on passe à "hidden", déclencher l'animation de sortie
    if (newSize === "hidden" && currentPanelSize !== "hidden") {
      // IMPORTANT: Mettre à jour immédiatement la taille pour retirer le panel du flux flex
      // Cela permet à la carte de se redimensionner immédiatement
      if (onSizeChange) {
        onSizeChange(newSize);
      } else {
        setInternalPanelSize(newSize);
      }
      
      // Ensuite, déclencher l'animation de sortie
      setIsAnimatingOut(true);
      
      // Nettoyer le timeout précédent s'il existe
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      
      // Après l'animation, nettoyer l'état et appeler le callback
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimatingOut(false);
        if (onHidden) {
          onHidden();
        }
      }, 300); // Durée de l'animation
    } else {
      // Pour les autres changements, réinitialiser l'animation et mettre à jour immédiatement
      setIsAnimatingOut(false);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (onSizeChange) {
        onSizeChange(newSize);
      } else {
        setInternalPanelSize(newSize);
      }
    }
  };

  // Réinitialiser l'animation quand le panel s'ouvre
  useEffect(() => {
    if (isOpen && currentPanelSize !== "hidden") {
      setIsAnimatingOut(false);
    }
  }, [isOpen, currentPanelSize]);

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Réinitialiser la taille du panel quand la station change
  useEffect(() => {
    if (isOpen && selectedStation) {
      setInternalPanelSize("normal");
    } else {
      setInternalPanelSize("hidden");
    }
  }, [isOpen, selectedStation]);

  const getPanelClasses = () => {
    const baseClasses =
      "bg-white shadow-xl flex flex-col border-r border-gray-200 h-full md:h-[calc(100vh-64px)] relative z-panel";

    // Si on est en train d'animer la sortie, utiliser fixed pour rester visible pendant l'animation
    // mais le panelSize est déjà "hidden" donc le panel est retiré du flux flex
    if (isAnimatingOut) {
      // Calculer la largeur actuelle pour l'animation
      const widthClass = "w-full sm:w-[320px] md:w-[400px] lg:w-[600px] xl:w-[650px]";
      // Utiliser fixed pour positionner le panel pendant l'animation
      // will-change optimise les performances de l'animation
      return `${baseClasses} fixed left-0 top-0 ${widthClass} animate-slide-out-left will-change-transform`;
    }

    // Classes d'animation d'entrée
    const animationClasses = currentPanelSize !== "hidden" && !isAnimatingOut
      ? "animate-slide-in-left"
      : "";

    switch (currentPanelSize) {
      case "fullscreen":
        // En fullscreen, utiliser absolute pour ne pas affecter le layout de la carte
        return `${baseClasses} absolute inset-0 w-full transition-all duration-300 ${animationClasses}`;
      case "hidden":
        // Retirer complètement du flux pour éviter l'espace réservé
        // Mais si on anime, on ne doit pas être ici car isAnimatingOut gère ce cas
        return `${baseClasses} hidden`;
      case "normal":
      default:
        // Responsive: plein écran sur mobile, largeur réduite pour les petits écrans en paysage
        return `${baseClasses} w-full sm:w-[320px] md:w-[400px] lg:w-[600px] xl:w-[650px] transition-all duration-300 ${animationClasses}`;
    }
  };

  // Fonction pour rendre le contenu du panel
  const renderPanelContent = () => {
    if (!selectedStation) return null;
    
    return (
      <div className={getPanelClasses()} data-testid="sensorcommunity-side-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {selectedStation.name || selectedStation.id}
            </h2>
            {/* Rappel visuel du bouton de réouverture */}
            <div className="p-1 rounded bg-blue-600 border border-blue-600" title={t("panels.stationSidePanel.reopenButtonTooltip")}>
              <svg
                className="w-3 h-3 text-white"
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
            </div>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {t("panels.sensorCommunitySidePanel.sensorLabel", { sensorId })}
          </p>
        </div>

        {/* Contrôles unifiés du panel */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Bouton agrandir/rétrécir */}
          <button
            onClick={() =>
              handlePanelSizeChange(
                currentPanelSize === "fullscreen" ? "normal" : "fullscreen"
              )
            }
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={
              currentPanelSize === "fullscreen"
                ? t("panels.shrinkPanel")
                : t("panels.expandPanel")
            }
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {currentPanelSize === "fullscreen" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              )}
            </svg>
          </button>

          {/* Bouton rabattre */}
          <button
            onClick={() => handlePanelSizeChange("hidden")}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={t("panels.collapsePanel")}
              aria-label={t("panels.collapsePanel")}
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Contenu - masqué quand currentPanelSize === 'hidden' */}
      {currentPanelSize !== "hidden" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* Graphique Grafana avec contrôles intégrés */}
          <div className="flex-1 min-h-80 sm:min-h-96 md:min-h-[28rem]">
            <h3 className="text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              {t("panels.sensorCommunitySidePanel.dataHistoryTitle")}
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
              {/* Sélection des polluants - en haut du graphique (GRISÉE) */}
              <div className="border border-gray-200 rounded-lg mb-3 sm:mb-4 opacity-50 pointer-events-none">
                <button
                  disabled
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 text-left rounded-lg cursor-not-allowed"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <svg
                      className="w-4 h-4 text-gray-600 flex-shrink-0"
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
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {t("panels.sensorCommunitySidePanel.pollutantsDisplayed")}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
                      {t("panels.sensorCommunitySidePanel.notAvailable")}
                    </span>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
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
              <div className="bg-gray-50 rounded-lg p-4 mb-3 sm:mb-4">
                <div className="aspect-video w-full">
                  <iframe
                    src={grafanaUrl}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    title={t("panels.sensorCommunitySidePanel.iframeTitle", { sensorId })}
                    className="rounded-lg"
                  />
                </div>
                <div className="mt-3 text-xs text-gray-500">
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
                <div className="flex-1 border border-gray-200 rounded-lg p-2.5 sm:p-3">
                  <div className="flex items-center space-x-2 mb-2.5 sm:mb-3">
                    <svg
                      className="w-4 h-4 text-gray-600 flex-shrink-0"
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
                    <span className="text-sm font-medium text-gray-700">
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
                        className={`px-1.5 py-1 text-xs rounded-md transition-all duration-200 ${
                          !active
                            ? "bg-gray-100 text-gray-500 cursor-not-allowed opacity-50"
                            : key === "24h"
                            ? "bg-[#4271B3] text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {t(`panels.sensorCommunitySidePanel.${labelKey}`)}
                      </button>
                    ))}
                  </div>
                  {/* Bouton période personnalisée grisé */}
                  <button
                    disabled
                    className="w-full px-2.5 py-1.5 text-xs rounded-md transition-all duration-200 border bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
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
                <div className="flex-1 border border-gray-200 rounded-lg p-2.5 sm:p-3">
                  <div className="flex items-center space-x-2 mb-2.5 sm:mb-3">
                    <svg
                      className="w-4 h-4 text-gray-600 flex-shrink-0"
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
                    <span className="text-sm font-medium text-gray-700">
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
                        className={`px-1.5 py-1 text-xs rounded-md transition-all duration-200 ${
                          !active
                            ? "bg-gray-100 text-gray-500 cursor-not-allowed opacity-50"
                            : key === "instantane"
                            ? "bg-[#4271B3] text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {t(`panels.sensorCommunitySidePanel.${labelKey}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note d'information */}
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>{t("panels.sensorCommunitySidePanel.noteLabel")}:</strong>{" "}
                  {t("panels.sensorCommunitySidePanel.controlsNote")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  };

  if (!isOpen || !selectedStation) {
    return null;
  }
  
  // Si on anime la sortie ET que panelSize est "hidden", rendre via portal
  // Cela permet de sortir le panel du conteneur flex pour que la carte se redimensionne immédiatement
  if (isAnimatingOut && currentPanelSize === "hidden") {
    return createPortal(renderPanelContent(), document.body);
  }
  
  // Si le panel est "hidden" et qu'on n'anime pas, ne rien rendre
  if (currentPanelSize === "hidden") {
    return null;
  }
  
  // Sinon, rendre normalement dans le conteneur flex
  return renderPanelContent();
};

export default SensorCommunitySidePanel;

