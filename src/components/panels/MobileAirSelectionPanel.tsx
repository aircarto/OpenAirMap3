import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MobileAirSensor, MOBILEAIR_POLLUTANT_MAPPING } from "../../types";
import { MobileAirService } from "../../services/MobileAirService";
import HistoricalTimeRangeSelector from "../controls/HistoricalTimeRangeSelector";
import type { TimeRange } from "../../utils/historicalTimeRange";

interface MobileAirSelectionPanelProps {
  isOpen: boolean;
  initialPollutant: string;
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

const MobileAirSelectionPanel: React.FC<MobileAirSelectionPanelProps> = ({
  isOpen,
  initialPollutant,
  onClose,
  onHidden,
  onSizeChange,
  onSensorSelected,
  panelSize: externalPanelSize,
}) => {
  const { t } = useTranslation();
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
  const [checkingRoutes, setCheckingRoutes] = useState(false);
  const [noRouteData, setNoRouteData] = useState(false);
  const hasLoadedRef = useRef<boolean>(false);
  const initialPollutantRef = useRef<string>(initialPollutant);

  // Utiliser la taille externe si fournie, sinon la taille interne
  const currentPanelSize = externalPanelSize || internalPanelSize;

  const mobileAirService = useMemo(() => new MobileAirService(), []);

  const loadSensors = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sensorsList = mobileAirService.getSensors();
      if (sensorsList.length === 0) {
        // Si pas encore chargés, les récupérer avec le polluant initial
        await mobileAirService.fetchData({
          pollutant: initialPollutantRef.current,
          timeStep: "instantane",
          sources: ["mobileair"],
        });
        setSensors(mobileAirService.getSensors());
      } else {
        setSensors(sensorsList);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des capteurs MobileAir:", err);
      setError("loadError");
    } finally {
      setLoading(false);
    }
  }, [mobileAirService]);

  // Mettre à jour la référence du polluant initial si le panel vient de s'ouvrir
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      initialPollutantRef.current = initialPollutant;
    }
  }, [isOpen, initialPollutant]);

  // Charger la liste des capteurs uniquement lors de l'ouverture du panel
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      loadSensors();
      hasLoadedRef.current = true;
    } else if (!isOpen) {
      // Réinitialiser le flag quand le panel est fermé
      hasLoadedRef.current = false;
    }
  }, [isOpen, loadSensors]);

  const handleSensorToggle = (sensorId: string) => {
    setNoRouteData(false);
    setSelectedSensor(selectedSensor === sensorId ? null : sensorId);
  };

  const handleSelectFirst = () => {
    const availableSensors = sensors.filter((s) => s.displayMap);
    if (availableSensors.length > 0) {
      setSelectedSensor(availableSensors[0].sensorId);
    }
  };

  const handleDeselectAll = () => {
    setNoRouteData(false);
    setSelectedSensor(null);
  };

  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    setNoRouteData(false);
    setTimeRange(newTimeRange);
  };

  const handleLoadRoutes = async () => {
    if (!selectedSensor) {
      setError("selectSensorRequired");
      return;
    }

    const { startDate, endDate } = getDateRange(timeRange);

    setNoRouteData(false);
    setCheckingRoutes(true);
    try {
      // Vérifier au préalable que le capteur possède bien des trajets GPS
      // sur la période : certains capteurs (nouvelle "manière de comm'")
      // remontent dans la liste sans alimenter la source de parcours.
      const devices = await mobileAirService.fetchData({
        pollutant: initialPollutant,
        timeStep: "instantane",
        sources: ["mobileair"],
        selectedSensors: [selectedSensor],
        mobileAirPeriod: { startDate, endDate },
      });

      if (devices.length === 0) {
        setNoRouteData(true);
        return;
      }

      if (onSensorSelected) {
        onSensorSelected(selectedSensor, { startDate, endDate });
      }
    } catch (err) {
      console.error(
        "Erreur lors de la vérification des parcours MobileAir:",
        err
      );
      // En cas d'erreur de vérification, laisser le flux normal tenter le chargement
      if (onSensorSelected) {
        onSensorSelected(selectedSensor, { startDate, endDate });
      }
    } finally {
      setCheckingRoutes(false);
    }
  };

  const getDateRange = (
    timeRange: TimeRange
  ): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = now.toISOString();

    // Si c'est une plage personnalisée, utiliser les dates fournies
    if (timeRange.type === "custom" && timeRange.custom) {
      // Créer les dates en heure LOCALE (sans Z), puis convertir en UTC
      // Cela permet d'avoir 00:00-23:59 en heure locale, pas en UTC
      const startDate = new Date(timeRange.custom.startDate + "T00:00:00");
      const endDate = new Date(timeRange.custom.endDate + "T23:59:59.999");

      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
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
      return t("panels.mobileAirSelection.lastSeenDays", { count: diffDays });
    }
    if (diffHours > 0) {
      return t("panels.mobileAirSelection.lastSeenHours", { count: diffHours });
    }
    if (diffMinutes > 0) {
      return t("panels.mobileAirSelection.lastSeenMinutes", { count: diffMinutes });
    }
    return t("panels.mobileAirSelection.lastSeenNow");
  };

  const getSensorStatus = (
    sensor: MobileAirSensor
  ): { status: string; color: string } => {
    if (sensor.connected) {
      return { status: t("panels.mobileAirSelection.statusConnected"), color: "text-green-600" };
    }

    const lastSeenDate = new Date(sensor.time);
    const now = new Date();
    const diffHours =
      (now.getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return { status: t("panels.mobileAirSelection.statusRecent"), color: "text-yellow-600" };
    }
    return { status: t("panels.mobileAirSelection.statusInactive"), color: "text-red-600" };
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

  if (!isOpen) {
    return null;
  }

  const availableSensors = sensors.filter((s) => s.displayMap);
  const isPollutantSupported = Object.values(
    MOBILEAIR_POLLUTANT_MAPPING
  ).includes(initialPollutant);

  const getPanelClasses = () => {
  const baseClasses =
    "bg-white shadow-xl flex flex-col border-r border-gray-200 transition-all duration-300 h-full md:h-[calc(100vh-64px)] relative z-[1500]";

    switch (currentPanelSize) {
      case "fullscreen":
        // En fullscreen, utiliser absolute pour ne pas affecter le layout de la carte
        return `${baseClasses} absolute inset-0 w-full`;
      case "hidden":
        // Retirer complètement du flux pour éviter l'espace réservé
        return `${baseClasses} hidden`;
      case "normal":
      default:
        // Responsive: plein écran sur mobile, largeur réduite pour les petits écrans en paysage
        return `${baseClasses} w-full sm:w-[350px] md:w-[450px] lg:w-[600px] xl:w-[650px]`;
    }
  };

  return (
    <div className={getPanelClasses()} data-testid="mobileair-selection-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {t("panels.mobileAirSelection.title")}
            </h2>
            {/* Rappel visuel du bouton de réouverture */}
            <div className="p-1 rounded bg-green-600 border border-green-600" title={t("panels.mobileAirSelection.reopenButtonTooltip")}>
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="5"
                  y="4"
                  width="14"
                  height="16"
                  rx="2"
                  ry="2"
                  strokeWidth={1.5}
                />
                <path
                  strokeLinecap="round"
                  strokeWidth={1.5}
                  d="M9 8h6M9 12h6M9 16h3"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 16c1.2-1 1.2-3 0-4"
                />
              </svg>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">
            {t(`pollutants.${initialPollutant}`, { defaultValue: initialPollutant })}
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

          {/* Bouton fermer */}
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={t("panels.closePanel")}
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
                  {t("panels.mobileAirSelection.selectionLimitTitle")}
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  {t("panels.mobileAirSelection.selectionLimitDescription")}
                </p>
                <div className="bg-blue-100 rounded-md p-3">
                  <p className="text-xs font-medium text-blue-800 mb-1">
                    💡 {t("panels.mobileAirSelection.selectionLimitTip")}
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
                    {t("panels.mobileAirSelection.pollutantNotSupportedTitle")}
                  </h3>
                  <p className="text-sm text-red-700 mb-3">
                    {t("panels.mobileAirSelection.pollutantNotSupportedDescription", {
                      pollutant: t(`pollutants.${initialPollutant}`, { defaultValue: initialPollutant }),
                    })}
                  </p>
                  <div className="bg-red-100 rounded-md p-3">
                    <p className="text-xs font-medium text-red-800 mb-1">
                      {t("panels.mobileAirSelection.supportedPollutantsLabel")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                        {t("pollutants.pm1")}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                        {t("pollutants.pm25")}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                        {t("pollutants.pm10")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Liste des capteurs */}
          <div
            className={`border border-gray-200 rounded-lg p-3 sm:p-4 ${
              !isPollutantSupported ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                {t("panels.mobileAirSelection.sensorsAvailable", { count: availableSensors.length })}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectFirst}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {t("panels.selectFirst")}
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                >
                  {t("panels.mobileAirSelection.deselect")}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-500">
                    {t("panels.loadSensors")}
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
                  <p className="text-sm text-red-600">{t(`panels.mobileAirSelection.${error}`)}</p>
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
                          {t("panels.mobileAirSelection.lastActivity", { value: formatLastSeen(sensor) })}
                        </p>
                        {sensor.wifi_signal && (
                          <p className="text-xs text-gray-500">
                            {t("panels.mobileAirSelection.wifiSignal", { value: sensor.wifi_signal })}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sélection de la période */}
          <div
            className={`border border-gray-200 rounded-lg p-3 sm:p-4 ${
              !isPollutantSupported ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {t("panels.mobileAirSelection.periodTitle")}
            </h3>
            <HistoricalTimeRangeSelector
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
            />
          </div>

          {/* Bouton de chargement des parcours */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <button
              onClick={handleLoadRoutes}
              disabled={!selectedSensor || !isPollutantSupported || checkingRoutes}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                !selectedSensor || !isPollutantSupported || checkingRoutes
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}
            >
              {checkingRoutes
                ? t("panels.mobileAirSelection.checkingRoutes")
                : !selectedSensor
                ? t("panels.mobileAirSelection.selectSensor")
                : t("panels.mobileAirSelection.loadSensorRoute", { sensorId: selectedSensor })}
            </button>

            {selectedSensor && !noRouteData && !checkingRoutes && (
              <p className="text-xs text-gray-600 mt-2 text-center">
                {t("panels.mobileAirSelection.sensorSelected", { sensorId: selectedSensor })}
              </p>
            )}

            {noRouteData && !checkingRoutes && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start">
                <svg
                  className="w-5 h-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-amber-800">
                  {t("panels.mobileAirSelection.noRouteData")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAirSelectionPanel;
