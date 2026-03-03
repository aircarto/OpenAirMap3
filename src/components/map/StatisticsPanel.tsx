import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MeasurementDevice, SignalAirReport } from "../../types";
import { cn } from "../../lib/utils";
import { QUALITY_COLORS } from "../../constants/qualityColors";
import { pollutants } from "../../constants/pollutants";
import { getSourceDisplayName } from "../../utils/sourceCompatibility";
import {
  DeviceStatistics as DeviceStatisticsType,
  SourceStatistics,
  calculateQualityDistribution,
} from "../../utils/deviceStatisticsUtils";

interface StatisticsPanelProps {
  visibleDevices: MeasurementDevice[];
  visibleReports?: SignalAirReport[];
  selectedSources?: string[];
  selectedPollutant: string;
  isOpen: boolean;
  onClose: () => void;
  statistics?: DeviceStatisticsType; // OPTIMISATION : Statistiques pré-calculées
  sourceStatistics?: SourceStatistics[]; // OPTIMISATION : Stats par source pré-calculées
}

/**
 * Composant panel statistique avec design inspiré de shadcn
 * Affiche les statistiques détaillées des appareils visibles
 */
const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  visibleDevices,
  visibleReports = [],
  selectedSources = [],
  selectedPollutant,
  isOpen,
  onClose,
  statistics, // OPTIMISATION : Statistiques pré-calculées
  sourceStatistics, // OPTIMISATION : Stats par source pré-calculées
}) => {
  const { t, i18n } = useTranslation();
  const textDir = i18n.language === "ar" ? "rtl" : "ltr";
  // Vérifier si SignalAir est actif
  const isSignalAirActive = selectedSources.includes("signalair");
  /**
   * OPTIMISATION : Utiliser les statistiques pré-calculées si disponibles
   * Sinon, calculer localement (fallback pour compatibilité)
   * Cela évite les recalculs redondants
   */
  const globalStats = useMemo(() => {
    if (statistics) {
      // Utiliser les statistiques pré-calculées
      return {
        average: statistics.averageValue,
        median: statistics.medianValue,
        min: statistics.minValue,
        max: statistics.maxValue,
        count: statistics.validValuesCount,
        unit: statistics.unit,
      };
    }

    // Fallback : calculer localement si les stats ne sont pas fournies
    const values = visibleDevices
      .map((device) => device.value)
      .filter((v) => v > 0 && !isNaN(v));

    if (values.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
        unit: visibleDevices[0]?.unit || "",
      };
    }

    // Calculer la médiane
    const calculateMedian = (vals: number[]): number => {
      if (vals.length === 0) return 0;
      const sorted = [...vals].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: calculateMedian(values),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      unit: visibleDevices[0]?.unit || "",
    };
  }, [statistics, visibleDevices]);

  /**
   * OPTIMISATION : Utiliser la distribution pré-calculée si disponible
   */
  const qualityDistribution = useMemo(() => {
    if (statistics) {
      // Utiliser la fonction utilitaire pour obtenir la distribution ordonnée
      return calculateQualityDistribution(
        statistics.qualityLevels,
        statistics.totalDevices
      );
    }

    // Fallback : calculer localement
    const distribution = visibleDevices.reduce((acc, device) => {
      const level = device.qualityLevel || "default";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Ordre des niveaux de qualité (du meilleur au pire)
    // "default" sera ajouté en dernier séparément
    const qualityOrder = [
      "bon",
      "moyen",
      "degrade",
      "mauvais",
      "tresMauvais",
      "extrMauvais",
    ];

    // Récupérer les niveaux avec valeurs (sauf default)
    const orderedLevels = qualityOrder
      .filter((level) => distribution[level] > 0)
      .map((level) => ({
        level,
        count: distribution[level],
        percentage: (distribution[level] / visibleDevices.length) * 100,
      }));

    // Ajouter "default" en dernier s'il existe
    if (distribution["default"] > 0) {
      orderedLevels.push({
        level: "default",
        count: distribution["default"],
        percentage: (distribution["default"] / visibleDevices.length) * 100,
      });
    }

    return orderedLevels;
  }, [statistics, visibleDevices]);

  /**
   * OPTIMISATION : Utiliser les statistiques par source pré-calculées si disponibles
   */
  const statsBySource = useMemo(() => {
    if (sourceStatistics) {
      // Utiliser les stats pré-calculées
      return sourceStatistics;
    }

    // Fallback : calculer localement
    const sourceMap = new Map<string, MeasurementDevice[]>();

    visibleDevices.forEach((device) => {
      if (!sourceMap.has(device.source)) {
        sourceMap.set(device.source, []);
      }
      sourceMap.get(device.source)!.push(device);
    });

    return Array.from(sourceMap.entries()).map(([source, devices]) => {
      const values = devices
        .map((d) => d.value)
        .filter((v) => v > 0 && !isNaN(v));

      const qualityDist = devices.reduce((acc, device) => {
        const level = device.qualityLevel || "default";
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculer la médiane
      const calculateMedian = (vals: number[]): number => {
        if (vals.length === 0) return 0;
        const sorted = [...vals].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      };

      return {
        source,
        devices,
        count: devices.length,
        average: values.length > 0
          ? values.reduce((sum, val) => sum + val, 0) / values.length
          : 0,
        median: calculateMedian(values),
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
        qualityDistribution: qualityDist,
        unit: devices[0]?.unit || "",
      };
    });
  }, [sourceStatistics, visibleDevices]);

  // Obtenir le nom lisible du niveau de qualité
  const getQualityName = (level: string): string => {
    const key = level === "default" ? "panels.noMeasureRecent" : `quality.${level}`;
    return t(key);
  };

  // Couleurs pour les niveaux de qualité - utilise les couleurs réelles des seuils
  const getQualityColor = (level: string): {
    bg: string;
    text: string;
    border: string;
    color: string;
  } => {
    // Obtenir la couleur hex réelle
    const hexColor = QUALITY_COLORS[level as keyof typeof QUALITY_COLORS] || QUALITY_COLORS.default;
    
    // Convertir hex en rgba pour les fonds avec opacité
    const hexToRgba = (hex: string, alpha: number = 0.15): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Déterminer la couleur du texte selon la luminosité de la couleur de fond
    // Pour les fonds clairs (avec opacité), on utilise toujours un texte sombre
    // Pour les barres de progression, on utilise la couleur réelle
    const getTextColor = (): string => {
      // Pour les cartes avec fond clair, on utilise toujours un texte sombre pour la lisibilité
      return "#1f2937"; // Gris foncé pour une bonne lisibilité sur fond clair
    };

    return {
      bg: hexToRgba(hexColor, 0.15), // Fond avec 15% d'opacité
      text: getTextColor(),
      border: hexColor,
      color: hexColor, // Couleur principale pour les barres de progression
    };
  };

  // Formatage des nombres
  const formatNumber = (num: number, decimals: number = 1): string => {
    if (isNaN(num) || num === 0) return "0";
    return num.toFixed(decimals);
  };

  // Statistiques des signalements
  const reportsStats = useMemo(() => {
    if (!isSignalAirActive || visibleReports.length === 0) {
      return null;
    }

    // Distribution par type de signalement
    const distributionByType = visibleReports.reduce((acc, report) => {
      const type = report.signalType || "autre";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Nombre de signalements avec symptômes
    const withSymptoms = visibleReports.filter((report) => {
      const hasSymptoms = report.signalHasSymptoms?.toLowerCase();
      return (
        hasSymptoms === "oui" ||
        hasSymptoms === "yes" ||
        hasSymptoms === "true" ||
        (report.signalSymptoms && report.signalSymptoms.trim() !== "")
      );
    }).length;

    // Distribution par niveau de gêne
    const distributionByNuisanceLevel = visibleReports.reduce((acc, report) => {
      const level = report.nuisanceLevel || "non spécifié";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Distribution par origine de la nuisance
    const distributionByOrigin = visibleReports.reduce((acc, report) => {
      const origin = report.nuisanceOrigin || "non spécifiée";
      acc[origin] = (acc[origin] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: visibleReports.length,
      distributionByType,
      withSymptoms,
      withoutSymptoms: visibleReports.length - withSymptoms,
      distributionByNuisanceLevel,
      distributionByOrigin,
    };
  }, [visibleReports, isSignalAirActive]);

  // Obtenir le nom lisible du type de signalement
  const getSignalTypeName = (type: string): string => {
    const key = `statistics.signalType.${type}`;
    const translated = t(key);
    return translated !== key ? translated : type;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[1600] transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-4 z-[1601] w-[420px] max-h-[80vh]",
          "bg-white rounded-lg border border-gray-200 shadow-xl",
          "flex flex-col transition-all duration-300",
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900" dir={textDir}>
              {t("statistics.title")}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5" dir={textDir}>
              {t("statistics.device", { count: visibleDevices.length })}
              {isSignalAirActive && reportsStats && reportsStats.total > 0 && (
                <> • {t("statistics.report", { count: reportsStats.total })}</>
              )}
              {visibleDevices.length > 0 && <> • {pollutants[selectedPollutant]?.name || selectedPollutant.toUpperCase()}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={t("common.close")}
          >
            <svg
              className="h-5 w-5"
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

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {visibleDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg
                className="h-12 w-12 text-gray-400 mb-3"
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
              <p className="text-sm font-medium text-gray-900" dir={textDir}>{t("panels.noDeviceVisible")}</p>
              <p className="text-xs text-gray-500 mt-1" dir={textDir}>
                {t("statistics.zoomHint")}
              </p>
            </div>
          ) : (
            <>
              {/* Statistiques globales */}
              <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide" dir={textDir}>
              {t("statistics.globalTitle")}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1" dir={textDir}>{t("statistics.average")}</p>
                <p className="text-lg font-semibold text-gray-900" dir="ltr">
                  {formatNumber(globalStats.average)} {globalStats.unit}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1" dir={textDir}>{t("statistics.median")}</p>
                <p className="text-lg font-semibold text-gray-900" dir="ltr">
                  {formatNumber(globalStats.median)} {globalStats.unit}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1" dir={textDir}>{t("statistics.minimum")}</p>
                <p className="text-lg font-semibold text-gray-900" dir="ltr">
                  {formatNumber(globalStats.min)} {globalStats.unit}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1" dir={textDir}>{t("statistics.maximum")}</p>
                <p className="text-lg font-semibold text-gray-900" dir="ltr">
                  {formatNumber(globalStats.max)} {globalStats.unit}
                </p>
              </div>
            </div>
          </div>

          {/* Distribution par seuil */}
          {qualityDistribution.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide" dir={textDir}>
                {t("statistics.distributionByThreshold")}
              </h4>
              <div className="space-y-2">
                {qualityDistribution.map(({ level, count, percentage }) => {
                  const colors = getQualityColor(level);
                  // OPTIMISATION : Utiliser le pourcentage pré-calculé si disponible
                  const displayPercentage = percentage ?? (count / visibleDevices.length) * 100;
                  return (
                    <div
                      key={level}
                      className="rounded-lg border p-3"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-sm font-medium"
                          style={{ color: colors.text }}
                          dir={textDir}
                        >
                          {getQualityName(level)}
                        </span>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: colors.text }}
                          dir="ltr"
                        >
                          {count} ({formatNumber(displayPercentage, 0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full transition-all rounded-full"
                          style={{
                            width: `${displayPercentage}%`,
                            backgroundColor: colors.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Statistiques par source */}
          {statsBySource.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide" dir={textDir}>
                {t("statistics.detailByDeviceType")}
              </h4>
              <div className="space-y-4">
                {statsBySource.map((sourceStats) => (
                  <div
                    key={sourceStats.source}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-gray-900" dir={textDir}>
                        {getSourceDisplayName(sourceStats.source, t)}
                      </h5>
                      <span className="text-xs text-gray-500" dir={textDir}>
                        {t("statistics.device", { count: sourceStats.count })}
                      </span>
                    </div>

                    {/* Statistiques de la source */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-[10px] text-gray-500 mb-0.5" dir={textDir}>{t("statistics.average")}</p>
                        <p className="text-sm font-semibold text-gray-900" dir="ltr">
                          {formatNumber(sourceStats.average)} {sourceStats.unit}
                        </p>
                      </div>
                      <div className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-[10px] text-gray-500 mb-0.5" dir={textDir}>{t("statistics.median")}</p>
                        <p className="text-sm font-semibold text-gray-900" dir="ltr">
                          {formatNumber(sourceStats.median)} {sourceStats.unit}
                        </p>
                      </div>
                      <div className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-[10px] text-gray-500 mb-0.5" dir={textDir}>{t("statistics.min")}</p>
                        <p className="text-sm font-semibold text-gray-900" dir="ltr">
                          {formatNumber(sourceStats.min)} {sourceStats.unit}
                        </p>
                      </div>
                      <div className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-[10px] text-gray-500 mb-0.5" dir={textDir}>{t("statistics.max")}</p>
                        <p className="text-sm font-semibold text-gray-900" dir="ltr">
                          {formatNumber(sourceStats.max)} {sourceStats.unit}
                        </p>
                      </div>
                    </div>

                    {/* Distribution par seuil pour cette source */}
                    {Object.keys(sourceStats.qualityDistribution).length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-1.5" dir={textDir}>
                          {t("statistics.distributionByThreshold")}
                        </p>
                        <div className="space-y-1">
                          {(() => {
                            // Ordre des niveaux de qualité (du meilleur au pire)
                            // "default" sera ajouté en dernier
                            const qualityOrder = [
                              "bon",
                              "moyen",
                              "degrade",
                              "mauvais",
                              "tresMauvais",
                              "extrMauvais",
                            ];

                            // Récupérer les niveaux avec valeurs dans l'ordre (sauf default)
                            const orderedEntries = qualityOrder
                              .filter((level) => sourceStats.qualityDistribution[level] > 0)
                              .map((level) => [level, sourceStats.qualityDistribution[level]] as [string, number]);

                            // Ajouter "default" en dernier s'il existe
                            if (sourceStats.qualityDistribution["default"] > 0) {
                              orderedEntries.push(["default", sourceStats.qualityDistribution["default"]]);
                            }

                            return orderedEntries.map(([level, count]) => {
                              const colors = getQualityColor(level);
                              const percentage = (count / sourceStats.count) * 100;
                              return (
                                <div
                                  key={level}
                                  className="rounded border p-2"
                                  style={{
                                    backgroundColor: colors.bg,
                                    borderColor: colors.border,
                                  }}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span
                                      className="text-xs font-medium"
                                      style={{ color: colors.text }}
                                      dir={textDir}
                                    >
                                      {getQualityName(level)}
                                    </span>
                                    <span
                                      className="text-xs font-semibold"
                                      style={{ color: colors.text }}
                                      dir="ltr"
                                    >
                                      {count} ({formatNumber(percentage, 0)}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="h-full transition-all rounded-full"
                                      style={{
                                        width: `${percentage}%`,
                                        backgroundColor: colors.color,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistiques des signalements */}
          {reportsStats && reportsStats.total > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide" dir={textDir}>
                {t("statistics.reportsTitle")}
              </h4>

              {/* Statistiques générales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 mb-1" dir={textDir}>{t("statistics.total")}</p>
                  <p className="text-lg font-semibold text-gray-900" dir="ltr">
                    {reportsStats.total}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 mb-1" dir={textDir}>{t("statistics.withSymptoms")}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {reportsStats.withSymptoms} (
                    {formatNumber(
                      (reportsStats.withSymptoms / reportsStats.total) * 100,
                      0
                    )}
                    %)
                  </p>
                </div>
              </div>

              {/* Distribution avec/sans symptômes */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide" dir={textDir}>
                  {t("statistics.splitWithWithoutSymptoms")}
                </h5>
                <div className="space-y-2">
                  {/* Avec symptômes */}
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900" dir={textDir}>
                        {t("statistics.withSymptoms")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900" dir="ltr">
                        {reportsStats.withSymptoms} (
                        {formatNumber(
                          (reportsStats.withSymptoms / reportsStats.total) * 100,
                          0
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full transition-all rounded-full bg-red-500"
                        style={{
                          width: `${(reportsStats.withSymptoms / reportsStats.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Sans symptômes */}
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900" dir={textDir}>
                        {t("statistics.withoutSymptoms")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900" dir="ltr">
                        {reportsStats.withoutSymptoms} (
                        {formatNumber(
                          (reportsStats.withoutSymptoms / reportsStats.total) * 100,
                          0
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full transition-all rounded-full bg-green-500"
                        style={{
                          width: `${(reportsStats.withoutSymptoms / reportsStats.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Distribution par type de signalement */}
              {Object.keys(reportsStats.distributionByType).length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide" dir={textDir}>
                    {t("statistics.distributionByType")}
                  </h5>
                  <div className="space-y-2">
                    {Object.entries(reportsStats.distributionByType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => {
                        const percentage =
                          (count / reportsStats.total) * 100;
                        return (
                          <div
                            key={type}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900" dir={textDir}>
                                {getSignalTypeName(type)}
                              </span>
                              <span className="text-sm font-semibold text-gray-900" dir="ltr">
                                {count} ({formatNumber(percentage, 0)}%)
                              </span>
                            </div>
                            <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full transition-all rounded-full bg-blue-500"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Distribution par niveau de gêne */}
              {Object.keys(reportsStats.distributionByNuisanceLevel).length >
                0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide" dir={textDir}>
                    {t("statistics.distributionByNuisanceLevel")}
                  </h5>
                  <div className="space-y-2">
                    {Object.entries(reportsStats.distributionByNuisanceLevel)
                      .sort(([, a], [, b]) => b - a)
                      .map(([level, count]) => {
                        const percentage =
                          (count / reportsStats.total) * 100;
                        return (
                          <div
                            key={level}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700" dir={textDir}>
                                {level}
                              </span>
                              <span className="text-xs font-semibold text-gray-900" dir="ltr">
                                {count} ({formatNumber(percentage, 0)}%)
                              </span>
                            </div>
                            <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full transition-all rounded-full bg-orange-500"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default StatisticsPanel;
