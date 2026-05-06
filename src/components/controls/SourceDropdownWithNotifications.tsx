/**
 * EXEMPLE D'IMPLÉMENTATION - SourceDropdown avec système de notifications hybride
 * 
 * Cette version combine :
 * - Indicateurs visuels inline (badges d'avertissement)
 * - Notification contextuelle dans le dropdown
 * - Intégration avec le système de toast
 * 
 * Pour utiliser cette version, remplacez SourceDropdown par SourceDropdownWithNotifications
 * dans ControlPanel.tsx et App.tsx
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { sources } from "../../constants/sources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Checkbox } from "../ui/checkbox";
import { cn } from "../../lib/utils";
import {
  isSourceCompatibleWithTimeStep,
  getSourceDisplayName,
  getSupportedTimeStepsForSource,
  getFirstCompatibleTimeStep,
} from "../../utils/sourceCompatibility";
import { Toast } from "../ui/toast";

const COMMUNAUTAIRE_SOURCE_CODES = [
  "communautaire.nebuleair",
  "communautaire.sensorCommunity",
  "communautaire.purpleair",
] as const;

interface SourceDropdownWithNotificationsProps {
  selectedSources: string[];
  selectedTimeStep: string;
  onSourceChange: (sources: string[]) => void;
  onTimeStepChange?: (timeStep: string) => void;
  onToast?: (toast: Omit<Toast, "id">) => void; // Callback pour les toasts
}

const SourceDropdownWithNotifications: React.FC<
  SourceDropdownWithNotificationsProps
> = ({
  selectedSources,
  selectedTimeStep,
  onSourceChange,
  onTimeStepChange,
  onToast,
}) => {
  const { t } = useTranslation();
  const [incompatibleSource, setIncompatibleSource] = useState<string | null>(
    null
  );

  // Vérifier l'état des groupes
  const allCommunautaireSelected = useMemo(
    () =>
      COMMUNAUTAIRE_SOURCE_CODES.every((source) =>
        selectedSources.includes(source)
      ),
    [selectedSources]
  );
  const someCommunautaireSelected = useMemo(
    () =>
      COMMUNAUTAIRE_SOURCE_CODES.some((source) =>
        selectedSources.includes(source)
      ),
    [selectedSources]
  );

  // Vérifier les sources incompatibles
  const incompatibleSources = useMemo(() => {
    return selectedSources.filter(
      (source) => !isSourceCompatibleWithTimeStep(source, selectedTimeStep)
    );
  }, [selectedSources, selectedTimeStep]);

  const handleSourceToggle = (sourceCode: string) => {
    const isCurrentlySelected = selectedSources.includes(sourceCode);
    const isCompatible = isSourceCompatibleWithTimeStep(
      sourceCode,
      selectedTimeStep
    );

    if (!isCurrentlySelected && !isCompatible) {
      // L'utilisateur essaie d'activer une source incompatible
      setIncompatibleSource(sourceCode);

      // Afficher une notification toast
      if (onToast) {
        const supportedCodes = getSupportedTimeStepsForSource(sourceCode);
        const stepsLabel = supportedCodes
          .map((code) => t(`timeSteps.${code}`))
          .join(", ");
        const firstCompatibleStep = getFirstCompatibleTimeStep(sourceCode);
        const sourceName = getSourceDisplayName(sourceCode, t);

        onToast({
          title: t("toast.sourceUnavailable", { name: sourceName }),
          description: t("toast.sourceAvailableOnlyFor", { steps: stepsLabel }),
          variant: "warning",
          action: firstCompatibleStep && onTimeStepChange
            ? {
                label: t("toast.changeTo", {
                  label: t(`timeSteps.${firstCompatibleStep}`),
                }),
                onClick: () => {
                  onTimeStepChange(firstCompatibleStep);
                  setIncompatibleSource(null);
                },
              }
            : undefined,
          duration: 6000,
        });
      }

      // Ne pas activer la source, mais laisser l'utilisateur voir le message
      return;
    }

    // Comportement normal : activer/désactiver
    const newSources = isCurrentlySelected
      ? selectedSources.filter((s) => s !== sourceCode)
      : [...selectedSources, sourceCode];
    onSourceChange(newSources);
    setIncompatibleSource(null);
  };

  const handleGroupToggle = (groupCode: string) => {
    if (groupCode === "communautaire") {
      if (allCommunautaireSelected) {
        const newSources = selectedSources.filter(
          (source) => !COMMUNAUTAIRE_SOURCE_CODES.includes(source)
        );
        onSourceChange(newSources);
      } else {
        const newSources = [...selectedSources];
        COMMUNAUTAIRE_SOURCE_CODES.forEach((source) => {
          if (!newSources.includes(source)) {
            newSources.push(source);
          }
        });
        onSourceChange(newSources);
      }
    }
  };

  const getDisplayText = () => {
    if (selectedSources.length === 0) {
      return t("controls.chooseSources");
    }
    if (selectedSources.length === 1) {
      const source = selectedSources[0];
      return getSourceDisplayName(source, t);
    }
    return t("controls.sourcesSelected", { count: selectedSources.length });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative bg-gradient-to-br from-gray-50 to-white border text-gray-800 hover:from-gray-100 hover:to-gray-50 hover:border-gray-300 shadow-sm backdrop-blur-sm rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3] min-w-[180px]",
            incompatibleSources.length > 0
              ? "border-amber-300 bg-amber-50/50"
              : "border-gray-200/60"
          )}
        >
          <span className="block truncate pr-6">{getDisplayText()}</span>
          {incompatibleSources.length > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              !
            </span>
          )}
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
        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-96 overflow-auto"
      >
        {/* Notification contextuelle pour source incompatible */}
        {incompatibleSource && (
          <>
            <div className="mx-2 mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900">
                    {t("toast.sourceUnavailableShort")}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {t("toast.firstSourceAvailableOnlyIn", {
                      name: getSourceDisplayName(incompatibleSource, t),
                      steps: getSupportedTimeStepsForSource(
                        incompatibleSource
                      )
                        .map((code) => t(`timeSteps.${code}`))
                        .join(", "),
                    })}
                  </p>
                  {getFirstCompatibleTimeStep(incompatibleSource) &&
                    onTimeStepChange && (
                      <button
                        onClick={() => {
                          const step = getFirstCompatibleTimeStep(
                            incompatibleSource
                          );
                          if (step) {
                            onTimeStepChange(step);
                            setIncompatibleSource(null);
                          }
                        }}
                        className="mt-2 text-xs font-medium text-amber-900 underline hover:text-amber-950"
                      >
                        {t("toast.changeTimeStep")}
                      </button>
                    )}
                </div>
                <button
                  onClick={() => setIncompatibleSource(null)}
                  className="text-amber-600 hover:text-amber-800"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Sources principales */}
        <div className="p-1">
          <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">
            {t("controls.mainSources")}
          </DropdownMenuLabel>

          {/* AtmoRef */}
          <SourceItem
            code="atmoRef"
            name={t("controls.sourceAtmoRef")}
            isSelected={selectedSources.includes("atmoRef")}
            isCompatible={isSourceCompatibleWithTimeStep(
              "atmoRef",
              selectedTimeStep
            )}
            onToggle={() => handleSourceToggle("atmoRef")}
          />

          {/* AtmoMicro */}
          <SourceItem
            code="atmoMicro"
            name={t("controls.sourceAtmoMicro")}
            isSelected={selectedSources.includes("atmoMicro")}
            isCompatible={isSourceCompatibleWithTimeStep(
              "atmoMicro",
              selectedTimeStep
            )}
            onToggle={() => handleSourceToggle("atmoMicro")}
          />
        </div>

        <DropdownMenuSeparator />

        {/* Groupe communautaire */}
        <div className="p-1">
          <CommunautaireGroupCheckbox
            allSelected={allCommunautaireSelected}
            someSelected={someCommunautaireSelected}
            onToggle={() => handleGroupToggle("communautaire")}
            groupLabel={t("controls.sourceCommunautaire")}
          />

          {/* Sous-menu communautaire */}
          <div className="ml-6 mt-1 space-y-1">
            {[
              { code: "communautaire.nebuleair", name: "NebuleAir" },
              {
                code: "communautaire.sensorCommunity",
                name: "Sensor.Community",
              },
              { code: "communautaire.purpleair", name: "PurpleAir" },
            ].map(({ code, name }) => (
              <SourceItem
                key={code}
                code={code}
                name={name}
                isSelected={selectedSources.includes(code)}
                isCompatible={isSourceCompatibleWithTimeStep(
                  code,
                  selectedTimeStep
                )}
                supportedTimeStepCodes={getSupportedTimeStepsForSource(code)}
                onToggle={() => handleSourceToggle(code)}
              />
            ))}
          </div>
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Composant pour un item de source avec indicateur visuel
interface SourceItemProps {
  code: string;
  name: string;
  isSelected: boolean;
  isCompatible: boolean;
  supportedTimeStepCodes?: string[];
  onToggle: () => void;
}

const SourceItem: React.FC<SourceItemProps> = ({
  name,
  isSelected,
  isCompatible,
  supportedTimeStepCodes,
  onToggle,
}) => {
  const { t } = useTranslation();
  const stepsTitle =
    supportedTimeStepCodes?.length &&
    t("toast.availableOnlyIn", {
      steps: supportedTimeStepCodes
        .map((c) => t(`timeSteps.${c}`))
        .join(", "),
    });
  const stepsTitleStr = stepsTitle ? String(stepsTitle) : undefined;
  return (
    <div className="relative">
      <DropdownMenuCheckboxItem
        checked={isSelected}
        onCheckedChange={onToggle}
        className={cn(
          "py-1.5 pr-3 text-sm",
          isSelected && "bg-[#e7eef8] text-[#1f3c6d]",
          !isCompatible && !isSelected && "opacity-60"
        )}
        disabled={!isCompatible && !isSelected}
      >
        <div className="flex items-center justify-between w-full">
          <span>{name}</span>
          {!isCompatible && (
            <span
              className="ml-2 flex items-center gap-1 text-amber-600"
              title={stepsTitleStr}
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>
      </DropdownMenuCheckboxItem>
    </div>
  );
};

// Composant séparé pour gérer l'état indéterminé du checkbox du groupe communautaire
const CommunautaireGroupCheckbox: React.FC<{
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
  groupLabel: string;
}> = ({ allSelected, someSelected, onToggle, groupLabel }) => {
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const isIndeterminate = someSelected && !allSelected;

  useEffect(() => {
    if (checkboxRef.current) {
      if (isIndeterminate) {
        checkboxRef.current.setAttribute("data-state", "indeterminate");
      } else if (allSelected) {
        checkboxRef.current.setAttribute("data-state", "checked");
      } else {
        checkboxRef.current.setAttribute("data-state", "unchecked");
      }
    }
  }, [allSelected, isIndeterminate]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center pl-2 pr-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center relative">
        <div className="relative mr-3 flex-shrink-0">
          <Checkbox
            ref={checkboxRef}
            checked={allSelected}
            onCheckedChange={onToggle}
          />
          {isIndeterminate && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2 h-0.5 bg-[#325a96] rounded" />
            </div>
          )}
        </div>
        <span className="font-medium">{groupLabel}</span>
      </div>
    </button>
  );
};

export default SourceDropdownWithNotifications;

