import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { pasDeTemps } from "../../constants/timeSteps";
import { sources } from "../../constants/sources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../ui/dropdown-menu";
import { DropdownButton } from "./DropdownButton";
import type { CustomTriggerProps } from "./dropdownTriggerContract";
import { cn } from "../../lib/utils";
import {
  isSourceCompatibleWithTimeStep,
  getSourceDisplayName,
  getSupportedTimeStepsForSource,
} from "../../utils/sourceCompatibility";
import { Toast } from "../ui/toast";

interface TimeStepDropdownProps extends CustomTriggerProps {
  selectedTimeStep: string;
  selectedSources: string[];
  onTimeStepChange: (timeStep: string) => void;
  onSourceChange?: (sources: string[]) => void;
  onToast?: (toast: Omit<Toast, "id">) => void;
  /** Id du trigger pour association avec un <label htmlFor> (accessibilité) */
  triggerId?: string;
}

const TimeStepDropdown: React.FC<TimeStepDropdownProps> = ({
  selectedTimeStep,
  selectedSources,
  onTimeStepChange,
  onSourceChange,
  onToast,
  triggerId,
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const { t } = useTranslation();
  // Fonction pour obtenir les pas de temps supportés par les sources sélectionnées
  const supportedTimeSteps = useMemo(() => {
    if (!selectedSources || selectedSources.length === 0) {
      return Object.keys(pasDeTemps);
    }

    const allSupportedTimeSteps = new Set<string>();

    selectedSources.forEach((sourceCode) => {
      // Gérer les sources communautaires (communautaire.nebuleair -> nebuleair)
      let actualSourceCode = sourceCode;
      if (sourceCode.startsWith("communautaire.")) {
        actualSourceCode = sourceCode.split(".")[1];
      }

      const source = sources[actualSourceCode];
      if (source) {
        // Ajouter les pas de temps de la source principale
        if (source.supportedTimeSteps) {
          source.supportedTimeSteps.forEach((timeStep) => {
            allSupportedTimeSteps.add(timeStep);
          });
        }

        // Ajouter les pas de temps des sous-sources si c'est un groupe
        if (source.isGroup && source.subSources) {
          Object.values(source.subSources).forEach((subSource) => {
            if (subSource.supportedTimeSteps) {
              subSource.supportedTimeSteps.forEach((timeStep) => {
                allSupportedTimeSteps.add(timeStep);
              });
            }
          });
        }
      } else {
        // Si c'est une source communautaire, chercher dans le groupe communautaire
        const communautaireSource = sources["communautaire"];
        if (communautaireSource && communautaireSource.subSources) {
          const subSource = communautaireSource.subSources[actualSourceCode];
          if (subSource && subSource.supportedTimeSteps) {
            subSource.supportedTimeSteps.forEach((timeStep) => {
              allSupportedTimeSteps.add(timeStep);
            });
          }
        }
      }
    });

    return Array.from(allSupportedTimeSteps);
  }, [selectedSources]);

  // Vérifier si le pas de temps actuel est toujours supporté
  useEffect(() => {
    if (selectedTimeStep && !supportedTimeSteps.includes(selectedTimeStep)) {
      // Si le pas de temps actuel n'est plus supporté, passer au premier disponible
      const firstSupported = supportedTimeSteps[0];
      if (firstSupported) {
        onTimeStepChange(firstSupported);
      }
    }
  }, [selectedTimeStep, supportedTimeSteps, onTimeStepChange]);

  // Gérer le changement de pas de temps avec vérification des incompatibilités
  const handleTimeStepChange = (newTimeStep: string) => {
    // Si le pas de temps ne change pas, ne rien faire
    if (newTimeStep === selectedTimeStep) {
      return;
    }

    // Changer le pas de temps d'abord (pour que le dropdown reflète le choix)
    onTimeStepChange(newTimeStep);

    // Vérifier les sources incompatibles avec le nouveau pas de temps
    const incompatibleSources = selectedSources.filter(
      (source) => !isSourceCompatibleWithTimeStep(source, newTimeStep)
    );

    // Si des sources sont incompatibles, afficher une notification
    if (incompatibleSources.length > 0 && onToast) {
      const sourceNames = incompatibleSources.map((source) =>
        getSourceDisplayName(source, t)
      );
      const timeStepLabel = t(`timeSteps.${newTimeStep}`);

      const title =
        incompatibleSources.length === 1
          ? t("toast.sourceUnavailable", { name: sourceNames[0] })
          : t("toast.sourcesUnavailable", {
              count: incompatibleSources.length,
            });

      let description = "";
      if (incompatibleSources.length === 1) {
        description = t("toast.sourceNotAvailableAtTimeStep", {
          name: sourceNames[0],
          timeStep: timeStepLabel,
        });
        const supportedCodes = getSupportedTimeStepsForSource(
          incompatibleSources[0]
        );
        if (supportedCodes.length > 0) {
          const stepsLabel = supportedCodes
            .map((code) => t(`timeSteps.${code}`))
            .join(", ");
          description += " " + t("toast.availableOnlyIn", { steps: stepsLabel });
        }
      } else {
        description = t("toast.followingSourcesNotAvailable", {
          timeStep: timeStepLabel,
          sources: sourceNames.join(", "),
        });
        const firstCodes = getSupportedTimeStepsForSource(
          incompatibleSources[0]
        );
        if (firstCodes.length > 0) {
          const stepsLabel = firstCodes
            .map((code) => t(`timeSteps.${code}`))
            .join(", ");
          description +=
            " " +
            t("toast.firstSourceAvailableOnlyIn", {
              name: sourceNames[0],
              steps: stepsLabel,
            });
        }
      }

      onToast({
        title,
        description,
        variant: "warning",
        action: onSourceChange
          ? {
              label: t("toast.disableIncompatibleSources"),
              onClick: () => {
                // Désactiver les sources incompatibles
                const compatibleSources = selectedSources.filter(
                  (source) => isSourceCompatibleWithTimeStep(source, newTimeStep)
                );
                onSourceChange(compatibleSources);
              },
            }
          : undefined,
        duration: 7000,
      });
    }
  };

  const getDisplayText = () => {
    const timeStep = pasDeTemps[selectedTimeStep as keyof typeof pasDeTemps];
    return timeStep ? t(`timeSteps.${selectedTimeStep}`) : t("timeSteps.choose");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({ displayText: getDisplayText() })
        ) : (
          <DropdownButton
            id={triggerId}
            data-tour="global-timestep"
            className="min-w-[72px] max-w-[130px] rtl-on-ar"
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
          "rtl-on-ar",
          !renderTrigger && "w-[var(--radix-dropdown-menu-trigger-width)]",
          menuClassName
        )}
      >
        <DropdownMenuRadioGroup
          value={selectedTimeStep}
          onValueChange={handleTimeStepChange}
        >
          {Object.entries(pasDeTemps)
            .filter(([code]) => supportedTimeSteps.includes(code))
            .map(([code, timeStep]) => (
              <DropdownMenuRadioItem
                key={code}
                value={code}
                className={cn(
                  "py-2 pr-3 text-sm",
                  selectedTimeStep === code &&
                    "bg-[#e7eef8] text-[#1f3c6d]"
                )}
              >
                {t(`timeSteps.${code}`)}
              </DropdownMenuRadioItem>
            ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TimeStepDropdown;
