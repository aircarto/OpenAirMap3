import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  PollutionEpisodeService,
  PollutionEpisode,
} from "../../services/PollutionEpisodeService";

interface PollutionEpisodeCalendarProps {
  selectedPollutant: string;
  selectedZone?: string;
  onDateSelect?: (date: string) => void;
  selectedStartDate?: string;
  selectedEndDate?: string;
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  maxDateRange?: number;
  className?: string;
}

const PollutionEpisodeCalendar: React.FC<PollutionEpisodeCalendarProps> = ({
  selectedPollutant,
  selectedZone,
  onDateSelect,
  selectedStartDate,
  selectedEndDate,
  onDateRangeChange,
  maxDateRange,
  className = "",
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("fr")
    ? "fr-FR"
    : i18n.language?.startsWith("en")
    ? "en-GB"
    : i18n.language?.startsWith("es")
    ? "es-ES"
    : i18n.language?.startsWith("it")
    ? "it-IT"
    : i18n.language?.startsWith("de")
    ? "de-DE"
    : i18n.language?.startsWith("ar")
    ? "ar-SA"
    : "fr-FR";
  const [episodes, setEpisodes] = useState<PollutionEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredDatePosition, setHoveredDatePosition] = useState<{ x: number; y: number } | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(
    selectedStartDate || null
  );
  const [rangeEnd, setRangeEnd] = useState<string | null>(
    selectedEndDate || null
  );

  const episodeService = useMemo(() => new PollutionEpisodeService(), []);

  // Synchroniser les dates sélectionnées avec les props
  useEffect(() => {
    if (selectedStartDate) setRangeStart(selectedStartDate);
    if (selectedEndDate) setRangeEnd(selectedEndDate);
  }, [selectedStartDate, selectedEndDate]);

  // Charger les épisodes
  useEffect(() => {
    const loadEpisodes = async () => {
      setLoading(true);
      setError(null);
      try {
        const filteredEpisodes = await episodeService.getFilteredEpisodes(
          selectedPollutant,
          selectedZone
        );
        setEpisodes(filteredEpisodes);
      } catch (err) {
        console.error("Erreur lors du chargement des épisodes:", err);
        setError("calendar.loadError");
      } finally {
        setLoading(false);
      }
    };

    if (selectedPollutant) {
      loadEpisodes();
    } else {
      setLoading(false);
    }
  }, [selectedPollutant, selectedZone, episodeService]);

  // Grouper les épisodes par date
  const episodesByDate = useMemo(() => {
    return episodeService.groupEpisodesByDate(episodes);
  }, [episodes, episodeService]);

  // Trouver le dernier épisode (le plus récent)
  const lastEpisode = useMemo(() => {
    if (episodes.length === 0) return null;
    
    // Trier les épisodes par date décroissante et prendre le premier
    const sorted = [...episodes].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Décroissant
    });
    
    return sorted[0];
  }, [episodes]);

  // Obtenir les jours du mois
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Date[] = [];

    // Ajouter les jours du mois précédent pour compléter la première semaine
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (
      let i = startingDayOfWeek - 1;
      i >= 0;
      i--
    ) {
      days.push(new Date(year, month - 1, daysInPrevMonth - i));
    }

    // Ajouter les jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Ajouter les jours du mois suivant pour compléter la dernière semaine
    const remainingDays = 42 - days.length; // 6 semaines * 7 jours
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  };

  // Formater la date en YYYY-MM-DD en utilisant les méthodes locales pour éviter les décalages UTC
  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Obtenir le niveau d'alerte pour une date
  const getEpisodeLevel = (dateKey: string): {
    niveau: number;
    niveau_code: string;
    niveau_libelle: string;
  } | null => {
    const dateEpisodes = episodesByDate.get(dateKey);
    if (!dateEpisodes || dateEpisodes.length === 0) return null;
    return episodeService.getHighestLevelForDate(dateEpisodes);
  };

  // Obtenir les départements concernés pour une date
  const getDepartmentsForDate = (dateKey: string): string[] => {
    const dateEpisodes = episodesByDate.get(dateKey);
    if (!dateEpisodes || dateEpisodes.length === 0) return [];
    
    // Extraire les départements uniques
    const departments = new Set<string>();
    dateEpisodes.forEach((episode) => {
      if (episode.zone_libelle) {
        departments.add(episode.zone_libelle);
      }
    });
    
    return Array.from(departments).sort();
  };

  // Obtenir la couleur selon le niveau
  const getLevelColor = (niveau: number | null): string => {
    if (niveau === null) return "";
    if (niveau === 2) return "bg-red-500/70 text-white"; // Alerte avec opacité
    if (niveau === 1) return "bg-orange-400/70 text-white"; // Information-recommandation avec opacité
    return "";
  };

  // Vérifier si une date est dans la plage sélectionnée
  const isInRange = (dateKey: string): boolean => {
    if (!rangeStart || !rangeEnd) return false;
    return dateKey >= rangeStart && dateKey <= rangeEnd;
  };

  // Vérifier si une date est la date de début ou de fin
  const isRangeBoundary = (dateKey: string): boolean => {
    return dateKey === rangeStart || dateKey === rangeEnd;
  };

  // Gérer le clic sur une date
  const handleDateClick = (dateKey: string) => {
    if (onDateRangeChange) {
      if (rangeStart && !rangeEnd) {
        // Si on a déjà une date de début, définir la date de fin
        if (dateKey < rangeStart) {
          // Si la nouvelle date est avant la date de début, inverser
          setRangeEnd(rangeStart);
          setRangeStart(dateKey);
          onDateRangeChange(dateKey, rangeStart);
        } else {
          // Vérifier la limite de période si maxDateRange est défini
          if (maxDateRange) {
            const start = new Date(rangeStart);
            const end = new Date(dateKey);
            const diffInDays = Math.ceil(
              (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffInDays > maxDateRange) {
              // Ajuster la date de fin à la limite maximale
              const adjustedEnd = new Date(start);
              adjustedEnd.setDate(adjustedEnd.getDate() + maxDateRange);
              const adjustedEndKey = formatDateKey(adjustedEnd);
              setRangeEnd(adjustedEndKey);
              onDateRangeChange(rangeStart, adjustedEndKey);
              return;
            }
          }
          setRangeEnd(dateKey);
          onDateRangeChange(rangeStart, dateKey);
        }
      } else if (!rangeStart) {
        // Commencer une nouvelle sélection
        setRangeStart(dateKey);
        setRangeEnd(null);
      } else {
        // Réinitialiser la sélection
        setRangeStart(dateKey);
        setRangeEnd(null);
      }
    } else if (onDateSelect) {
      // Sélection simple
      onDateSelect(dateKey);
    }
  };

  // Vérifier si une date est aujourd'hui
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Vérifier si une date est dans le mois actuel
  const isCurrentMonth = (date: Date): boolean => {
    return (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  };

  // Vérifier si une date est dans le futur
  const isFuture = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  // Navigation du mois
  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2024, i, 1).toLocaleDateString(locale, { month: "long" })
    );
  }, [locale]);
  const dayNames = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2024, 0, i).toLocaleDateString(locale, { weekday: "short" })
    );
  }, [locale]);

  // Si pas de polluant, on affiche quand même le calendrier mais sans les épisodes

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center space-x-2 text-gray-600">
          <svg
            className="animate-spin w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{t("calendar.loadingEpisodes")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-md ${className}`}>
        <p className="text-sm text-red-700">{t(error)}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg rtl-on-ar ${className}`}>
      {/* En-tête du calendrier */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title={t("calendar.monthPrevious")}
        >
          <svg
            className="w-5 h-5 text-gray-600"
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
        <div className="flex items-center space-x-2">
          <h3 className="text-base font-semibold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title={t("calendar.today")}
          >
            {t("calendar.today")}
          </button>
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title={t("calendar.monthNext")}
        >
          <svg
            className="w-5 h-5 text-gray-600"
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

      {/* Légende */}
      {selectedPollutant && (
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded bg-orange-400/70"></div>
            <span className="text-gray-600">{t("calendar.information")}</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded bg-red-500/70"></div>
            <span className="text-gray-600">{t("calendar.alert")}</span>
          </div>
        </div>
      )}

      {/* Grille du calendrier */}
      <div className="p-3">
        {/* Noms des jours */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Jours du mois */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const dateKey = formatDateKey(day);
            const episodeLevel = getEpisodeLevel(dateKey);
            const levelColor = getLevelColor(episodeLevel?.niveau || null);
            const inRange = isInRange(dateKey);
            const isBoundary = isRangeBoundary(dateKey);
            const isCurrentMonthDay = isCurrentMonth(day);
            const isTodayDate = isToday(day);
            const isFutureDate = isFuture(day);

            return (
              <button
                key={`${dateKey}-${index}`}
                type="button"
                onClick={() => !isFutureDate && handleDateClick(dateKey)}
                onMouseEnter={(e) => {
                  setHoveredDate(dateKey);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDatePosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredDate(null);
                  setHoveredDatePosition(null);
                }}
                disabled={!isCurrentMonthDay || isFutureDate}
                className={`
                  relative h-9 w-full rounded-md text-xs font-medium transition-all
                  ${
                    !isCurrentMonthDay || isFutureDate
                      ? "text-gray-300 cursor-not-allowed"
                      : isTodayDate
                      ? "ring-2 ring-blue-500"
                      : "text-gray-700 hover:bg-gray-100"
                  }
                  ${
                    inRange && isCurrentMonthDay && !isFutureDate
                      ? "bg-blue-100 text-blue-700"
                      : ""
                  }
                  ${
                    isBoundary && isCurrentMonthDay && !isFutureDate
                      ? "bg-blue-600 text-white font-bold"
                      : ""
                  }
                  ${levelColor && isCurrentMonthDay && !isFutureDate ? levelColor : ""}
                  ${
                    hoveredDate === dateKey && isCurrentMonthDay && !inRange && !isFutureDate
                      ? "bg-gray-100"
                      : ""
                  }
                `}
                title={day.toLocaleDateString(locale)}
              >
                <span>{day.getDate()}</span>
                {episodeLevel && (
                  <div
                    className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
                      episodeLevel.niveau === 2
                        ? "bg-red-700/70"
                        : "bg-orange-600/70"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tooltip personnalisé pour les épisodes */}
      {hoveredDate && hoveredDatePosition && (() => {
        const hoveredEpisodeLevel = getEpisodeLevel(hoveredDate);
        if (!hoveredEpisodeLevel) return null;
        
        return (
          <div
            className="fixed z-popover bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
            style={{
              left: `${hoveredDatePosition.x}px`,
              top: `${hoveredDatePosition.y}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="font-semibold mb-1">
              {new Date(hoveredDate).toLocaleDateString(locale, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="mb-2">
              <span className="font-medium">{hoveredEpisodeLevel.niveau_libelle}</span>
            </div>
            {(() => {
              const departments = getDepartmentsForDate(hoveredDate);
              if (departments.length > 0) {
                return (
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="font-medium mb-1">{t("calendar.departmentsConcerned")}</div>
                    <div className="text-gray-300">
                      {departments.join(", ")}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        );
      })()}

      {/* Informations sur la période sélectionnée */}
      {rangeStart && rangeEnd && (
        <div className="px-3 py-2 bg-blue-50 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-blue-800">
            <svg
              className="w-4 h-4 text-blue-600"
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
            <span>
              {t("historical.periodSelectedDays", {
                days: Math.ceil(
                  (new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) /
                    (1000 * 60 * 60 * 24)
                ),
              })}
            </span>
          </div>
        </div>
      )}

      {/* Informations sur les épisodes */}
      {selectedPollutant && episodes.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {t("calendar.episodesCount", { count: episodes.length })}
            </span>
            {lastEpisode && (
              <button
                type="button"
                onClick={() => {
                  const lastEpisodeDate = new Date(lastEpisode.date);
                  
                  // Naviguer vers le mois du dernier épisode
                  setCurrentMonth(
                    new Date(lastEpisodeDate.getFullYear(), lastEpisodeDate.getMonth(), 1)
                  );
                  
                  if (onDateRangeChange) {
                    // Sélectionner la date du dernier épisode comme date de début et de fin
                    onDateRangeChange(lastEpisode.date, lastEpisode.date);
                    setRangeStart(lastEpisode.date);
                    setRangeEnd(lastEpisode.date);
                  } else if (onDateSelect) {
                    onDateSelect(lastEpisode.date);
                  }
                }}
                className="ml-2 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center space-x-1"
                title={`${t("calendar.selectLastEpisode")}: ${new Date(lastEpisode.date).toLocaleDateString(locale)}`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <span>{t("calendar.lastEpisodeLabel")}</span>
              </button>
            )}
          </div>
        </div>
      )}
      {selectedPollutant && episodes.length === 0 && !loading && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          {t("calendar.noEpisodeFound")}
        </div>
      )}
      {!selectedPollutant && (
        <div className="px-3 py-2 bg-amber-50 border-t border-gray-200 text-xs text-amber-700">
          {t("calendar.selectPollutantForEpisodes")}
        </div>
      )}

      {/* Limitation de période */}
      {maxDateRange && (
        <div className="px-3 py-2 bg-amber-50 border-t border-gray-200 text-xs text-amber-700">
          {t("historical.maxPeriodDays", { days: maxDateRange })}
        </div>
      )}
    </div>
  );
};

export default PollutionEpisodeCalendar;

