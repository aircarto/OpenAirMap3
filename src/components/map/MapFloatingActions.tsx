import React from "react";
// Type canonique : cette copie locale déclarait en plus un membre "compact" que
// ni useSidePanels, ni useSignalAir, ni useMobileAir n'ont jamais produit.
import type { PanelSize } from "../panels/SidePanelShell";

export interface SidePanelsProps {
  isSidePanelOpen: boolean;
  panelSize: PanelSize;
  comparisonState: { isComparisonMode: boolean };
  handleSidePanelSizeChange: (size: PanelSize) => void;
}

export interface SignalAirProps {
  isSignalAirDetailPanelOpen: boolean;
  signalAirDetailPanelSize: PanelSize;
  selectedSignalAirReport: { signalType?: string | null } | null;
  handleSignalAirDetailPanelSizeChange: (size: PanelSize) => void;
}

export interface MobileAirProps {
  mobileAirRoutes: unknown[];
  mobileAirDetailPanelSize: PanelSize;
  handleOpenMobileAirDetailPanel: () => void;
}

export interface MapFloatingActionsProps {
  sidePanels: SidePanelsProps;
  signalAir: SignalAirProps;
  mobileAir: MobileAirProps;
  isComparisonPanelVisible: boolean;
  t: (key: string) => string;
}

const getSignalAirIconPath = (signalType?: string | null): string => {
  if (!signalType) return "/markers/signalAirMarkers/odeur.png";
  const typeMap: Record<string, string> = {
    odeur: "odeur",
    bruit: "bruits",
    brulage: "brulage",
    visuel: "visuel",
    pollen: "pollen",
  };
  const mappedType = typeMap[signalType.toLowerCase()] || "odeur";
  return `/markers/signalAirMarkers/${mappedType}.png`;
};

const MapFloatingActions: React.FC<MapFloatingActionsProps> = ({
  sidePanels,
  signalAir,
  mobileAir,
  isComparisonPanelVisible,
  t,
}) => {
  const otherButtons: Array<{ key: string; element: React.ReactElement }> = [];
  const signalAirButtons: Array<{ key: string; element: React.ReactElement }> = [];
  const mobileAirButtons: Array<{ key: string; element: React.ReactElement }> = [];

  if (
    (sidePanels.isSidePanelOpen || isComparisonPanelVisible) &&
    sidePanels.panelSize === "hidden"
  ) {
    otherButtons.push({
      key: "station-panel",
      element: (
        <button
          key="station-panel"
          onClick={() => sidePanels.handleSidePanelSizeChange("normal")}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title={
            sidePanels.comparisonState.isComparisonMode
              ? t("panels.openComparisonPanel")
              : t("panels.openDataPanel")
          }
          aria-label={
            sidePanels.comparisonState.isComparisonMode
              ? t("panels.openComparisonPanel")
              : t("panels.openDataPanel")
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>
      ),
    });
  }

  if (
    signalAir.isSignalAirDetailPanelOpen &&
    signalAir.signalAirDetailPanelSize === "hidden" &&
    signalAir.selectedSignalAirReport
  ) {
    signalAirButtons.push({
      key: "signalair-panel",
      element: (
        <button
          key="signalair-panel"
          onClick={() => signalAir.handleSignalAirDetailPanelSizeChange("normal")}
          className="block rounded-full hover:opacity-80 transition-opacity overflow-hidden p-0 border-0"
          title="Rouvrir le panneau SignalAir"
          aria-label={t("panels.openSignalAirPanel")}
        >
          <img
            src={getSignalAirIconPath(signalAir.selectedSignalAirReport.signalType)}
            alt={`Type: ${signalAir.selectedSignalAirReport.signalType || "signalement"}`}
            className="w-12 h-12 object-cover rounded-full block m-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/markers/signalAirMarkers/odeur.png";
            }}
          />
        </button>
      ),
    });
  }

  if (
    mobileAir.mobileAirRoutes.length > 0 &&
    mobileAir.mobileAirDetailPanelSize === "hidden"
  ) {
    mobileAirButtons.push({
      key: "mobileair-detail-panel",
      element: (
        <button
          key="mobileair-detail-panel"
          onClick={mobileAir.handleOpenMobileAirDetailPanel}
          className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
          title="Rouvrir le panneau MobileAir (détail)"
          aria-label={t("panels.openMobileAirPanel")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>
      ),
    });
  }

  const totalButtons =
    otherButtons.length + signalAirButtons.length + mobileAirButtons.length;
  if (totalButtons === 0) return null;

  const all = [...otherButtons, ...signalAirButtons, ...mobileAirButtons];

  // Ni enveloppe ni ancrage : le conteneur est fourni par l'appelant, à savoir
  // la section « raccourcis » du rail de contrôles. L'ancienne enveloppe
  // `fixed left-2 top-1/2` doublonnait le rail et restait par-dessus les
  // panneaux latéraux au lieu de se décaler avec la colonne carte.
  //
  // Le `hover:scale-110` d'origine est retiré : un agrandissement au survol
  // décale la mise en page de ses voisins dans une colonne étroite.
  return (
    <>
      {all.map((btn, index) => (
        <div
          key={btn.key}
          className="animate-scale-in shrink-0"
          style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
        >
          {btn.element}
        </div>
      ))}
    </>
  );
};

export default MapFloatingActions;
