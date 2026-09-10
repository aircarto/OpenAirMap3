import type { BaseLayerKey } from "../../../constants/mapLayers";
import type {
  MobileAirProps,
  SidePanelsProps,
  SignalAirProps,
} from "../MapFloatingActions";
import type {
  BurnedAreaPeriod,
  HotspotPeriod,
} from "../../../services/EffisLayerService";

/**
 * État local à la carte, transmis au rail par props.
 *
 * Pendant du contexte MapControls : l'état applicatif voyage par contexte,
 * celui qui appartient à AirQualityMap voyage par props. Ces liaisons sont
 * regroupées ici pour que le rail et ses sections partagent un même type au
 * lieu de redéclarer une douzaine de props à chaque niveau.
 */
export interface BaseLayerControlBinding {
  currentBaseLayer: BaseLayerKey;
  onBaseLayerChange: (layer: BaseLayerKey) => void;
  isCommunalLayerEnabled: boolean;
  onCommunalLayerToggle: (enabled: boolean) => void;
  isEffisHotspotsEnabled: boolean;
  onEffisHotspotsToggle: (enabled: boolean) => void;
  effisHotspotsPeriod: HotspotPeriod;
  onEffisHotspotsPeriodChange: (period: HotspotPeriod) => void;
  isEffisBurnedAreasEnabled: boolean;
  onEffisBurnedAreasToggle: (enabled: boolean) => void;
  effisBurnedAreasPeriod: BurnedAreaPeriod;
  onEffisBurnedAreasPeriodChange: (period: BurnedAreaPeriod) => void;
  isWildfireLayerEnabled: boolean;
  onWildfireLayerToggle: (enabled: boolean) => void;
}

/**
 * Chargement d'un parcours MobileAir.
 *
 * Seul membre des sources communautaires à voyager par props plutôt que par le
 * contexte `MapControls` : il purge d'abord les parcours détenus par la carte
 * (`clearRoutes()` sur le singleton, `setMobileAirRoutes([])`, `forceNewChoice`)
 * avant de déléguer à App. Le faire passer par le contexte obligerait App à
 * connaître ce nettoyage, qui ne le concerne pas.
 */
export interface CommunitySourcesBinding {
  onMobileAirLoadRoute: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
}

/** Raccourcis de réouverture des panneaux, ex-MapFloatingActions */
export interface RailShortcutsBinding {
  sidePanels: SidePanelsProps;
  signalAir: SignalAirProps;
  mobileAir: MobileAirProps;
  isComparisonPanelVisible: boolean;
}
