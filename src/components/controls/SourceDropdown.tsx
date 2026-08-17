import React, { useMemo, useRef, useEffect } from "react";
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
import { DropdownButton } from "./DropdownButton";
import type { CustomTriggerProps } from "./dropdownTriggerContract";
import { cn } from "../../lib/utils";
import {
  isSourceCompatibleWithTimeStep,
  getSourceDisplayName,
  getSupportedTimeStepsForSource,
  getFirstCompatibleTimeStep,
} from "../../utils/sourceCompatibility";
import { Toast } from "../ui/toast";
import AutoRefreshToggle from "./AutoRefreshToggle";

const COMMUNAUTAIRE_SOURCE_CODES = [
  "communautaire.nebuleair",
  "communautaire.sensorCommunity",
  "communautaire.purpleair",
] as const;

interface SourceDropdownProps extends CustomTriggerProps {
  selectedSources: string[];
  selectedTimeStep?: string;
  onSourceChange: (sources: string[]) => void;
  onTimeStepChange?: (timeStep: string) => void;
  onToast?: (toast: Omit<Toast, "id">) => void;
  /** Actualisation auto : affiche le toggle en tête du menu (au-dessus des sources) */
  autoRefreshEnabled?: boolean;
  onToggleAutoRefresh?: (enabled: boolean) => void;
  loading?: boolean;
  isHistoricalModeActive?: boolean;
  /** Id du trigger pour association avec un <label htmlFor> (accessibilité) */
  triggerId?: string;
}

const SourceDropdown: React.FC<SourceDropdownProps> = ({
  selectedSources,
  selectedTimeStep,
  onSourceChange,
  onTimeStepChange,
  onToast,
  autoRefreshEnabled = false,
  onToggleAutoRefresh,
  loading = false,
  isHistoricalModeActive = false,
  triggerId,
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const { t } = useTranslation();

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

  const handleSourceToggle = (sourceCode: string) => {
    const isCurrentlySelected = selectedSources.includes(sourceCode);
    
    // Si on essaie d'activer une source
    if (!isCurrentlySelected) {
      // Vérifier la compatibilité si le pas de temps est fourni
      if (selectedTimeStep && onToast) {
        const isCompatible = isSourceCompatibleWithTimeStep(
          sourceCode,
          selectedTimeStep
        );

        if (!isCompatible) {
          // Afficher une notification toast
          const supportedStepCodes = getSupportedTimeStepsForSource(sourceCode);
          const supportedStepsLabel = supportedStepCodes
            .map((step) => t(`timeSteps.${step}`))
            .join(", ");
          const firstCompatibleStep = getFirstCompatibleTimeStep(sourceCode);
          const sourceName = getSourceDisplayName(sourceCode, t);

          onToast({
            title: t("toast.sourceUnavailable", { name: sourceName }),
            description: t("toast.sourceAvailableOnlyFor", {
              steps: supportedStepsLabel,
            }),
            variant: "warning",
            action:
              firstCompatibleStep && onTimeStepChange
                ? {
                    label: t("toast.changeTo", {
                      label: t(`timeSteps.${firstCompatibleStep}`),
                    }),
                    onClick: () => {
                      onTimeStepChange(firstCompatibleStep);
                    },
                  }
                : undefined,
            duration: 6000,
          });

          // Ne pas activer la source si elle n'est pas compatible
          return;
        }
      }
    }

    // Comportement normal : activer/désactiver
    const newSources = isCurrentlySelected
      ? selectedSources.filter((s) => s !== sourceCode)
      : [...selectedSources, sourceCode];
    onSourceChange(newSources);
  };

  const handleGroupToggle = (groupCode: string) => {
    if (groupCode === "communautaire") {
      if (allCommunautaireSelected) {
        // Désélectionner toutes les sources communautaires
        const newSources = selectedSources.filter(
          (source) => !COMMUNAUTAIRE_SOURCE_CODES.includes(source)
        );
        onSourceChange(newSources);
      } else {
        // Sélectionner toutes les sources communautaires
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
      if (source === "atmoRef") return t("controls.sourceAtmoRef");
      if (source === "atmoMicro") return t("controls.sourceAtmoMicro");
      if (source.includes("communautaire.")) {
        const subSource = source.split(".")[1];
        if (subSource === "nebuleair") return "NebuleAir";
        if (subSource === "sensorCommunity") return "Sensor.Community";
        if (subSource === "purpleair") return "PurpleAir";
      }
      return source;
    }
    return t("controls.sourcesSelected", { count: selectedSources.length });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({ displayText: getDisplayText() })
        ) : (
          <DropdownButton
            id={triggerId}
            data-tour="global-sources"
            className="min-w-[88px] max-w-[200px]"
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
          "min-w-[260px] sm:min-w-[300px] overflow-auto",
          // hauteur bornée pour ne jamais dépasser la carte sur un portable court
          "max-h-[min(60vh,22rem)]",
          !renderTrigger && "w-[var(--radix-dropdown-menu-trigger-width)]",
          menuClassName
        )}
      >
        {/* Actualisation auto — en tête mais visuellement discrète */}
        {typeof onToggleAutoRefresh === "function" && (
          <div
            className="px-3 pt-2 pb-1.5 border-b border-gray-100"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <AutoRefreshToggle
              enabled={autoRefreshEnabled}
              onToggle={onToggleAutoRefresh}
              loading={loading}
              disabled={isHistoricalModeActive}
              compact
            />
          </div>
        )}

        {/* Sources principales */}
        <div className="p-1">
          <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">
            {t("controls.mainSources")}
          </DropdownMenuLabel>

          {/* AtmoRef */}
          <DropdownMenuCheckboxItem
            checked={selectedSources.includes("atmoRef")}
            onCheckedChange={() => handleSourceToggle("atmoRef")}
            className={cn(
              "py-2 pr-3 text-sm",
              selectedSources.includes("atmoRef") &&
                "bg-[#e7eef8] text-[#1f3c6d]"
            )}
          >
            {t("controls.sourceAtmoRef")}
          </DropdownMenuCheckboxItem>

          {/* AtmoMicro */}
          <DropdownMenuCheckboxItem
            checked={selectedSources.includes("atmoMicro")}
            onCheckedChange={() => handleSourceToggle("atmoMicro")}
            className={cn(
              "py-2 pr-3 text-sm",
              selectedSources.includes("atmoMicro") &&
                "bg-[#e7eef8] text-[#1f3c6d]"
            )}
          >
            {t("controls.sourceAtmoMicro")}
          </DropdownMenuCheckboxItem>
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
              <DropdownMenuCheckboxItem
                key={code}
                checked={selectedSources.includes(code)}
                onCheckedChange={() => handleSourceToggle(code)}
                className={cn(
                  "py-1.5 pr-3 text-sm",
                  selectedSources.includes(code) &&
                    "bg-[#e7eef8] text-[#1f3c6d]"
                )}
              >
                {name}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
      // Gérer l'état indéterminé pour Radix UI
      if (isIndeterminate) {
        checkboxRef.current.setAttribute("data-state", "indeterminate");
      } else if (allSelected) {
        checkboxRef.current.setAttribute("data-state", "checked");
      } else {
        checkboxRef.current.setAttribute("data-state", "unchecked");
      }
    }
  }, [allSelected, isIndeterminate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className="w-full flex items-center pl-2 pr-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:ring-offset-1"
    >
      <div className="flex items-center relative">
        <div className="relative mr-3 flex-shrink-0">
          <Checkbox
            ref={checkboxRef}
            checked={allSelected}
            onCheckedChange={onToggle}
          />
          {/* Indicateur visuel pour l'état indéterminé - centré dans le checkbox */}
          {isIndeterminate && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2 h-0.5 bg-[#325a96] rounded" />
            </div>
          )}
        </div>
        <span className="font-medium">{groupLabel}</span>
      </div>
    </div>
  );
};

export default SourceDropdown;
