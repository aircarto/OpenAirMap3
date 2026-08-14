import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TemporalVisualizationState, TemporalControls } from "../../types";
import TemporalTimeline from "./TemporalTimeline";
import { cn } from "../../lib/utils";
import TourReplayButton from "../tour/TourReplayButton";

interface HistoricalPlaybackControlProps {
  state: TemporalVisualizationState;
  controls: TemporalControls;
  onToggleHistoricalMode: () => void;
  onOpenDatePanel: () => void;
  onSeekToDate?: (date: string) => void;
  onGoToPrevious?: () => void;
  onGoToNext?: () => void;
}

const HistoricalPlaybackControl: React.FC<HistoricalPlaybackControlProps> = ({
  state,
  controls,
  onToggleHistoricalMode,
  onOpenDatePanel,
  onSeekToDate,
  onGoToPrevious,
  onGoToNext,
}) => {
  const { t, i18n } = useTranslation();
  // Position initiale : même position que le panel de sélection (haut à droite : top-[60px] right-4)
  // right-4 = 16px, top-[60px] = 60px
  // On utilise useEffect pour calculer après le premier rendu car on a besoin de la largeur du conteneur
  const [position, setPosition] = useState({ x: window.innerWidth - 320 - 16, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Ajuster la position initiale après le premier rendu pour utiliser la vraie largeur
  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth || 320;
      const rightOffset = 16;
      setPosition({
        x: window.innerWidth - width - rightOffset,
        y: 60,
      });
    }
  }, []);

  // Réinitialiser la position si la fenêtre est redimensionnée
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const maxX = window.innerWidth - (containerRef.current.offsetWidth || 0);
        const maxY = window.innerHeight - (containerRef.current.offsetHeight || 0);
        setPosition((prev) => ({
          x: Math.min(prev.x, Math.max(0, maxX)),
          y: Math.min(prev.y, Math.max(0, maxY)),
        }));
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
    setIsDragging(true);
  };

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    if (state.loading) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  };

  const handleDragHandleTouchStart = (e: React.TouchEvent) => {
    if (state.loading) return;
    const t = e.touches[0];
    if (t) startDrag(t.clientX, t.clientY);
  };

  // Gérer le drag (souris + tactile)
  useEffect(() => {
    if (!isDragging) return;

    const updatePosition = (clientX: number, clientY: number) => {
      const newX = clientX - dragOffset.x;
      const newY = clientY - dragOffset.y;
      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 0);
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const onMouseMove = (e: MouseEvent) => updatePosition(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) {
        updatePosition(t.clientX, t.clientY);
        e.preventDefault();
      }
    };
    const onEnd = () => setIsDragging(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, dragOffset]);

  // Formater la date pour l'affichage (locale utilisateur)
  const formatDate = (dateString: string): string => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "--";
    const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "de" ? "de-DE" : i18n.language === "ar" ? "ar-SA" : i18n.language;
    return date.toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculer le pourcentage de progression
  const getProgressPercentage = (): number => {
    if (!state.currentDate || state.data.length === 0) return 0;
    
    const currentIndex = state.data.findIndex(
      (point) => point.timestamp === state.currentDate
    );

    if (state.data.length > 1 && currentIndex >= 0) {
      return (currentIndex / (state.data.length - 1)) * 100;
    }

    return 0;
  };

  const progressPercentage = getProgressPercentage();
  const hasData = state.data.length > 0;

  return (
    <div
      ref={containerRef}
      data-tour="historical-playback"
      className={cn(
        "fixed z-floating flex flex-col min-w-[280px] max-w-[320px]",
        isDragging ? "select-none opacity-95" : "transition-all duration-300",
        "max-w-[calc(100vw-16px)] sm:max-w-[320px]"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        userSelect: isDragging ? "none" : undefined,
      }}
      role="toolbar"
      aria-label={t("historical.playback")}
    >
      <div
        className={cn(
          "relative rounded-2xl shadow-2xl border border-gray-200/80 transition-all duration-300 isolate",
          "bg-white/98 backdrop-blur-md",
          "hover:shadow-3xl hover:border-gray-300/80",
          "p-4"
        )}
      >
        {/* Header : zone de drag dédiée + boutons d'action */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200/80">
          <div
            className={cn(
              "flex items-center gap-2 cursor-grab active:cursor-grabbing drag-handle",
              "px-2 py-1.5 -mx-2 -my-1.5 rounded-lg transition-colors duration-200",
              "hover:bg-gray-100/80 active:bg-gray-200/80 touch-manipulation",
              "group/drag",
              state.loading && "cursor-not-allowed opacity-75 pointer-events-none"
            )}
            onMouseDown={handleDragHandleMouseDown}
            onTouchStart={handleDragHandleTouchStart}
            role="button"
            tabIndex={-1}
            aria-label={t("historical.dragPanel")}
            title={t("historical.dragPanel")}
          >
            <div className="flex flex-col gap-0.5 opacity-60 group-hover/drag:opacity-100 transition-opacity">
              <div className="w-4 h-0.5 bg-gray-400 rounded-full" />
              <div className="w-4 h-0.5 bg-gray-400 rounded-full" />
              <div className="w-4 h-0.5 bg-gray-400 rounded-full" />
            </div>
            <h4 className="text-sm font-semibold text-gray-900 select-none">
              {t("historical.playbackShort")}
            </h4>
          </div>
          <div className="flex items-center gap-1">
            <TourReplayButton tourId="historical_mode" />
            <button
              type="button"
              onClick={onOpenDatePanel}
              disabled={state.loading}
              className={cn(
                "p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50/80",
                "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-500 disabled:hover:bg-transparent",
                "active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 flex items-center justify-center"
              )}
              title={t("historical.openDatePanel")}
              aria-label={t("historical.openDatePanel")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onToggleHistoricalMode}
              disabled={state.loading}
              className={cn(
                "p-2 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50/80",
                "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-500 disabled:hover:bg-transparent",
                "active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 flex items-center justify-center"
              )}
              title={t("historical.disableHistorical")}
              aria-label={t("historical.disableHistorical")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Indicateur de chargement */}
        {state.loading && (
          <div className="mb-4 p-4 bg-blue-50/90 backdrop-blur-sm border border-blue-200/80 rounded-xl">
            <div className="flex items-center justify-center gap-3">
              <svg
                className="animate-spin w-5 h-5 text-blue-600 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                {t("historical.loadingDataInProgress")}
              </span>
            </div>
          </div>
        )}

        {/* Date actuelle + indication heure locale */}
        <div className={cn("mb-4 text-center", state.loading && "opacity-50 pointer-events-none")}>
          <div className="text-xs font-medium text-gray-700 mb-1">{t("historical.currentDate")}</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">
            {formatDate(state.currentDate)}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-600" role="status">
            <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t("historical.localTime")}</span>
          </div>
        </div>

        {/* Timeline interactive (barre de progression) */}
        {hasData && !state.loading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs font-medium text-gray-700 mb-2">
              <span>{t("historical.temporalNavigation")}</span>
              <span className="tabular-nums text-gray-800">{Math.round(progressPercentage)} %</span>
            </div>
            <TemporalTimeline
              startDate={state.startDate}
              endDate={state.endDate}
              currentDate={state.currentDate}
              dataPoints={state.data}
              onSeek={onSeekToDate || controls.onCurrentDateChange}
              timeStep={state.timeStep}
              disabled={state.loading}
            />
          </div>
        )}

        {/* Contrôles de lecture — style liquid glass harmonisé */}
        {hasData && !state.loading && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              type="button"
              onClick={onGoToPrevious || (() => {
                const i = state.data.findIndex((p) => p.timestamp === state.currentDate);
                if (i > 0) controls.onCurrentDateChange(state.data[i - 1].timestamp);
              })}
              className={cn(
                "p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center",
                "bg-white/70 backdrop-blur-sm border border-gray-200/60",
                "text-gray-700 hover:bg-gray-100/80 hover:border-gray-300/60 hover:text-gray-900",
                "transition-all duration-200 active:scale-95 touch-manipulation",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
              title={t("historical.previous")}
              aria-label={t("historical.previous")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={controls.onPlayPause}
              className={cn(
                "p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center",
                "bg-white/70 backdrop-blur-sm border border-gray-200/60",
                "text-gray-700 hover:bg-gray-100/80 hover:border-gray-300/60 hover:text-gray-900",
                "transition-all duration-200 active:scale-95 touch-manipulation",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
              title={state.isPlaying ? t("historical.pause") : t("historical.play")}
              aria-label={state.isPlaying ? t("historical.pause") : t("historical.play")}
              aria-pressed={state.isPlaying}
            >
              {state.isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={onGoToNext || (() => {
                const i = state.data.findIndex((p) => p.timestamp === state.currentDate);
                if (i >= 0 && i < state.data.length - 1) {
                  controls.onCurrentDateChange(state.data[i + 1].timestamp);
                }
              })}
              className={cn(
                "p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center",
                "bg-white/70 backdrop-blur-sm border border-gray-200/60",
                "text-gray-700 hover:bg-gray-100/80 hover:border-gray-300/60 hover:text-gray-900",
                "transition-all duration-200 active:scale-95 touch-manipulation",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
              title={t("historical.next")}
              aria-label={t("historical.next")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Vitesse de lecture — style liquid glass harmonisé */}
        {hasData && !state.loading && (
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-medium text-gray-700">{t("historical.speedLabel")}</span>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {[0.5, 1, 2, 4, 8].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => controls.onSpeedChange(speed)}
                  disabled={state.loading}
                  className={cn(
                    "min-w-[32px] min-h-[32px] px-2.5 py-1 rounded-full text-xs font-medium transition-all touch-manipulation",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "disabled:bg-gray-200/80 disabled:text-gray-400 disabled:cursor-not-allowed",
                    !state.loading &&
                      (state.playbackSpeed === speed
                        ? "bg-gray-200/70 backdrop-blur-sm border border-gray-300/50 text-gray-900"
                        : "bg-white/70 backdrop-blur-sm border border-gray-200/60 text-gray-700 hover:bg-gray-100/80 hover:border-gray-300/60 hover:text-gray-900 active:scale-95")
                  )}
                  aria-label={t("historical.speed", { value: speed })}
                  aria-pressed={state.playbackSpeed === speed}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* État (lecture / pause + nombre de points) */}
        <div className={cn("flex items-center justify-between text-xs", state.loading && "opacity-50")}>
          <div className="flex items-center gap-2">
            {state.loading ? (
              <>
                <svg className="animate-spin w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-gray-700">{t("historical.loading")}</span>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    state.isPlaying ? "bg-gray-600 animate-pulse" : "bg-gray-400"
                  )}
                  aria-hidden
                />
                <span className="text-gray-700">{state.isPlaying ? t("historical.play") : t("historical.pause")}</span>
              </>
            )}
          </div>
          {hasData && !state.loading && (
            <span className="text-gray-600 tabular-nums">{t("historical.pointsCount", { count: state.data.length })}</span>
          )}
        </div>

        {!hasData && !state.loading && (
          <div className="text-xs text-center text-gray-600 py-4" role="status">
            {t("historical.noDataLoaded")}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalPlaybackControl;

