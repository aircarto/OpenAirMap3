import React, { useEffect, useRef } from "react";
import { ModelingLayerType, modelingLayers } from "../../constants/mapLayers";
import { pollutants } from "../../constants/pollutants";
import { isModelingAvailable } from "../../services/ModelingLayerService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

interface ModelingLayerControlProps {
  currentModelingLayer: ModelingLayerType | null;
  onModelingLayerChange: (layerType: ModelingLayerType | null) => void;
  selectedPollutant?: string;
  selectedTimeStep?: string;
}

const ModelingLayerControl: React.FC<ModelingLayerControlProps> = ({
  currentModelingLayer,
  onModelingLayerChange,
  selectedPollutant,
  selectedTimeStep = "heure",
}) => {
  const handleLayerSelect = (layerType: ModelingLayerType) => {
    // Toggle: si le layer est déjà sélectionné, on le désélectionne
    if (currentModelingLayer === layerType) {
      onModelingLayerChange(null);
    } else {
      onModelingLayerChange(layerType);
    }
  };

  const getDisplayLabel = (layerType: ModelingLayerType): string => {
    if (layerType === "pollutant" && selectedPollutant) {
      const pollutantName =
        pollutants[selectedPollutant]?.name || selectedPollutant;
      return `Modélisation ${pollutantName}`;
    }
    return modelingLayers[layerType];
  };

  const getDisplayText = () => {
    if (currentModelingLayer) {
      return getDisplayLabel(currentModelingLayer);
    }
    return "Carte de modélisation";
  };

  const layerTypes: ModelingLayerType[] = ["pollutant", "vent"];
  const isDisabled = !isModelingAvailable(selectedTimeStep);

  // Désactiver automatiquement si le pas de temps ne permet pas les modélisations
  // Utiliser useRef pour éviter les appels multiples et les boucles infinies
  const prevIsDisabledRef = useRef(isDisabled);
  const hasCalledRef = useRef(false);
  
  useEffect(() => {
    // Ne désactiver que si isDisabled vient de passer de false à true ET qu'on n'a pas déjà appelé
    if (isDisabled && !prevIsDisabledRef.current && currentModelingLayer && !hasCalledRef.current) {
      hasCalledRef.current = true;
      onModelingLayerChange(null);
      // Réinitialiser le flag après un court délai
      setTimeout(() => {
        hasCalledRef.current = false;
      }, 100);
    }
    prevIsDisabledRef.current = isDisabled;
    // Réinitialiser le flag si isDisabled redevient false
    if (!isDisabled) {
      hasCalledRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled, currentModelingLayer]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isDisabled}
          className={cn(
            "relative border rounded-lg pl-3 pr-7 py-2 text-left text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3] transition-all duration-200 min-w-[96px] max-w-[180px]",
            isDisabled
              ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-br from-gray-50 to-white border-gray-200/60 text-gray-800 hover:from-gray-100 hover:to-gray-50 hover:border-gray-300 backdrop-blur-sm"
          )}
          title={
            isDisabled
              ? "Modélisations non disponibles pour le pas de temps sélectionné"
              : currentModelingLayer
              ? `Carte de modélisation: ${getDisplayLabel(currentModelingLayer)}`
              : "Carte de modélisation"
          }
        >
          <span className="block truncate pr-6">
            {isDisabled ? "Modélisation (indisponible)" : getDisplayText()}
          </span>
          {!isDisabled && (
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
          )}
        </button>
      </DropdownMenuTrigger>
      {!isDisabled && (
        <DropdownMenuContent 
          align="start" 
          alignOffset={0}
          className="w-[var(--radix-dropdown-menu-trigger-width)]"
        >
          <DropdownMenuRadioGroup
            value={currentModelingLayer || ""}
            onValueChange={(value) => {
              // Gérer le toggle : si on clique sur l'item déjà sélectionné, on le désélectionne
              if (value && currentModelingLayer === value) {
                onModelingLayerChange(null);
              } else if (value) {
                onModelingLayerChange(value as ModelingLayerType);
              }
            }}
          >
            {layerTypes.map((layerType) => {
              const isSelected = currentModelingLayer === layerType;
              const isPollutantLayer = layerType === "pollutant";
              const isItemDisabled = isPollutantLayer && !selectedPollutant;

              return (
                <DropdownMenuRadioItem
                  key={layerType}
                  value={layerType}
                  disabled={isItemDisabled}
                  onClick={(e) => {
                    // Permettre le toggle en interceptant le clic
                    if (isSelected && !isItemDisabled) {
                      e.preventDefault();
                      onModelingLayerChange(null);
                    }
                  }}
                  className={cn(
                    "py-2 pr-3 text-sm",
                    isSelected && "bg-[#e7eef8] text-[#1f3c6d]",
                    isItemDisabled &&
                      "text-gray-400 cursor-not-allowed opacity-50"
                  )}
                >
                  {getDisplayLabel(layerType)}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};

export default ModelingLayerControl;

