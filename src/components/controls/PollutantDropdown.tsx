import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  pollutants,
  isPollutantSupportedForTimeStep,
} from "../../constants/pollutants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

interface PollutantDropdownProps {
  selectedPollutant: string;
  onPollutantChange: (pollutant: string) => void;
  selectedTimeStep?: string;
}

const PollutantDropdown: React.FC<PollutantDropdownProps> = ({
  selectedPollutant,
  onPollutantChange,
  selectedTimeStep,
}) => {
  const { t } = useTranslation();
  const availablePollutants = useMemo(
    () =>
      Object.entries(pollutants).filter(([code]) =>
        selectedTimeStep
          ? isPollutantSupportedForTimeStep(code, selectedTimeStep)
          : true
      ),
    [selectedTimeStep]
  );

  const getDisplayText = () => {
    const pollutant = pollutants[selectedPollutant];
    const isSupported =
      pollutant &&
      (!selectedTimeStep ||
        isPollutantSupportedForTimeStep(selectedPollutant, selectedTimeStep));

    if (isSupported) {
      return t(`pollutants.${selectedPollutant}`);
    }

    if (availablePollutants.length > 0) {
      return t(`pollutants.${availablePollutants[0][0]}`);
    }

    return t("pollutants.noAvailable");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 text-gray-800 hover:from-gray-100 hover:to-gray-50 hover:border-gray-300 shadow-sm backdrop-blur-sm rounded-lg pl-3 pr-7 py-2 text-left text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3] min-w-[72px] max-w-[140px]"
        >
          <span className="block truncate pr-6">{getDisplayText()}</span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-gray-600">
            <svg
              className="h-4 w-4 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        alignOffset={0}
        className="w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        <DropdownMenuRadioGroup
          value={selectedPollutant}
          onValueChange={onPollutantChange}
        >
          {availablePollutants.map(([code, pollutant]) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              className={cn(
                "py-2 pr-3 text-sm",
                selectedPollutant === code &&
                  "bg-[#e7eef8] text-[#1f3c6d]"
              )}
            >
              {t(`pollutants.${code}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PollutantDropdown;
