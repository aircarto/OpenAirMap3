import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DateRangeSelectorProps } from "../../types";

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  maxDateRange = 365,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});

  // Validation des dates
  useEffect(() => {
    const newErrors: { startDate?: string; endDate?: string } = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();

      // Vérifier que la date de début est antérieure à la date de fin
      if (start >= end) {
        newErrors.endDate = t("historical.validationEndAfterStart");
      }

      // Vérifier que les dates ne sont pas dans le futur
      if (start > today) {
        newErrors.startDate = t("historical.validationStartNotFuture");
      }
      if (end > today) {
        newErrors.endDate = t("historical.validationEndNotFuture");
      }

      // Vérifier la durée maximale
      const diffInDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffInDays > maxDateRange) {
        newErrors.endDate = t("historical.validationMaxPeriod", { max: maxDateRange });
      }
    }

    setErrors(newErrors);
  }, [startDate, endDate, maxDateRange, t]);

  // Calculer la date maximale (aujourd'hui)
  const today = new Date().toISOString().split("T")[0];

  // La date minimale n'est plus limitée par maxDateRange
  // L'utilisateur peut remonter dans le temps autant qu'il le souhaite
  const minDateString = "1900-01-01"; // Date très ancienne pour permettre de remonter loin

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">
        {t("historical.selectTimePeriod")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date de début */}
        <div className="space-y-2">
          <label
            htmlFor="start-date"
            className="block text-sm font-medium text-gray-600"
          >
            {t("historical.startDate")}
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            min={minDateString}
            max={today}
            disabled={disabled}
            className={`
              w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${
                errors.startDate
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300 bg-white"
              }
              ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}
            `}
          />
          {errors.startDate && (
            <p className="text-sm text-red-600">{errors.startDate}</p>
          )}
        </div>

        {/* Date de fin */}
        <div className="space-y-2">
          <label
            htmlFor="end-date"
            className="block text-sm font-medium text-gray-600"
          >
            {t("historical.endDate")}
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            min={startDate || minDateString}
            max={today}
            disabled={disabled}
            className={`
              w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${
                errors.endDate
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300 bg-white"
              }
              ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}
            `}
          />
          {errors.endDate && (
            <p className="text-sm text-red-600">{errors.endDate}</p>
          )}
        </div>
      </div>

      {/* Informations sur la période */}
      {startDate && endDate && !errors.startDate && !errors.endDate && (
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
          <div className="flex items-center space-x-2">
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
                  (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                ),
              })}
            </span>
          </div>
        </div>
      )}

      {/* Limitation de période */}
      <div className="text-xs text-gray-500">
        {t("historical.maxPeriodDays", { days: maxDateRange })}
      </div>
    </div>
  );
};

export default DateRangeSelector;
