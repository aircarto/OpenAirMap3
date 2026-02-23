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
import { cn } from "../../lib/utils";
import {
  isSourceCompatibleWithTimeStep,
  getSourceDisplayName,
  getSupportedTimeStepNames,
} from "../../utils/sourceCompatibility";
import { Toast } from "../ui/toast";

interface TimeStepDropdownProps {
  selectedTimeStep: string;
  selectedSources: string[];
  onTimeStepChange: (timeStep: string) => void;
  onSourceChange?: (sources: string[]) => void;
  onToast?: (toast: Omit<Toast, "id">) => void;
}

const TimeStepDropdown: React.FC<TimeStepDropdownProps> = ({
  selectedTimeStep,
  selectedSources,
  onTimeStepChange,
  onSourceChange,
  onToast,
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
        getSourceDisplayName(source)
      );
      const timeStepName =
        pasDeTemps[newTimeStep as keyof typeof pasDeTemps]?.name ||
        newTimeStep;

      // Créer le message selon le nombre de sources
      const title =
        incompatibleSources.length === 1
          ? `${sourceNames[0]} non disponible`
          : `${incompatibleSources.length} sources non disponibles`;

      // Construire la description avec la liste des sources incompatibles
      let description = "";
      if (incompatibleSources.length === 1) {
        description = `${sourceNames[0]} n'est pas disponible au pas de temps "${timeStepName}".`;
        // Afficher les pas de temps supportés pour cette source
        const supportedSteps = getSupportedTimeStepNames(incompatibleSources[0]);
        if (supportedSteps.length > 0) {
          description += ` Disponible uniquement en : ${supportedSteps.join(", ")}.`;
        }
      } else {
        // Plusieurs sources incompatibles : lister toutes les sources
        description = `Les sources suivantes ne sont pas disponibles au pas de temps "${timeStepName}" : ${sourceNames.join(", ")}.`;
        
        // Afficher les pas de temps supportés pour la première source (exemple)
        const firstIncompatible = incompatibleSources[0];
        const supportedSteps = getSupportedTimeStepNames(firstIncompatible);
        if (supportedSteps.length > 0) {
          description += ` ${sourceNames[0]} est disponible uniquement en : ${supportedSteps.join(", ")}.`;
        }
      }

      onToast({
        title,
        description,
        variant: "warning",
        action: onSourceChange
          ? {
              label: "Désactiver les sources incompatibles",
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
        <button
          type="button"
          className="relative bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 text-gray-800 hover:from-gray-100 hover:to-gray-50 hover:border-gray-300 shadow-sm backdrop-blur-sm rounded-lg pl-3 pr-7 py-2 text-left text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3] min-w-[72px] max-w-[130px]"
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
