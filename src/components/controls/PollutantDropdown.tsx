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
import { DropdownButton } from "./DropdownButton";
import { cn } from "../../lib/utils";

interface PollutantDropdownProps {
  selectedPollutant: string;
  onPollutantChange: (pollutant: string) => void;
  selectedTimeStep?: string;
  /** Id du trigger pour association avec un <label htmlFor> (accessibilité) */
  triggerId?: string;
}

const PollutantDropdown: React.FC<PollutantDropdownProps> = ({
  selectedPollutant,
  onPollutantChange,
  selectedTimeStep,
  triggerId,
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
        <DropdownButton
          id={triggerId}
          data-tour="global-pollutant"
          className="min-w-[72px] max-w-[140px]"
        >
          <span className="block truncate pr-6">{getDisplayText()}</span>
        </DropdownButton>
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
