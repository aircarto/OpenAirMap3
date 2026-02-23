import React from "react";
import { useTranslation } from "react-i18next";
import { TemporalDataPoint } from "../../types";

interface TemporalPlaybackControlsProps {
  isPlaying: boolean;
  currentDate: string;
  startDate: string;
  endDate: string;
  playbackSpeed: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (date: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
  dataPointsCount: number;
  dataPoints: TemporalDataPoint[];
}

const TemporalPlaybackControls: React.FC<TemporalPlaybackControlsProps> = ({
  isPlaying,
  currentDate,
  startDate,
  endDate,
  playbackSpeed,
  onPlayPause,
  onStop,
  onSpeedChange,
  onSeek,
  onPrevious,
  onNext,
  disabled = false,
  dataPointsCount,
  dataPoints,
}) => {
  const { t } = useTranslation();
  // Vitesses de lecture disponibles
  const speeds = [
    { value: 0.5, label: "0.5x" },
    { value: 1, label: "1x" },
    { value: 2, label: "2x" },
    { value: 4, label: "4x" },
    { value: 8, label: "8x" },
  ];

  // Formater la date pour l'affichage
  const formatDate = (dateString: string): string => {
    if (!dateString) {
      return "--";
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculer le pourcentage de progression
  const getProgressPercentage = (): number => {
    if (!currentDate) {
      return 0;
    }

    const currentIndex = dataPoints.findIndex(
      (point) => point.timestamp === currentDate
    );

    if (dataPoints.length > 1 && currentIndex >= 0) {
      return (currentIndex / (dataPoints.length - 1)) * 100;
    }

    if (dataPoints.length === 1 && currentIndex === 0) {
      return 100;
    }

    if (!startDate || !endDate) {
      return 0;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const current = new Date(currentDate).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, ((current - start) / (end - start)) * 100)
    );
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div className="space-y-4">
      {/* Contrôles principaux */}
      <div className="flex items-center justify-center space-x-3">
        {/* Bouton Précédent */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={disabled}
          className={`
            p-2 rounded-full transition-all duration-200
            ${
              disabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 shadow-sm"
            }
          `}
          title="Étape précédente"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Bouton Play/Pause */}
        <button
          type="button"
          onClick={onPlayPause}
          disabled={disabled || dataPointsCount === 0}
          className={`
            p-3 rounded-full transition-all duration-200 transform
            ${
              disabled || dataPointsCount === 0
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : isPlaying
                ? "bg-red-500 text-white hover:bg-red-600 shadow-lg scale-105"
                : "bg-green-500 text-white hover:bg-green-600 shadow-lg hover:scale-105"
            }
          `}
          title={isPlaying ? "Pause" : "Lecture"}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Bouton Stop */}
        <button
          type="button"
          onClick={onStop}
          disabled={disabled || !isPlaying}
          className={`
            p-2 rounded-full transition-all duration-200
            ${
              disabled || !isPlaying
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 shadow-sm"
            }
          `}
          title="Arrêter"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>

        {/* Bouton Suivant */}
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className={`
            p-2 rounded-full transition-all duration-200
            ${
              disabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 shadow-sm"
            }
          `}
          title="Étape suivante"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progression</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>

        {/* <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div> */}

      </div>

      {/* Contrôles de vitesse */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Vitesse :</span>

        <div className="flex space-x-1">
          {speeds.map((speed) => (
            <button
              key={speed.value}
              type="button"
              onClick={() => onSpeedChange(speed.value)}
              disabled={disabled}
              className={`
                px-3 py-1 rounded-md text-sm font-medium transition-all duration-200
                ${
                  disabled
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : playbackSpeed === speed.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                }
              `}
            >
              {speed.label}
            </button>
          ))}
        </div>
      </div>

      {/* Informations sur les données */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isPlaying ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            <span className="text-gray-700">
              {isPlaying ? t("historical.playing") : t("historical.paused")}
            </span>
          </div>

          <div className="text-gray-500">
            {t("historical.pointsCount", { count: dataPointsCount })}
          </div>
        </div>

        {playbackSpeed !== 1 && (
          <div className="mt-2 text-xs text-blue-600">
            {t("historical.playbackSpeedLabel", { value: playbackSpeed })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemporalPlaybackControls;
