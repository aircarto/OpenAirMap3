import { StationInfo, ComparisonState } from "../../../types";
import { AtmoRefService } from "../../../services/AtmoRefService";
import { AtmoMicroService } from "../../../services/AtmoMicroService";
import { NebuleAirService } from "../../../services/NebuleAirService";
import { DataServiceFactory } from "../../../services/DataServiceFactory";
import { getCustomRangeISO } from "../../../utils/historicalTimeRange";

/**
 * Fonction utilitaire pour calculer les dates (réutilisée depuis les autres panels)
 */
export const getDateRange = (
  timeRange: any
): { startDate: string; endDate: string } => {
  const now = new Date();
  const endDate = now.toISOString();

  // Si c'est une plage personnalisée, utiliser les dates fournies
  if (timeRange.type === "custom" && timeRange.custom) {
    return getCustomRangeISO(timeRange.custom);
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
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString(),
    endDate,
  };
};

/**
 * Crée un handler pour charger les données de comparaison
 */
export const createLoadComparisonDataHandler = (
  setComparisonState: React.Dispatch<React.SetStateAction<ComparisonState>>
) => {
  return async (
    stations: StationInfo[],
    pollutant: string,
    timeRange: any,
    timeStep: string
  ) => {
    setComparisonState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { startDate, endDate } = getDateRange(timeRange);
      const newComparisonData: Record<string, Record<string, any[]>> = {};

      // Charger les données pour chaque station
      for (const station of stations) {
        let stationData: any[] = [];

        if (station.source === "atmoRef") {
          const atmoRefService = DataServiceFactory.getService('atmoRef') as AtmoRefService;
          stationData = await atmoRefService.fetchHistoricalData({
            stationId: station.id,
            pollutant,
            timeStep,
            startDate,
            endDate,
          });
        } else if (station.source === "atmoMicro") {
          const atmoMicroService = DataServiceFactory.getService('atmoMicro') as AtmoMicroService;
          stationData = await atmoMicroService.fetchHistoricalData({
            siteId: station.id,
            pollutant,
            timeStep,
            startDate,
            endDate,
          });
        } else if (station.source === "nebuleair") {
          const nebuleAirService = DataServiceFactory.getService('nebuleair') as NebuleAirService;
          stationData = await nebuleAirService.fetchHistoricalData({
            sensorId: station.id,
            pollutant,
            timeStep,
            startDate,
            endDate,
          });
        }

        if (!newComparisonData[pollutant]) {
          newComparisonData[pollutant] = {};
        }
        newComparisonData[pollutant][station.id] = stationData;
      }

      setComparisonState((prev) => ({
        ...prev,
        comparisonData: newComparisonData,
        selectedPollutant: pollutant,
        timeRange,
        timeStep,
        loading: false,
      }));
    } catch (error) {
      console.error(
        "Erreur lors du chargement des données de comparaison:",
        error
      );
      setComparisonState((prev) => ({
        ...prev,
        loading: false,
        error: "Erreur lors du chargement des données de comparaison",
      }));
    }
  };
};

/**
 * Crée un handler pour retirer une station de la comparaison
 */
export const createRemoveStationFromComparisonHandler = (
  comparisonState: ComparisonState,
  setComparisonState: React.Dispatch<React.SetStateAction<ComparisonState>>,
  setIsSidePanelOpen: (open: boolean) => void,
  setSelectedStation: (station: StationInfo | null) => void
) => {
  return (stationId: string) => {
    // Calculer la nouvelle longueur avant de mettre à jour l'état
    const currentLength = comparisonState.comparedStations.length;
    const willBeEmpty = currentLength === 1; // Si on supprime la dernière station

    setComparisonState((prev) => {
      const newComparedStations = prev.comparedStations.filter(
        (station) => station.id !== stationId
      );

      // Si la liste devient vide, désactiver le mode comparaison et nettoyer les données
      const shouldDisableComparison = newComparedStations.length === 0;

      return {
        ...prev,
        isComparisonMode: shouldDisableComparison
          ? false
          : prev.isComparisonMode,
        comparedStations: newComparedStations,
        // Supprimer aussi les données de cette station
        comparisonData: shouldDisableComparison
          ? {} // Nettoyer toutes les données si le mode comparaison est désactivé
          : Object.fromEntries(
              Object.entries(prev.comparisonData).map(
                ([pollutant, stationsData]) => [
                  pollutant,
                  Object.fromEntries(
                    Object.entries(stationsData).filter(
                      ([id]) => id !== stationId
                    )
                  ),
                ]
              )
            ),
      };
    });

    // Fermer le panneau si le mode comparaison est désactivé automatiquement
    if (willBeEmpty) {
      setIsSidePanelOpen(false);
      setSelectedStation(null);
    }
  };
};

