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
 *   les props (fond de carte, panneaux latéraux).
 *
 * SignalAir et MobileAir étaient du second groupe tant que leur interface de
 * sélection vivait dans des panneaux latéraux. Leur activation et leur brouillon
 * de sélection appartiennent à App, et le menu qui les pilote vit dans le rail :
 * ils passent donc par le contexte (voir `MapControlsCommunitySources`). Seul le
 * chargement d'un parcours MobileAir reste en props, parce qu'il doit d'abord
 * purger les parcours détenus par la carte.
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

/**
 * SignalAir et MobileAir — les deux sources communautaires qui ne passent pas
 * par `selectedSources`.
 *
 * Elles ont leur propre couple activé/visible parce qu'activer ne suffit pas à
 * afficher quoi que ce soit : il faut d'abord choisir des types de signalement
 * ou un capteur, puis demander un chargement. `useAirQualityData` les traite
 * d'ailleurs à part (`isSourceSelected` reçoit le booléen, pas l'appartenance à
 * `selectedSources`).
 *
 * Nommé « community » et non « special » : c'est ce qu'elles sont — des données
 * remontées par le public, à côté des capteurs communautaires du même menu.
 */
export interface MapControlsCommunitySources {
  isSignalAirEnabled: boolean;
  isMobileAirEnabled: boolean;
  /**
   * Bascule l'activation. `false` ne se contente pas d'éteindre : il réinitialise
   * aussi la sélection, sans quoi une réactivation ferait réapparaître les
   * signalements ou les parcours de la session précédente.
   */
  onSignalAirEnabledChange: (enabled: boolean) => void;
  onMobileAirEnabledChange: (enabled: boolean) => void;
  /** Affichage des marqueurs, indépendant de l'activation */
  isSignalAirVisible: boolean;
  isMobileAirVisible: boolean;
  onSignalAirToggle: (visible: boolean) => void;
  onMobileAirToggle: (visible: boolean) => void;
  hasSignalAirData: boolean;
  hasMobileAirData: boolean;

  /**
   * Brouillon de sélection SignalAir : modifié librement, puis validé par
   * `onSignalAirLoadRequest`, qui seul déclenche une requête. Le découplage est
   * volontaire — cocher un type ne doit pas relancer un chargement.
   */
  signalAirSelectedTypes: string[];
  onSignalAirTypesChange: (types: string[]) => void;
  signalAirDraftPeriod: { startDate: string; endDate: string };
  onSignalAirDraftPeriodChange: (startDate: string, endDate: string) => void;
  onSignalAirLoadRequest: () => void;
  isSignalAirLoading: boolean;
  signalAirHasLoaded: boolean;
  signalAirReportsCount: number;

  /** Ouvrent les panneaux latéraux de sélection — voués à disparaître */
  onSignalAirClick: () => void;
  onMobileAirClick: () => void;
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
  communitySources: MapControlsCommunitySources;
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
