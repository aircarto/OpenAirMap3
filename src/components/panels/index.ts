/**
 * Export des composants de panneaux latéraux
 */

// Coquille commune : surface, tailles, en-tête, animation de sortie
export { default as SidePanelShell, PANEL_EXIT_MS } from "./SidePanelShell";
export type { PanelSize, SidePanelShellProps } from "./SidePanelShell";
export { default as SidePanelHeader } from "./SidePanelHeader";
export { default as PanelReopenBadge } from "./PanelReopenBadge";

export { default as StationSidePanel } from "./StationSidePanel";
export { default as MicroSidePanel } from "./MicroSidePanel";
export { default as ComparisonSidePanel } from "./ComparisonSidePanel";
export { default as NebuleAirSidePanel } from "./NebuleAirSidePanel";
export { default as PurpleAirSidePanel } from "./PurpleAirSidePanel";
export { default as SensorCommunitySidePanel } from "./SensorCommunitySidePanel";
export { default as MobileAirDetailPanel } from "./MobileAirDetailPanel";
export { default as MobileAirSelectionPanel } from "./MobileAirSelectionPanel";
export { default as SignalAirDetailPanel } from "./SignalAirDetailPanel";
export { default as SignalAirSelectionPanel } from "./SignalAirSelectionPanel";

