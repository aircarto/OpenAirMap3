import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  MobileAirSensor,
  MobileAirRoute,
  MOBILEAIR_POLLUTANT_MAPPING,
} from "../../types";
import { pollutants } from "../../constants/pollutants";
import { MobileAirService } from "../../services/MobileAirService";
import HistoricalTimeRangeSelector from "../controls/HistoricalTimeRangeSelector";
import { getCustomRangeISO, type TimeRange } from "../../utils/historicalTimeRange";

interface MobileAirSidePanelProps {
  isOpen: boolean;
  selectedPollutant: string;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange?: (size: "normal" | "fullscreen" | "hidden") => void;
  onSensorSelected?: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  panelSize?: "normal" | "fullscreen" | "hidden";
}

type PanelSize = "normal" | "fullscreen" | "hidden";

const MobileAirSidePanel: React.FC<MobileAirSidePanelProps> = ({
  isOpen,
  selectedPollutant,
  onClose,
  onHidden,
  onSizeChange,
  onSensorSelected,
  panelSize: externalPanelSize,
}) => {
  const [internalPanelSize, setInternalPanelSize] =
    useState<PanelSize>("normal");
  const [sensors, setSensors] = useState<MobileAirSensor[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    type: "preset",
    preset: "7d",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Utiliser la taille externe si fournie, sinon la taille interne
  const currentPanelSize = externalPanelSize || internalPanelSize;

  const mobileAirService = useMemo(() => new MobileAirService(), []);

  const loadSensors = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sensorsList = mobileAirService.getSensors();
      if (sensorsList.length === 0) {
        // Si pas encore chargés, les récupérer
        await mobileAirService.fetchData({
          pollutant: selectedPollutant,
          timeStep: "instantane",
          sources: ["mobileair"],
        });
        setSensors(mobileAirService.getSensors());
      } else {
        setSensors(sensorsList);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des capteurs MobileAir:", err);
      setError("Erreur lors du chargement des capteurs");
    } finally {
      setLoading(false);
    }
  }, [selectedPollutant, mobileAirService]);

  // Charger la liste des capteurs au montage du composant
  useEffect(() => {
    if (isOpen) {
      loadSensors();
    }
  }, [isOpen, loadSensors]);

  const handleSensorToggle = (sensorId: string) => {
    setSelectedSensor(selectedSensor === sensorId ? null : sensorId);
  };

  const handleSelectFirst = () => {
    const availableSensors = sensors.filter((s) => s.displayMap);
    if (availableSensors.length > 0) {
      setSelectedSensor(availableSensors[0].sensorId);
    }
  };

  const handleDeselectAll = () => {
    setSelectedSensor(null);
  };

  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
  };

  const handleLoadRoutes = () => {
    if (!selectedSensor) {
      setError("Veuillez sélectionner un capteur");
      return;
    }

    const { startDate, endDate } = getDateRange(timeRange);

    if (onSensorSelected) {
      onSensorSelected(selectedSensor, { startDate, endDate });
    }
  };

  const getDateRange = (
    timeRange: TimeRange
  ): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = now.toISOString();

    // Si c'est une plage personnalisée, utiliser les dates fournies
    if (timeRange.type === "custom" && timeRange.custom) {
      return getCustomRangeISO(timeRange.custom);
    }

    // Sinon, utiliser les périodes prédéfinies
    let startDate: Date;

    switch (timeRange.preset) {
      case "3h":
        startDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        break;
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate,
    };
  };

  const formatLastSeen = (sensor: MobileAirSensor): string => {
    const lastSeenDate = new Date(sensor.time);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
    } else if (diffHours > 0) {
      return `Il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`;
    } else if (diffMinutes > 0) {
      return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    } else {
      return "À l'instant";
    }
  };

  const getSensorStatus = (
    sensor: MobileAirSensor
  ): { status: string; color: string } => {
    if (sensor.connected) {
      return { status: "Connecté", color: "text-green-600" };
    }

    const lastSeenDate = new Date(sensor.time);
    const now = new Date();
    const diffHours =
      (now.getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return { status: "Récent", color: "text-yellow-600" };
    } else {
      return { status: "Inactif", color: "text-red-600" };
    }
  };

  const handlePanelSizeChange = (newSize: PanelSize) => {
    if (onSizeChange) {
      onSizeChange(newSize);
    } else {
      setInternalPanelSize(newSize);
    }

    if (newSize === "hidden" && onHidden) {
      onHidden();
    }
  };

  const availableSensors = sensors.filter((s) => s.displayMap);
  const isPollutantSupported = Object.values(
    MOBILEAIR_POLLUTANT_MAPPING
  ).includes(selectedPollutant);

  const getPanelClasses = () => {
  const baseClasses =
    "bg-white shadow-xl flex flex-col border-r border-gray-200 transition-all duration-300 h-full md:h-[calc(100vh-64px)]";

    switch (currentPanelSize) {
      case "fullscreen":
        return `${baseClasses} w-full`;
      case "hidden":
        // Retirer complètement du flux pour éviter l'espace réservé
        return `${baseClasses} hidden`;
      case "normal":
      default:
        // Responsive: plein écran sur mobile, largeur réduite pour les petits écrans en paysage
        return `${baseClasses} w-full sm:w-[300px] md:w-[350px] lg:w-[400px] xl:w-[450px]`;
    }
  };

  if (!isOpen) {
    return null;
  }

  const renderPanelContent = () => (
    <div className={getPanelClasses()}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            Capteurs MobileAir
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 truncate">
            {pollutants[selectedPollutant]?.name || selectedPollutant}
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
                ? "Rétrécir le panel" 
                : "Agrandir le panel"
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
            title="Rabattre le panel"
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

      {/* Contenu */}
      {currentPanelSize !== "hidden" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* Message informatif sur la limitation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800 mb-2">
                  Limitation de sélection
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Pour protéger l'API Air Carto, vous ne pouvez sélectionner
                  qu'un seul capteur MobileAir à la fois.
                </p>
                <div className="bg-blue-100 rounded-md p-3">
                  <p className="text-xs font-medium text-blue-800 mb-1">
                    💡 Conseil : Sélectionnez un capteur, analysez ses données,
                    puis changez de capteur si nécessaire.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Message d'erreur si polluant non supporté */}
          {!isPollutantSupported && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 mb-2">
                    Polluant non supporté par MobileAir
                  </h3>
                  <p className="text-sm text-red-700 mb-3">
                    Le polluant{" "}
                    <strong>
                      {pollutants[selectedPollutant]?.name || selectedPollutant}
                    </strong>{" "}
                    ne peut pas être analysé avec les capteurs MobileAir.
                  </p>
                  <div className="bg-red-100 rounded-md p-3">
                    <p className="text-xs font-medium text-red-800 mb-1">
                      Polluants supportés par MobileAir :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                        PM₁
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                        PM₂.₅
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                        PM₁₀
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sélection de la période */}
          <div
            className={`border border-gray-200 rounded-lg p-3 sm:p-4 ${
              !isPollutantSupported ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Période d'analyse
            </h3>
            <HistoricalTimeRangeSelector
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
            />
          </div>

          {/* Liste des capteurs */}
          <div
            className={`border border-gray-200 rounded-lg p-3 sm:p-4 ${
              !isPollutantSupported ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Capteurs disponibles ({availableSensors.length})
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectFirst}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sélectionner le premier
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                >
                  Désélectionner
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-500">
                    Chargement des capteurs...
                  </span>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <svg
                    className="w-6 h-6 text-red-400 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableSensors.map((sensor) => {
                  const isSelected = selectedSensor === sensor.sensorId;
                  const status = getSensorStatus(sensor);

                  return (
                    <button
                      key={sensor.sensorId}
                      onClick={() => handleSensorToggle(sensor.sensorId)}
                      className={`w-full flex items-center p-3 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? "bg-blue-50 border-blue-200"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>

                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900">
                            {sensor.sensorId}
                          </h4>
                          <span
                            className={`text-xs font-medium ${status.color}`}
                          >
                            {status.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Dernière activité: {formatLastSeen(sensor)}
                        </p>
                        {sensor.wifi_signal && (
                          <p className="text-xs text-gray-500">
                            Signal WiFi: {sensor.wifi_signal} dBm
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bouton de chargement des parcours */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <button
              onClick={handleLoadRoutes}
              disabled={!selectedSensor || !isPollutantSupported}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                !selectedSensor || !isPollutantSupported
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}
            >
              {!selectedSensor
                ? "Sélectionnez un capteur"
                : `Charger le parcours du capteur ${selectedSensor}`}
            </button>

            {selectedSensor && (
              <p className="text-xs text-gray-600 mt-2 text-center">
                Capteur {selectedSensor} sélectionné
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

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

export default MobileAirSidePanel;
