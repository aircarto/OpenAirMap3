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

/** Raccourcis de réouverture des panneaux, ex-MapFloatingActions */
export interface RailShortcutsBinding {
  sidePanels: SidePanelsProps;
  signalAir: SignalAirProps;
  mobileAir: MobileAirProps;
  isComparisonPanelVisible: boolean;
  selectedSources: string[];
}
