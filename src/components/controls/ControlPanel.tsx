import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import PollutantDropdown from "./PollutantDropdown";
import SourceDropdown from "./SourceDropdown";
import TimeStepDropdown from "./TimeStepDropdown";

import { Toast } from "../ui/toast";

interface ControlPanelProps {
  selectedPollutant: string;
  selectedSources: string[];
  selectedTimeStep: string;
  onPollutantChange: (pollutant: string) => void;
  onSourceChange: (sources: string[]) => void;
  onTimeStepChange: (timeStep: string) => void;
  onToast?: (toast: Omit<Toast, "id">) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedPollutant,
  selectedSources,
  selectedTimeStep,
  onPollutantChange,
  onSourceChange,
  onTimeStepChange,
  onToast,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <div
        className={`bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ${
          isCollapsed ? "w-12 h-12" : "w-80 p-4"
        }`}
      >
        {/* Bouton de toggle avec icônes améliorées */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -top-2 -left-2 w-6 h-6 bg-[#4271B3] text-white rounded-full flex items-center justify-center text-xs hover:bg-[#325a96] transition-colors shadow-md z-[1001] group"
          title={isCollapsed ? t("controls.openControls") : t("controls.closeControls")}
        >
          {isCollapsed ? (
            <svg
              className="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {!isCollapsed && (
          <div className="space-y-3">
            <PollutantDropdown
              selectedPollutant={selectedPollutant}
              onPollutantChange={onPollutantChange}
              selectedTimeStep={selectedTimeStep}
            />
            <SourceDropdown
              selectedSources={selectedSources}
              selectedTimeStep={selectedTimeStep}
              onSourceChange={onSourceChange}
              onTimeStepChange={onTimeStepChange}
              onToast={onToast}
            />
            <TimeStepDropdown
              selectedTimeStep={selectedTimeStep}
              selectedSources={selectedSources}
              onTimeStepChange={onTimeStepChange}
              onSourceChange={onSourceChange}
              onToast={onToast}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
