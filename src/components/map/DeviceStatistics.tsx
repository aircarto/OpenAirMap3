import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MeasurementDevice, SignalAirReport } from "../../types";
import StatisticsPanel from "./StatisticsPanel";
import { cn } from "../../lib/utils";
import { sources } from "../../constants/sources";
import {
  DeviceStatistics as DeviceStatisticsType,
  SourceStatistics,
} from "../../utils/deviceStatisticsUtils";
import { getDisplayedPeriod } from "../../utils/dataPeriodUtils";

interface DeviceStatisticsProps {
  visibleDevices: MeasurementDevice[];
  visibleReports: SignalAirReport[];
  totalDevices: number;
  totalReports: number;
  selectedPollutant: string;
  selectedSources?: string[];
  selectedTimeStep?: string;
  historicalCurrentDate?: string;
  statistics?: DeviceStatisticsType; // OPTIMISATION : Statistiques pré-calculées
  sourceStatistics?: SourceStatistics[]; // OPTIMISATION : Stats par source pré-calculées
  showDetails?: boolean;
}

/**
 * Composant pour afficher les statistiques des appareils visibles dans le viewport
 */
const DeviceStatistics: React.FC<DeviceStatisticsProps> = ({
  visibleDevices,
  visibleReports,
  totalDevices,
  totalReports,
  selectedPollutant,
  selectedSources = [],
  selectedTimeStep = "",
  historicalCurrentDate,
  statistics, // OPTIMISATION : Utiliser les statistiques pré-calculées
  sourceStatistics, // OPTIMISATION : Stats par source pré-calculées
  showDetails = false,
}) => {
  const { t, i18n } = useTranslation();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const displayedPeriod =
    selectedTimeStep &&
    getDisplayedPeriod(selectedTimeStep, historicalCurrentDate, i18n.language);

  // OPTIMISATION : Utiliser les statistiques pré-calculées si disponibles
  // Sinon, calculer localement (fallback pour compatibilité)
  const devicesBySource = statistics?.devicesBySource || visibleDevices.reduce((acc, device) => {
    acc[device.source] = (acc[device.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const qualityLevels = statistics?.qualityLevels || visibleDevices.reduce((acc, device) => {
    const level = device.qualityLevel || "default";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageValue = statistics?.averageValue ?? 0;
  const minValue = statistics?.minValue ?? 0;
  const maxValue = statistics?.maxValue ?? 0;
  const activeDevices = statistics?.activeDevices ?? 0;

  // Formatage des nombres
  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
  };

  // Obtenir le nom lisible de la source depuis les constantes
  const getSourceName = (source: string): string => {
    // Gérer les sous-sources (ex: "communautaire.nebuleair")
    if (source.includes(".")) {
      const [groupKey, subKey] = source.split(".");
      const group = sources[groupKey as keyof typeof sources];
      if (group?.isGroup && group.subSources) {
        const subSource = group.subSources[subKey as keyof typeof group.subSources];
        if (subSource) {
          // Cas spécial pour NebuleAir
          if (subKey === "nebuleair") {
            return "NebuleAir AirCarto";
          }
          return subSource.name;
        }
      }
    }
    
    // Vérifier si c'est une sous-source communautaire sans préfixe (ex: "nebuleair")
    const communautaireGroup = sources.communautaire;
    if (communautaireGroup?.isGroup && communautaireGroup.subSources) {
      const subSource = communautaireGroup.subSources[source as keyof typeof communautaireGroup.subSources];
      if (subSource) {
        // Cas spécial pour NebuleAir
        if (source === "nebuleair") {
          return "NebuleAir AirCarto";
        }
        return subSource.name;
      }
    }
    
    // Source directe
    const sourceConfig = sources[source as keyof typeof sources];
    if (sourceConfig && !sourceConfig.isGroup) {
      return sourceConfig.name;
    }
    
    // Fallback : retourner le code source tel quel
    return source;
  };

  // Obtenir le nom lisible du niveau de qualité
  const getQualityName = (level: string): string => {
    const key = level === "default" ? "panels.noMeasureRecent" : `quality.${level}`;
    return t(key);
  };

  // Couleurs pour les niveaux de qualité
  const getQualityColor = (level: string): string => {
    const colors: Record<string, string> = {
      bon: "text-green-600",
      moyen: "text-yellow-600",
      degrade: "text-orange-600",
      mauvais: "text-red-600",
      tresMauvais: "text-red-700",
      extrMauvais: "text-red-900",
      default: "text-gray-600",
    };
    return colors[level] || "text-gray-600";
  };

  const isRtl = i18n.language === "ar";

  return (
    <>
      <div
        className={cn(
          "text-xs text-gray-600 cursor-pointer transition-all",
          "hover:bg-gray-50 rounded-md -mx-1 px-1 py-0.5",
          isPanelOpen && "bg-gray-50"
        )}
        onClick={() => (visibleDevices.length > 0 || visibleReports.length > 0) && setIsPanelOpen(!isPanelOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (visibleDevices.length > 0 || visibleReports.length > 0) {
              setIsPanelOpen(!isPanelOpen);
            }
          }
        }}
        aria-label={t("panels.showStats")}
      >
        {/* Période des données affichées (mise en avant quand le panneau est fermé) */}
        {displayedPeriod && !isPanelOpen && (
          <div className="mb-1.5">
            <div
              className="inline-flex items-center gap-2 rounded-r-md rounded-l border border-slate-200 border-l-4 border-l-blue-400 bg-white py-1.5 pl-2.5 pr-3 shadow-sm"
              role="status"
              aria-label={`${t("controls.period")}: ${displayedPeriod}`}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V5m8 2V5m-9 4h10M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                />
              </svg>
              <span
                className="text-sm text-slate-600"
                dir={isRtl ? "rtl" : "ltr"}
              >
                <span className="font-medium text-slate-700">{t("controls.period")}</span>
                <span className="text-slate-400 mx-1" aria-hidden>·</span>
                <span className="font-medium text-blue-600">{displayedPeriod}</span>
              </span>
            </div>
          </div>
        )}

        {/* Affichage principal : nombre d'appareils visibles (RTL uniquement sur le texte) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 min-w-0">
            <span className="font-medium" dir={isRtl ? "rtl" : "ltr"}>
              {t("statistics.devicesVisible", { count: visibleDevices.length })}
              {visibleDevices.length !== totalDevices && totalDevices > 0 && (
                <span className="text-gray-500 font-normal">
                  {" "}
                  {t("statistics.ofTotal", { total: totalDevices })}
                </span>
              )}
            </span>
          </div>
          {(visibleDevices.length > 0 || visibleReports.length > 0) && (
            <svg
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform",
                isPanelOpen && "rotate-180"
              )}
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
          )}
        </div>

        {/* Affichage des signalements si présents */}
        {visibleReports.length > 0 && (
          <div className="mt-1">
            <span dir={isRtl ? "rtl" : "ltr"}>
              {t("statistics.reportsVisible", { count: visibleReports.length })}
              {visibleReports.length !== totalReports && totalReports > 0 && (
                <span className="text-gray-500">
                  {" "}
                  {t("statistics.ofTotal", { total: totalReports })}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Panel statistique */}
      <StatisticsPanel
        visibleDevices={visibleDevices}
        visibleReports={visibleReports}
        selectedSources={selectedSources}
        selectedPollutant={selectedPollutant}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        statistics={statistics} // OPTIMISATION : Passer les statistiques pré-calculées
        sourceStatistics={sourceStatistics} // OPTIMISATION : Passer les stats par source pré-calculées
      />
    </>
  );
};

export default DeviceStatistics;
