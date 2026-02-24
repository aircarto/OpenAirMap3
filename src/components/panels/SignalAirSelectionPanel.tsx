import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SignalAirPeriodSelector from "../controls/SignalAirPeriodSelector";
import { getMarkerPath } from "../../utils";

type PanelSize = "normal" | "fullscreen" | "hidden";

interface SignalAirSelectionPanelProps {
  isOpen: boolean;
  selectedPollutant: string;
  selectedTypes: string[];
  period: { startDate: string; endDate: string };
  onClose: () => void;
  onTypesChange: (types: string[]) => void;
  onPeriodChange: (startDate: string, endDate: string) => void;
  onLoadReports: () => void;
  onSizeChange?: (size: PanelSize) => void;
  onHidden?: () => void;
  panelSize?: PanelSize;
  isLoading?: boolean;
  hasLoaded?: boolean;
  reportsCount?: number;
}

const SIGNAL_TYPE_IDS = [
  "odeur",
  "bruit",
  "brulage",
  "visuel",
] as const;

const SignalAirSelectionPanel: React.FC<SignalAirSelectionPanelProps> = ({
  isOpen,
  selectedPollutant,
  selectedTypes,
  period,
  onClose,
  onTypesChange,
  onPeriodChange,
  onLoadReports,
  onSizeChange,
  onHidden,
  panelSize: externalPanelSize,
  isLoading = false,
  hasLoaded = false,
  reportsCount = 0,
}) => {
  const { t } = useTranslation();
  const [internalPanelSize, setInternalPanelSize] =
    useState<PanelSize>("normal");

  const currentPanelSize = externalPanelSize || internalPanelSize;

  const markerPreview = useMemo(
    () =>
      SIGNAL_TYPE_IDS.map((id) => ({
        id,
        markerPath: getMarkerPath("signalair", id),
      })),
    []
  );

  const handlePanelSizeChange = (newSize: PanelSize) => {
    if (onSizeChange) {
      onSizeChange(newSize);
    } else {
      setInternalPanelSize(newSize);
    }

    if (newSize === "hidden" && onHidden) {
      onHidden();
    }
  };

  const handleTypeToggle = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onTypesChange(selectedTypes.filter((id) => id !== typeId));
    } else {
      onTypesChange([...selectedTypes, typeId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTypes.length === SIGNAL_TYPE_IDS.length) {
      onTypesChange([]);
    } else {
      onTypesChange([...SIGNAL_TYPE_IDS]);
    }
  };

  const getPanelClasses = () => {
    const baseClasses =
      "bg-white shadow-xl flex flex-col border-l border-gray-200 transition-all duration-300 h-full md:h-[calc(100vh-64px)] relative z-[1500]";

    switch (currentPanelSize) {
      case "fullscreen":
        // En fullscreen, utiliser absolute pour ne pas affecter le layout de la carte
        return `${baseClasses} absolute inset-0 w-full max-w-full`;
      case "hidden":
        return `${baseClasses} hidden`;
      case "normal":
      default:
        return `${baseClasses} w-full sm:w-[360px] md:w-[420px] lg:w-[480px] xl:w-[520px]`;
    }
  };

  if (!isOpen) {
    return null;
  }

  const pollutantLabel = t(`pollutants.${selectedPollutant}`, {
    defaultValue: selectedPollutant,
  });

  const isLoadDisabled = selectedTypes.length === 0 || isLoading;

  return (
    <div className={getPanelClasses()}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {t("panels.signalAirSelection.title")}
            </h2>
            {/* Rappel visuel du bouton de réouverture */}
            <div className="p-1 rounded bg-[#13A0DB]/10 border border-[#13A0DB]/30" title={t("panels.signalAirSelection.reopenButtonTooltip")}>
              <div
                className="w-5 h-5"
                dangerouslySetInnerHTML={{
                  __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 792 612" style="width: 100%; height: 100%;"><path d="M380.866,538.315L380.866,471.282C401.428,470.066,419.964,462.064,434.247,448.896L491.914639,519.188078C488.16663900000003,524.2530780000001,484.823639,529.419078,484.823639,536.003078C484.823639,544.714078,487.863639,552.007078,493.838639,557.882078C499.91663900000003,563.858078,507.108639,566.796078,515.515639,566.796078C523.922639,566.796078,531.215639,563.858078,537.192639,557.882078C543.269639,552.007078,546.207639,544.613078,546.207639,536.003078C546.207639,527.5950780000001,543.168639,520.404078,537.192639,514.427078C531.114639,508.452078,523.922639,505.514078,515.515639,505.514078C508.931639,505.514078,503.765639,508.85707799999994,498.599639,512.4020780000001L440.629,441.603C444.883,436.64,448.529,431.17,451.568,425.295L572.481928,479.81335C570.758928,484.77735,569.442928,489.84235,569.442928,495.51435C569.442928,509.59435,574.304928,521.34435,584.1299280000001,530.96635C593.955928,540.58935,605.603928,545.35035,619.277928,545.35035C632.952928,545.35035,644.702928,540.58935,654.426928,530.96635C664.251928,521.34435,669.113928,509.59435,669.113928,495.51435C669.113928,481.84035,664.251928,470.19135,654.426928,460.56835C644.601928,450.94535,632.952928,446.18435,619.277928,446.18435C605.603928,446.18435,593.853928,450.94535,584.1299280000001,460.56835C580.8889280000001,463.80935,578.963928,467.55735,576.7359280000001,471.20435L456.024,416.786C459.772,407.063,462.305,396.731,462.305,385.791C462.305,370.394,457.24,356.821,450.149,344.261L581.239503,260.737097C582.555503,262.357097,583.164503,264.282097,584.683503,265.801097C594.509503,275.424097,606.157503,280.185097,619.831503,280.185097C633.506503,280.185097,645.256503,275.424097,654.980503,265.801097C664.805503,256.178097,669.667503,244.428097,669.667503,230.349097C669.667503,216.674097,664.805503,205.026097,654.980503,195.403097C645.155503,185.780097,633.506503,181.019097,619.831503,181.019097C606.157503,181.019097,594.407503,185.780097,584.683503,195.403097C574.858503,205.026097,569.996503,216.674097,569.996503,230.349097C569.996503,238.756097,572.326503,246.151097,575.871503,252.937097L444.883,336.462C440.932,330.89,436.881,325.724,431.715,321.268L519.105747,207.88322200000002C522.3467469999999,209.40122200000002,525.2847469999999,212.035222,529.133747,212.035222C535.9197469999999,212.035222,541.795747,209.60422200000002,546.757747,204.844222C551.6207469999999,200.083222,554.050747,194.106222,554.050747,187.117222C554.050747,180.33122200000003,551.6207469999999,174.45622200000003,546.757747,169.695222C541.896747,164.934222,536.021747,162.50322200000002,529.133747,162.50322200000002C522.3467469999999,162.50322200000002,516.4717469999999,164.934222,511.508747,169.695222C506.646747,174.45622200000003,504.215747,180.33122200000003,504.215747,187.117222C504.215747,193.499222,506.84974700000004,198.665222,510.900747,203.22322200000002L423.915,316.001C412.165,307.897,398.794,302.529,383.803,301.211C386.032,266.57,384.819,230.190091,385.933,206.690091C390.896,205.880091,395.758,204.866091,399.505,201.119091C404.368,196.358091,406.798,190.382091,406.798,183.392091C406.798,176.606091,404.368,170.731091,399.505,165.970091C394.644,161.210091,388.769,158.778091,381.881,158.778091C375.094,158.778091,369.219,161.210091,364.256,165.970091C359.394,170.731091,356.963,176.606091,356.963,183.392091C356.963,190.382091,359.394,196.358091,364.256,201.119091C367.599,204.461091,372.156,205.069091,376.411,206.082091C375.297,228.063091,376.612,263.227,374.282,300.098C371.749,300.199,369.521,301.313,366.988,301.617L339.073223,131.237808C347.378223,129.10980800000002,355.177223,125.665808,361.661223,119.183808C371.486223,109.560808,376.347223,97.810808,376.347223,83.73096290000001C376.347223,70.05636290000001,371.486223,58.4077629,361.661223,48.7849629C351.835223,39.162262899999995,340.186223,34.4014629,326.512223,34.4014629C312.837223,34.4014629,301.087223,39.162262899999995,291.363223,48.7849629C281.538223,58.4077629,276.676223,70.05636290000001,276.676223,83.73096290000001C276.676223,97.810808,281.538223,109.560808,291.363223,119.183808C301.188223,128.805808,312.837223,133.566808,326.512223,133.566808C327.728223,133.566808,328.639223,133.060808,329.753223,132.958808L357.67,303.44C338.019,307.897,321.306,318.229,309.252,333.524L209.44054400000002,263.60395C210.757544,260.56595,213.188544,258.13495,213.188544,254.48795C213.188544,247.70195,210.757544,241.82695,205.895544,237.06595C201.032544,232.30495000000002,195.157544,229.87495,188.269544,229.87495C181.382544,229.87495,175.608544,232.30495000000002,170.645544,237.06595C165.783544,241.82695,163.35154400000002,247.70195,163.35154400000002,254.48795C163.35154400000002,261.47794999999996,165.783544,267.45394999999996,170.645544,272.21495C175.507544,276.97595,181.382544,279.40594999999996,188.269544,279.40594999999996C194.955544,279.40594999999996,200.627544,276.97595,205.388544,272.41695L303.884,341.425C298.819,349.528,295.578,358.139,293.349,367.761C267.924,363.507,236.63346,357.76704,216.47546,354.12004C216.78046,351.89204,217.69146,349.96704,217.69146,347.63704C217.69146,333.96304000000003,212.82946,322.31404000000003,203.00446,312.69104000000004C193.17846,303.06804,181.53046,298.30704000000003,167.85646,298.30704000000003C154.18146000000002,298.30704000000003,142.43146000000002,303.06804,132.70746,312.69104000000004C122.8824417,322.31404000000003,118.0204417,333.96304000000003,118.0204417,347.63704C118.0204417,361.71704,122.8824417,373.46704,132.70746,383.08904C142.53246000000001,392.71204,154.18146000000002,397.47304,167.85646,397.47304C181.53046,397.47304,193.28046,392.71204,203.00446,383.08904C208.77846,377.41704000000004,212.32346,370.73204000000004,214.65246000000002,363.54004000000003C231.46746000000002,366.68004,261.746,372.319,291.424,377.182C291.121,380.22,289.703,382.854,289.703,385.993C289.703,431.879,325.864,468.648,371.142,471.18L371.142,538.214C366.786,539.126,362.735,540.746,359.392,544.089C354.833,548.546,352.504,554.015,352.504,560.3960000000001C352.504,566.98,354.833,572.552,359.392,577.009C363.949,581.466,369.521,583.7950000000001,375.903,583.7950000000001C382.284,583.7950000000001,387.855,581.566,392.412,577.009C396.971,572.552,399.301,566.98,399.301,560.3960000000001C399.301,554.015,396.971,548.546,392.412,544.089C389.273,540.847,385.221,539.126,380.866,538.315Z" fill="#13A0DB" transform="translate(410.705,319.5) translate(-395.705,-319.27)"></path></svg>`
                }}
              />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">
            {pollutantLabel}
          </p>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() =>
              handlePanelSizeChange(
                currentPanelSize === "fullscreen" ? "normal" : "fullscreen"
              )
            }
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={
              currentPanelSize === "fullscreen"
                ? t("panels.shrinkPanel")
                : t("panels.fullscreen")
            }
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {currentPanelSize === "fullscreen" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              )}
            </svg>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={t("panels.closeAndDisableSignalAir")}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {currentPanelSize !== "hidden" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          

          {/* Types */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                {t("panels.signalAirSelection.typesTitle", {
                  selected: selectedTypes.length,
                  total: SIGNAL_TYPE_IDS.length,
                })}
              </h3>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedTypes.length === SIGNAL_TYPE_IDS.length
                  ? t("panels.signalAirSelection.deselectAll")
                  : t("panels.signalAirSelection.selectAll")}
              </button>
            </div>

            <div className="space-y-2">
              {markerPreview.map((type) => {
                const isSelected = selectedTypes.includes(type.id);

                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeToggle(type.id)}
                    className={`w-full flex items-start space-x-3 rounded-lg border p-3 transition-all ${
                      isSelected
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`mt-1 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <img
                        src={type.markerPath}
                        alt={t("panels.signalAirSelection.markerAlt", {
                          type: t(`panels.signalAirSelection.types.${type.id}.label`),
                        })}
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center space-x-1">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {t(`panels.signalAirSelection.types.${type.id}.label`)}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {t(`panels.signalAirSelection.types.${type.id}.description`)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {t("panels.signalAirSelection.periodTitle")}
            </h3>
            <SignalAirPeriodSelector
              startDate={period.startDate}
              endDate={period.endDate}
              onPeriodChange={onPeriodChange}
            />
          </div>

          {/* Load button */}
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
            <button
              onClick={onLoadReports}
              disabled={isLoadDisabled}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                isLoadDisabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}
            >
              {isLoading
                ? t("panels.loadingInProgress")
                : t("panels.signalAirSelection.loadReports")}
            </button>
            {selectedTypes.length === 0 && (
              <p className="text-xs text-red-600">
                {t("panels.signalAirSelection.selectAtLeastOne")}
              </p>
            )}
            {hasLoaded && selectedTypes.length > 0 && (
              <p className="text-xs text-gray-600">
                {reportsCount > 0
                  ? t("panels.signalAirSelection.reportsOnMap", {
                      count: reportsCount,
                    })
                  : t("panels.noReportFound")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SignalAirSelectionPanel;

