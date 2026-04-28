import React from "react";

type PanelSize = "normal" | "compact" | "fullscreen" | "hidden";

interface SidePanelsProps {
  isSidePanelOpen: boolean;
  panelSize: PanelSize;
  comparisonState: { isComparisonMode: boolean };
  handleSidePanelSizeChange: (size: PanelSize) => void;
}

interface SignalAirProps {
  isSignalAirDetailPanelOpen: boolean;
  signalAirDetailPanelSize: PanelSize;
  selectedSignalAirReport: { signalType?: string | null } | null;
  handleSignalAirDetailPanelSizeChange: (size: PanelSize) => void;
  isSignalAirPanelOpen: boolean;
  signalAirPanelSize: PanelSize;
  handleOpenSignalAirPanel: () => void;
  handleSignalAirPanelSizeChange: (size: PanelSize) => void;
}

interface MobileAirProps {
  mobileAirRoutes: unknown[];
  mobileAirDetailPanelSize: PanelSize;
  handleOpenMobileAirDetailPanel: () => void;
  isMobileAirSelectionPanelOpen: boolean;
  mobileAirSelectionPanelSize: PanelSize;
  handleOpenMobileAirSelectionPanel: () => void;
  handleMobileAirSelectionPanelSizeChange: (size: PanelSize) => void;
}

interface MapFloatingActionsProps {
  sidePanels: SidePanelsProps;
  signalAir: SignalAirProps;
  mobileAir: MobileAirProps;
  isComparisonPanelVisible: boolean;
  selectedSources: string[];
  t: (key: string) => string;
}

const SIGNAL_AIR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" id="signalair-animated-svg" viewBox="0 0 792 612" style="white-space: preserve-spaces; width: 100%; height: 100%;"><path id="_a0" class="st0" d="M380.866,538.315L380.866,471.282C401.428,470.066,419.964,462.064,434.247,448.896L491.914639,519.188078C488.16663900000003,524.2530780000001,484.823639,529.419078,484.823639,536.003078C484.823639,544.714078,487.863639,552.007078,493.838639,557.882078C499.91663900000003,563.858078,507.108639,566.796078,515.515639,566.796078C523.922639,566.796078,531.215639,563.858078,537.192639,557.882078C543.269639,552.007078,546.207639,544.613078,546.207639,536.003078C546.207639,527.5950780000001,543.168639,520.404078,537.192639,514.427078C531.114639,508.452078,523.922639,505.514078,515.515639,505.514078C508.931639,505.514078,503.765639,508.85707799999994,498.599639,512.4020780000001L440.629,441.603C444.883,436.64,448.529,431.17,451.568,425.295L572.481928,479.81335C570.758928,484.77735,569.442928,489.84235,569.442928,495.51435C569.442928,509.59435,574.304928,521.34435,584.1299280000001,530.96635C593.955928,540.58935,605.603928,545.35035,619.277928,545.35035C632.952928,545.35035,644.702928,540.58935,654.426928,530.96635C664.251928,521.34435,669.113928,509.59435,669.113928,495.51435C669.113928,481.84035,664.251928,470.19135,654.426928,460.56835C644.601928,450.94535,632.952928,446.18435,619.277928,446.18435C605.603928,446.18435,593.853928,450.94535,584.1299280000001,460.56835C580.8889280000001,463.80935,578.963928,467.55735,576.7359280000001,471.20435L456.024,416.786C459.772,407.063,462.305,396.731,462.305,385.791C462.305,370.394,457.24,356.821,450.149,344.261L581.239503,260.737097C582.555503,262.357097,583.164503,264.282097,584.683503,265.801097C594.509503,275.424097,606.157503,280.185097,619.831503,280.185097C633.506503,280.185097,645.256503,275.424097,654.980503,265.801097C664.805503,256.178097,669.667503,244.428097,669.667503,230.349097C669.667503,216.674097,664.805503,205.026097,654.980503,195.403097C645.155503,185.780097,633.506503,181.019097,619.831503,181.019097C606.157503,181.019097,594.407503,185.780097,584.683503,195.403097C574.858503,205.026097,569.996503,216.674097,569.996503,230.349097C569.996503,238.756097,572.326503,246.151097,575.871503,252.937097L444.883,336.462C440.932,330.89,436.881,325.724,431.715,321.268L519.105747,207.88322200000002C522.3467469999999,209.40122200000002,525.2847469999999,212.035222,529.133747,212.035222C535.9197469999999,212.035222,541.795747,209.60422200000002,546.757747,204.844222C551.6207469999999,200.083222,554.050747,194.106222,554.050747,187.117222C554.050747,180.33122200000003,551.6207469999999,174.45622200000003,546.757747,169.695222C541.896747,164.934222,536.021747,162.50322200000002,529.133747,162.50322200000002C522.3467469999999,162.50322200000002,516.4717469999999,164.934222,511.508747,169.695222C506.646747,174.45622200000003,504.215747,180.33122200000003,504.215747,187.117222C504.215747,193.499222,506.84974700000004,198.665222,510.900747,203.22322200000002L423.915,316.001C412.165,307.897,398.794,302.529,383.803,301.211C386.032,266.57,384.819,230.190091,385.933,206.690091C390.896,205.880091,395.758,204.866091,399.505,201.119091C404.368,196.358091,406.798,190.382091,406.798,183.392091C406.798,176.606091,404.368,170.731091,399.505,165.970091C394.644,161.210091,388.769,158.778091,381.881,158.778091C375.094,158.778091,369.219,161.210091,364.256,165.970091C359.394,170.731091,356.963,176.606091,356.963,183.392091C356.963,190.382091,359.394,196.358091,364.256,201.119091C367.599,204.461091,372.156,205.069091,376.411,206.082091C375.297,228.063091,376.612,263.227,374.282,300.098C371.749,300.199,369.521,301.313,366.988,301.617L339.073223,131.237808C347.378223,129.10980800000002,355.177223,125.665808,361.661223,119.183808C371.486223,109.560808,376.347223,97.810808,376.347223,83.73096290000001C376.347223,70.05636290000001,371.486223,58.4077629,361.661223,48.7849629C351.835223,39.162262899999995,340.186223,34.4014629,326.512223,34.4014629C312.837223,34.4014629,301.087223,39.162262899999995,291.363223,48.7849629C281.538223,58.4077629,276.676223,70.05636290000001,276.676223,83.73096290000001C276.676223,97.810808,281.538223,109.560808,291.363223,119.183808C301.188223,128.805808,312.837223,133.566808,326.512223,133.566808C327.728223,133.566808,328.639223,133.060808,329.753223,132.958808L357.67,303.44C338.019,307.897,321.306,318.229,309.252,333.524L209.44054400000002,263.60395C210.757544,260.56595,213.188544,258.13495,213.188544,254.48795C213.188544,247.70195,210.757544,241.82695,205.895544,237.06595C201.032544,232.30495000000002,195.157544,229.87495,188.269544,229.87495C181.382544,229.87495,175.608544,232.30495000000002,170.645544,237.06595C165.783544,241.82695,163.35154400000002,247.70195,163.35154400000002,254.48795C163.35154400000002,261.47794999999996,165.783544,267.45394999999996,170.645544,272.21495C175.507544,276.97595,181.382544,279.40594999999996,188.269544,279.40594999999996C194.955544,279.40594999999996,200.627544,276.97595,205.388544,272.41695L303.884,341.425C298.819,349.528,295.578,358.139,293.349,367.761C267.924,363.507,236.63346,357.76704,216.47546,354.12004C216.78046,351.89204,217.69146,349.96704,217.69146,347.63704C217.69146,333.96304000000003,212.82946,322.31404000000003,203.00446,312.69104000000004C193.17846,303.06804,181.53046,298.30704000000003,167.85646,298.30704000000003C154.18146000000002,298.30704000000003,142.43146000000002,303.06804,132.70746,312.69104000000004C122.8824417,322.31404000000003,118.0204417,333.96304000000003,118.0204417,347.63704C118.0204417,361.71704,122.8824417,373.46704,132.70746,383.08904C142.53246000000001,392.71204,154.18146000000002,397.47304,167.85646,397.47304C181.53046,397.47304,193.28046,392.71204,203.00446,383.08904C208.77846,377.41704000000004,212.32346,370.73204000000004,214.65246000000002,363.54004000000003C231.46746000000002,366.68004,261.746,372.319,291.424,377.182C291.121,380.22,289.703,382.854,289.703,385.993C289.703,431.879,325.864,468.648,371.142,471.18L371.142,538.214C366.786,539.126,362.735,540.746,359.392,544.089C354.833,548.546,352.504,554.015,352.504,560.3960000000001C352.504,566.98,354.833,572.552,359.392,577.009C363.949,581.466,369.521,583.7950000000001,375.903,583.7950000000001C382.284,583.7950000000001,387.855,581.566,392.412,577.009C396.971,572.552,399.301,566.98,399.301,560.3960000000001C399.301,554.015,396.971,548.546,392.412,544.089C389.273,540.847,385.221,539.126,380.866,538.315Z" fill="#13A0DB" transform="translate(410.705,319.5) translate(-395.705,-319.27)"></path></svg>`;

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
  selectedSources,
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
    selectedSources.includes("signalair") &&
    (!signalAir.isSignalAirPanelOpen || signalAir.signalAirPanelSize === "hidden")
  ) {
    signalAirButtons.push({
      key: "signalair-selection-panel",
      element: (
        <button
          key="signalair-selection-panel"
          onClick={() => {
            if (!signalAir.isSignalAirPanelOpen) {
              signalAir.handleOpenSignalAirPanel();
            }
            signalAir.handleSignalAirPanelSizeChange("normal");
          }}
          className="block rounded-full hover:opacity-80 transition-opacity overflow-hidden p-0 border-2"
          title="Rouvrir le panneau de sélection SignalAir"
          aria-label={t("panels.openSignalAirSelection")}
        >
          <div
            id="signalair-svg-container"
            className="w-11 h-11 object-cover rounded-full block m-0"
            dangerouslySetInnerHTML={{ __html: SIGNAL_AIR_ICON_SVG }}
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

  if (
    selectedSources.includes("communautaire.mobileair") &&
    (!mobileAir.isMobileAirSelectionPanelOpen ||
      mobileAir.mobileAirSelectionPanelSize === "hidden")
  ) {
    mobileAirButtons.push({
      key: "mobileair-selection-panel",
      element: (
        <button
          key="mobileair-selection-panel"
          onClick={() => {
            if (!mobileAir.isMobileAirSelectionPanelOpen) {
              mobileAir.handleOpenMobileAirSelectionPanel();
            }
            mobileAir.handleMobileAirSelectionPanelSizeChange("normal");
          }}
          className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
          title="Rouvrir le panneau de sélection MobileAir"
          aria-label={t("panels.openMobileAirSelection")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="5" y="4" width="14" height="16" rx="2" ry="2" strokeWidth={1.5} />
            <path strokeLinecap="round" strokeWidth={1.5} d="M9 8h6M9 12h6M9 16h3" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 16c1.2-1 1.2-3 0-4"
            />
          </svg>
        </button>
      ),
    });
  }

  const totalButtons =
    otherButtons.length + signalAirButtons.length + mobileAirButtons.length;
  if (totalButtons === 0) return null;

  return (
    <div
      className="fixed left-2 top-1/2 -translate-y-1/2 z-[2001] 
                 bg-stone-50/60 backdrop-blur-sm rounded-xl shadow-xl border border-stone-200/40 
                 flex flex-col gap-2.5 p-2.5
                 animate-slide-in-left transition-all duration-300 ease-out
                 hover:bg-stone-50/95 hover:shadow-2xl hover:border-stone-300/80
                 opacity-70 hover:opacity-100"
    >
      {otherButtons.map((btn, index) => (
        <div
          key={btn.key}
          className="animate-scale-in transition-all duration-200 ease-out 
                     hover:scale-110 hover:z-10 transform-gpu"
          style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
        >
          {btn.element}
        </div>
      ))}

      {signalAirButtons.length > 0 && (
        <div className={`flex flex-col gap-1 ${otherButtons.length > 0 ? "mt-3" : ""}`}>
          {signalAirButtons.map((btn, index) => (
            <div
              key={btn.key}
              className="animate-scale-in transition-all duration-200 ease-out 
                         hover:scale-110 hover:z-10 transform-gpu"
              style={{
                animationDelay: `${(otherButtons.length + index) * 60}ms`,
                animationFillMode: "both",
              }}
            >
              {btn.element}
            </div>
          ))}
        </div>
      )}

      {mobileAirButtons.length > 0 && (
        <div
          className={`flex flex-col gap-1 ${
            otherButtons.length > 0 || signalAirButtons.length > 0 ? "mt-3" : ""
          }`}
        >
          {mobileAirButtons.map((btn, index) => (
            <div
              key={btn.key}
              className="animate-scale-in transition-all duration-200 ease-out 
                         hover:scale-110 hover:z-10 transform-gpu"
              style={{
                animationDelay: `${
                  (otherButtons.length + signalAirButtons.length + index) * 60
                }ms`,
                animationFillMode: "both",
              }}
            >
              {btn.element}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapFloatingActions;
