import { createContext, useContext } from "react";
import { ModelingLayerType } from "../constants/mapLayers";
import { Toast } from "../components/ui/toast";
import type { Notice } from "../components/map/notifications/notice";

/**
 * Transport d'état pour les contrôles de carte — pas un propriétaire d'état.
 *
 * Le rail de contrôles vit dans la colonne carte, à l'intérieur d'AirQualityMap,
 * alors que l'état qu'il pilote vit dans AppContent. Sans ce contexte il faudrait
 * ouvrir un troisième chemin de props à travers la signature déjà chargée
 * d'AirQualityMap (~47 props), après le header et MobileMenuBurger.
 *
 * Aucun useState ni useEffect ne vit ici : les invariants d'App.tsx (correction
 * automatique du polluant au changement de pas de temps, autorisation du mode
 * historique, verrouillage pendant la lecture) restent inchangés à leur place.
 *
 * Règle de partage, valable pour tout contrôle futur :
 *   l'état applicatif passe par le contexte, l'état local à la carte passe par
 *   les props (fond de carte, panneaux latéraux, SignalAir, MobileAir).
 */

export interface MapControlsBrand {
  logo: string;
  /** Variante carrée ou empilée, seule utilisable dans un rail étroit */
  markSquare?: string;
  favicon: string;
  title: string;
  organization: string;
}

export interface MapControlsFilters {
  selectedPollutant: string;
  selectedSources: string[];
  selectedTimeStep: string;
  onPollutantChange: (pollutant: string) => void;
  onSourceChange: (sources: string[]) => void;
  onTimeStepChange: (timeStep: string) => void;
}

export interface MapControlsModeling {
  currentModelingLayer: ModelingLayerType | null;
  onModelingLayerChange: (layer: ModelingLayerType | null) => void;
}

export interface MapControlsRefresh {
  /** Déjà combiné avec !isHistoricalModeActive par l'appelant */
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: (enabled: boolean) => void;
  loading: boolean;
  lastRefresh: Date | null;
}

export interface MapControlsHistorical {
  isActive: boolean;
  isAllowed: boolean;
  onToggle: () => void;
}

export interface MapControlsSpecialSources {
  onSignalAirClick: () => void;
  onMobileAirClick: () => void;
  isSignalAirVisible: boolean;
  isMobileAirVisible: boolean;
  onSignalAirToggle: (visible: boolean) => void;
  onMobileAirToggle: (visible: boolean) => void;
  hasSignalAirData: boolean;
  hasMobileAirData: boolean;
}

export interface MapControlsUi {
  /** Ex-`headerDisabled` : mode historique actif ET lecture en cours */
  controlsLocked: boolean;
  onOpenInfoModal: () => void;
  onToast: (toast: Omit<Toast, "id">) => void;
  /**
   * Notices de niveau application (maintenance, chargement, erreur de données).
   *
   * Elles voyagent par contexte pour rejoindre la pile unique rendue dans la
   * colonne carte, au lieu d'être posées séparément dans App.tsx où elles
   * chevauchaient les notices de couches.
   */
  notices: Notice[];
}

export interface MapControlsValue {
  brand: MapControlsBrand;
  filters: MapControlsFilters;
  modeling: MapControlsModeling;
  refresh: MapControlsRefresh;
  historical: MapControlsHistorical;
  specialSources: MapControlsSpecialSources;
  ui: MapControlsUi;
}

export const MapControlsContext =
  createContext<MapControlsValue | null>(null);

export const useMapControls = (): MapControlsValue => {
  const value = useContext(MapControlsContext);
  if (!value) {
    throw new Error(
      "useMapControls doit être appelé dans un <MapControlsProvider>."
    );
  }
  return value;
};
