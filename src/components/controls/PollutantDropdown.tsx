import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  pollutants,
  isPollutantSupportedForTimeStep,
  POLLUTANT_CATEGORY_ORDER,
} from "../../constants/pollutants";
import type { Pollutant, PollutantCategory } from "../../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { DropdownButton } from "./DropdownButton";
import type { CustomTriggerProps } from "./dropdownTriggerContract";
import { cn } from "../../lib/utils";

interface PollutantDropdownProps extends CustomTriggerProps {
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
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
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

  const pollutantsByCategory = useMemo(() => {
    const groups = new Map<PollutantCategory, Array<[string, Pollutant]>>();
    for (const entry of availablePollutants) {
      const category = entry[1].category;
      const list = groups.get(category);
      if (list) list.push(entry);
      else groups.set(category, [entry]);
    }
    return POLLUTANT_CATEGORY_ORDER.filter((category) =>
      groups.has(category)
    ).map((category) => ({
      category,
      items: groups.get(category)!,
    }));
  }, [availablePollutants]);

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
        {renderTrigger ? (
          renderTrigger({ displayText: getDisplayText() })
        ) : (
          <DropdownButton
            id={triggerId}
            data-tour="global-pollutant"
            className="min-w-[72px] max-w-[140px]"
          >
            <span className="block truncate pr-6">{getDisplayText()}</span>
          </DropdownButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuAlign ?? "start"}
        alignOffset={0}
        sideOffset={menuSideOffset}
        className={cn(
          !renderTrigger && "w-[var(--radix-dropdown-menu-trigger-width)]",
          menuClassName
        )}
      >
        <DropdownMenuRadioGroup
          value={selectedPollutant}
          onValueChange={onPollutantChange}
        >
          {pollutantsByCategory.map(({ category, items }, sectionIndex) => (
            <div key={category} role="group">
              {sectionIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t(`pollutants.categories.${category}`)}
              </DropdownMenuLabel>
              {items.map(([code]) => (
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
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PollutantDropdown;
