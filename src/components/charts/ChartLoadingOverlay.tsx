import React from "react";
import { useTranslation } from "react-i18next";

/**
 * Voile de chargement affiché AU-DESSUS du graphique pendant un rechargement.
 *
 * Contrairement à un écran de chargement qui remplace le bloc du graphique, il
 * laisse `HistoricalChart` monté : l'instance amCharts est conservée (pas de
 * destruction/recréation du root à chaque changement de pas de temps ou de
 * période) et le graphique précédent reste visible en fond.
 *
 * Le conteneur parent doit être positionné (`relative`).
 */
const ChartLoadingOverlay: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/75"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center space-y-2">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#4271B3]"></div>
        <span className="text-xs sm:text-sm text-gray-600">
          {t("panels.loadingData")}
        </span>
      </div>
    </div>
  );
};

export default ChartLoadingOverlay;
