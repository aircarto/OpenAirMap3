import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "../ui/button-group";
import { cn } from "../../lib/utils";

export interface TimeRange {
  type: "preset" | "custom";
  preset?: "3h" | "24h" | "7d" | "30d";
  custom?: {
    startDate: string;
    endDate: string;
  };
}

interface HistoricalTimeRangeSelectorProps {
  timeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  className?: string;
  timeStep?: string; // Pas de temps actuel pour valider les limites
}

// Fonction utilitaire pour calculer la limite maximale en jours selon le pas de temps
export const getMaxHistoryDays = (timeStep?: string): number | null => {
  if (!timeStep) return null;
  
  switch (timeStep) {
    case "instantane":
      return 60; // 2 mois = ~60 jours
    case "quartHeure":
      return 180; // 6 mois = ~180 jours
    case "heure":
    case "jour":
      return null; // Pas de limite
    default:
      return null;
  }
};

// Fonction pour formater l'affichage de la limite maximale
const formatMaxDaysDisplay = (maxDays: number): string => {
  if (maxDays === 180) {
    return "6 mois";
  }
  return `${maxDays} jours`;
};

// Fonction pour calculer le nombre de jours entre deux dates
const getDaysDifference = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Fonction pour calculer le nombre de jours pour un preset
const getPresetDays = (preset: "3h" | "24h" | "7d" | "30d"): number => {
  switch (preset) {
    case "3h":
      return 0.125; // ~0.125 jour
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
  }
};

const HistoricalTimeRangeSelector: React.FC<
  HistoricalTimeRangeSelectorProps
> = ({ timeRange, onTimeRangeChange, className = "", timeStep }) => {
  const { t } = useTranslation();
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculer la limite maximale selon le pas de temps
  const maxDays = useMemo(() => getMaxHistoryDays(timeStep), [timeStep]);
  
  // Calculer la date maximale autorisée pour la date de début
  const maxStartDate = useMemo(() => {
    if (!maxDays) return null;
    const now = new Date();
    const maxDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);
    return maxDate.toISOString().split("T")[0];
  }, [maxDays]);

  // Initialiser les dates personnalisées si elles existent
  useEffect(() => {
    if (timeRange.type === "custom" && timeRange.custom) {
      setCustomStartDate(timeRange.custom.startDate);
      setCustomEndDate(timeRange.custom.endDate);
    } else {
      // Initialiser avec des valeurs par défaut (dernières 24h)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      setCustomStartDate(yesterday.toISOString().split("T")[0]);
      setCustomEndDate(now.toISOString().split("T")[0]);
    }
  }, [timeRange]);

  // Vérifier si la période actuelle est valide quand le pas de temps change
  useEffect(() => {
    if (!maxDays) {
      setValidationError(null);
      return;
    }

    // Vérifier la période actuelle
    if (timeRange.type === "preset" && timeRange.preset) {
      const presetDays = getPresetDays(timeRange.preset);
      if (presetDays > maxDays) {
        setValidationError(
          `La période sélectionnée (${timeRange.preset}) dépasse la limite de ${formatMaxDaysDisplay(maxDays)} pour le pas de temps "${timeStep}". Elle a été ajustée automatiquement.`
        );
        setTimeout(() => setValidationError(null), 5000);
      } else {
        setValidationError(null);
      }
    } else if (timeRange.type === "custom" && timeRange.custom) {
      const daysDiff = getDaysDifference(
        timeRange.custom.startDate,
        timeRange.custom.endDate
      );
      if (daysDiff > maxDays) {
        setValidationError(
          `La période sélectionnée (${daysDiff} jours) dépasse la limite de ${formatMaxDaysDisplay(maxDays)} pour le pas de temps "${timeStep}". Elle a été ajustée automatiquement.`
        );
        setTimeout(() => setValidationError(null), 5000);
      } else {
        // Vérifier aussi si la date de début est trop ancienne
        const now = new Date();
        const maxStartDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);
        const startDate = new Date(timeRange.custom.startDate);
        if (startDate < maxStartDate) {
          setValidationError(
            `La période a été ajustée à ${formatMaxDaysDisplay(maxDays)} maximum pour le pas de temps "${timeStep}".`
          );
          setTimeout(() => setValidationError(null), 5000);
        } else {
          setValidationError(null);
        }
      }
    }
  }, [timeStep, maxDays, timeRange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsCustomOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Vérifier si un preset est valide selon la limite
  const isPresetValid = (preset: "3h" | "24h" | "7d" | "30d"): boolean => {
    if (!maxDays) return true; // Pas de limite
    const presetDays = getPresetDays(preset);
    return presetDays <= maxDays;
  };

  const handlePresetChange = (preset: "3h" | "24h" | "7d" | "30d") => {
    if (!isPresetValid(preset)) {
      setValidationError(
        `Cette période n'est pas disponible pour le pas de temps "${timeStep}". Limite: ${maxDays ? formatMaxDaysDisplay(maxDays) : "illimitée"}.`
      );
      return;
    }
    setValidationError(null);
    onTimeRangeChange({
      type: "preset",
      preset,
    });
  };

  const handleCustomToggle = () => {
    setIsCustomOpen(!isCustomOpen);
  };

  const handleCustomDateChange = (type: "start" | "end", value: string) => {
    if (type === "start") {
      setCustomStartDate(value);
    } else {
      setCustomEndDate(value);
    }
    // Ne pas charger automatiquement les données
    // L'utilisateur devra cliquer sur "Charger les données"
  };

  const handleLoadCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      setValidationError("Veuillez sélectionner une date de début et une date de fin");
      return;
    }

    // Vérifier la limite si elle existe
    if (maxDays) {
      const daysDiff = getDaysDifference(customStartDate, customEndDate);
      if (daysDiff > maxDays) {
        setValidationError(
          `La période sélectionnée (${daysDiff} jours) dépasse la limite autorisée de ${formatMaxDaysDisplay(maxDays)} pour le pas de temps "${timeStep}".`
        );
        return;
      }
    }

    // Vérifier que la date de début n'est pas trop ancienne
    if (maxStartDate && customStartDate < maxStartDate) {
      setValidationError(
        `La date de début ne peut pas être antérieure au ${new Date(maxStartDate).toLocaleDateString("fr-FR")} pour le pas de temps "${timeStep}".`
      );
      return;
    }

    setValidationError(null);
    onTimeRangeChange({
      type: "custom",
      custom: {
        startDate: customStartDate,
        endDate: customEndDate,
      },
    });
    setIsCustomOpen(false);
  };

  const handleQuickSelect = (option: { type: "days" | "months"; value: number }) => {
    const end = new Date();
    const start = new Date();

    if (option.type === "days") {
      start.setDate(start.getDate() - option.value);
    } else {
      const currentDay = start.getDate();
      start.setMonth(start.getMonth() - option.value);
      // Corriger les mois avec moins de jours en se rabattant sur le dernier jour disponible
      if (start.getDate() !== currentDay) {
        start.setDate(0);
      }
    }

    const formatDateForInput = (date: Date): string => {
      return date.toISOString().split("T")[0];
    };

    const startDateStr = formatDateForInput(start);
    const endDateStr = formatDateForInput(end);

    // Vérifier la limite si elle existe
    if (maxDays) {
      const daysDiff = getDaysDifference(startDateStr, endDateStr);
      if (daysDiff > maxDays) {
        // Ajuster automatiquement à la limite maximale
        const adjustedStart = new Date(end.getTime() - maxDays * 24 * 60 * 60 * 1000);
        const adjustedStartStr = formatDateForInput(adjustedStart);
        setCustomStartDate(adjustedStartStr);
        setCustomEndDate(endDateStr);
        setValidationError(
          `La période a été ajustée à ${formatMaxDaysDisplay(maxDays)} (limite pour le pas de temps "${timeStep}").`
        );
        setTimeout(() => setValidationError(null), 3000);
        
        onTimeRangeChange({
          type: "custom",
          custom: {
            startDate: adjustedStartStr,
            endDate: endDateStr,
          },
        });
        setIsCustomOpen(false);
        return;
      }
    }

    setValidationError(null);
    setCustomStartDate(startDateStr);
    setCustomEndDate(endDateStr);

    onTimeRangeChange({
      type: "custom",
      custom: {
        startDate: startDateStr,
        endDate: endDateStr,
      },
    });
    setIsCustomOpen(false);
  };

  const getDisplayText = () => {
    if (timeRange.type === "custom" && timeRange.custom) {
      const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      };
      return `${formatDate(timeRange.custom.startDate)} - ${formatDate(
        timeRange.custom.endDate
      )}`;
    }

    const presetLabels: Record<string, string> = {
      "3h": "3h",
      "24h": "24h",
      "7d": "7j",
      "30d": "30j",
    };

    return presetLabels[timeRange.preset || "24h"] || "24h";
  };

  const isCustomSelected = timeRange.type === "custom";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
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
        <span className="text-sm font-medium text-gray-700">{t("historical.periodLabel")}</span>
      </div>

      {/* Boutons des périodes prédéfinies */}
      <ToggleGroup
        type="single"
        value={timeRange.type === "preset" ? timeRange.preset : undefined}
        onValueChange={(value) => {
          if (value && (value === "3h" || value === "24h" || value === "7d" || value === "30d")) {
            handlePresetChange(value);
          }
        }}
        className="w-full mb-2"
      >
        {[
          { key: "3h", label: "3h" },
          { key: "24h", label: "24h" },
          { key: "7d", label: "7j" },
          { key: "30d", label: "30j" },
        ].map(({ key, label }) => {
          const isValid = isPresetValid(key as "3h" | "24h" | "7d" | "30d");
          
          return (
            <ToggleGroupItem
              key={key}
              value={key}
              disabled={!isValid}
              title={
                !isValid && maxDays
                  ? `Limité à ${formatMaxDaysDisplay(maxDays)} pour ce pas de temps`
                  : undefined
              }
              className={cn(
                "text-xs min-w-0",
                !isValid && "opacity-50"
              )}
            >
              {label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      
      

      {/* Bouton pour la sélection personnalisée */}
      <button
        onClick={handleCustomToggle}
        className={`w-full px-2.5 py-1.5 text-xs rounded-md transition-all duration-200 border ${
          isCustomSelected
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
        }`}
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
            {isCustomSelected ? getDisplayText() : t("historical.customPeriod")}
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${
              isCustomOpen ? "rotate-180" : ""
            }`}
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
        </div>
      </button>

      {/* Dropdown pour la sélection personnalisée */}
      {isCustomOpen && (
        <div className="absolute z-[2000] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-3 space-y-3">
            {/* Sélections rapides */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Sélections rapides
              </div>
              <div className="grid grid-cols-1 gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickSelect({ type: "months", value: 3 })}
                  className={`text-left px-2 py-1 text-xs rounded transition-colors ${
                    maxDays && 90 > maxDays
                      ? "text-gray-400 cursor-not-allowed opacity-50"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  disabled={maxDays !== null && 90 > maxDays}
                  title={
                    maxDays && 90 > maxDays
                      ? `Limité à ${formatMaxDaysDisplay(maxDays)} pour ce pas de temps`
                      : undefined
                  }
                >
                  3 derniers mois
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect({ type: "days", value: 365 })}
                  className={`text-left px-2 py-1 text-xs rounded transition-colors ${
                    maxDays && 365 > maxDays
                      ? "text-gray-400 cursor-not-allowed opacity-50"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  disabled={maxDays !== null && 365 > maxDays}
                  title={
                    maxDays && 365 > maxDays
                      ? `Limité à ${formatMaxDaysDisplay(maxDays)} pour ce pas de temps`
                      : undefined
                  }
                >
                  365 derniers jours
                </button>
              </div>
            </div>

            {/* Séparateur */}
            <div className="border-t border-gray-200"></div>

            {/* Sélection personnalisée */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {t("historical.customPeriod")}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) =>
                      handleCustomDateChange("start", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    max={
                      customEndDate || new Date().toISOString().split("T")[0]
                    }
                    min={maxStartDate || undefined}
                  />
                  {maxStartDate && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Date minimale : {new Date(maxStartDate).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) =>
                      handleCustomDateChange("end", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    min={customStartDate}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              {/* Bouton Charger les données */}
              <button
                type="button"
                onClick={handleLoadCustomRange}
                disabled={!customStartDate || !customEndDate}
                className={`w-full mt-3 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                  customStartDate && customEndDate
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Charger les données
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Message d'avertissement sur les limites */}
      {maxDays && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-700">
            <span className="font-medium"></span> Maximum {formatMaxDaysDisplay(maxDays)} pour ce pas de temps
          </p>
        </div>
      )}
      
      {/* Message d'erreur de validation */}
      {validationError && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-700">{validationError}</p>
        </div>
      )}
    </div>
  );
};

export default HistoricalTimeRangeSelector;
