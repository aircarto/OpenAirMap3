import React, { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TemporalDataPoint } from "../../types";

interface TemporalTimelineProps {
  startDate: string;
  endDate: string;
  currentDate: string;
  dataPoints: TemporalDataPoint[];
  onSeek: (date: string) => void;
  timeStep: string;
  disabled?: boolean;
}

const TemporalTimeline: React.FC<TemporalTimelineProps> = ({
  startDate,
  endDate,
  currentDate,
  dataPoints,
  onSeek,
  timeStep,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const effectiveStartDate =
    dataPoints.length > 0 ? dataPoints[0].timestamp : startDate;
  const effectiveEndDate =
    dataPoints.length > 0
      ? dataPoints[dataPoints.length - 1].timestamp
      : endDate;

  // Calculer la position du curseur en pourcentage
  const getCurrentPosition = (): number => {
    if (!effectiveStartDate || !effectiveEndDate || !currentDate) return 0;

    const start = new Date(effectiveStartDate).getTime();
    const end = new Date(effectiveEndDate).getTime();
    const current = new Date(currentDate).getTime();

    if (end <= start) return 0;

    return Math.max(
      0,
      Math.min(100, ((current - start) / (end - start)) * 100)
    );
  };

  // Calculer la position d'un timestamp en pourcentage
  const getTimestampPosition = (timestamp: string): number => {
    if (!effectiveStartDate || !effectiveEndDate) return 0;

    const start = new Date(effectiveStartDate).getTime();
    const end = new Date(effectiveEndDate).getTime();
    const time = new Date(timestamp).getTime();

    if (end <= start) return 0;

    return Math.max(0, Math.min(100, ((time - start) / (end - start)) * 100));
  };

  // Convertir une position en pourcentage en timestamp
  const positionToTimestamp = useCallback(
    (position: number): string => {
      if (!effectiveStartDate || !effectiveEndDate) return currentDate;

      const start = new Date(effectiveStartDate).getTime();
      const end = new Date(effectiveEndDate).getTime();
      const time = start + (position / 100) * (end - start);

      return new Date(time).toISOString();
    },
    [effectiveStartDate, effectiveEndDate, currentDate]
  );

  // Gérer le clic sur la timeline
  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const position = (x / rect.width) * 100;
    const timestamp = positionToTimestamp(position);

    onSeek(timestamp);
  };

  // Gérer le survol de la timeline
  const handleTimelineHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const position = (x / rect.width) * 100;
    setHoverPosition(position);
  };

  // Gérer la sortie du survol
  const handleTimelineLeave = () => {
    setHoverPosition(null);
  };

  // Gérer le début du drag
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    event.preventDefault();
    setIsDragging(true);
    handleTimelineClick(event);
  };

  // Gérer le drag
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const timestamp = positionToTimestamp(position);

      onSeek(timestamp);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onSeek, effectiveStartDate, effectiveEndDate, positionToTimestamp]);

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

  // Calculer la densité des données pour l'affichage
  const getDataDensity = (position: number): number => {
    const timestamp = positionToTimestamp(position);
    const time = new Date(timestamp).getTime();
    const window = 24 * 60 * 60 * 1000; // 24 heures

    return dataPoints.filter((point) => {
      const pointTime = new Date(point.timestamp).getTime();
      return Math.abs(pointTime - time) <= window / 2;
    }).length;
  };

  const currentPosition = getCurrentPosition();

  return (
    <div className="space-y-3">
      {/* Timeline principale — style liquid glass harmonisé */}
      <div className="relative">
        <div
          ref={timelineRef}
          role="slider"
          tabIndex={0}
          aria-disabled={disabled}
          aria-valuenow={currentPosition}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("historical.timeline")}
          className={`
            relative h-9 rounded-xl cursor-pointer overflow-hidden
            bg-white/40 backdrop-blur-sm border border-gray-200/50
            ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/50 hover:border-gray-300/50"}
            transition-colors duration-200
          `}
          onClick={handleTimelineClick}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const fakeEvt = { clientX: rect.left + (rect.width * currentPosition) / 100 } as React.MouseEvent;
                handleTimelineClick(fakeEvt);
              }
            }
          }}
          onMouseMove={handleTimelineHover}
          onMouseLeave={handleTimelineLeave}
          onMouseDown={handleMouseDown}
        >
          {/* Bande de progression (déjà parcouru) */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-xl bg-gray-200/40 transition-all duration-300"
            style={{ width: `${currentPosition}%` }}
          />

          {/* Marqueurs de données */}
          {dataPoints.map((point, index) => {
            const position = getTimestampPosition(point.timestamp);
            const density = getDataDensity(position);
            const height = Math.max(2, Math.min(6, (density / 10) * 4 + 2));

            return (
              <div
                key={`${point.timestamp}-${index}`}
                className="absolute top-1/2 -translate-y-1/2 w-0.5 bg-gray-400/50 rounded-full"
                style={{
                  left: `${position}%`,
                  height: `${height}px`,
                }}
                title={`${formatDate(point.timestamp)} - ${point.deviceCount} appareils`}
              />
            );
          })}

          {/* Curseur de position actuelle */}
          <div
            className={`
              absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
              ${disabled ? "bg-gray-400" : "bg-gray-600"}
              transition-all duration-200
              ${isDragging ? "scale-110 bg-gray-700" : ""}
            `}
            style={{ left: `${currentPosition}%` }}
          />

          {/* Indicateur de survol */}
          {hoverPosition !== null && !disabled && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gray-500/60 rounded-full pointer-events-none"
              style={{ left: `${hoverPosition}%` }}
            />
          )}
        </div>

        {/* Labels de dates — heure locale (début / fin uniquement) */}
        <div className="flex justify-between items-baseline mt-2 text-xs text-gray-700 gap-2">
          <span className="tabular-nums flex-shrink-0">{formatDate(effectiveStartDate)}</span>
          <span className="tabular-nums flex-shrink-0">{formatDate(effectiveEndDate)}</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-600 text-center" role="note">
          {t("historical.localTime")}
        </p>
      </div>

      {dataPoints.length > 0 && (
        <div className="flex justify-end text-xs text-gray-600">
          {t("historical.pointsCount", { count: dataPoints.length })}
        </div>
      )}

      {/* Barre de progression
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${currentPosition}%` }}
        />
      </div> */}
    </div>
  );
};

export default TemporalTimeline;
