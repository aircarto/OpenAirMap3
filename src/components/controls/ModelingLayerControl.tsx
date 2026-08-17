import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ModelingLayerType } from "../../constants/mapLayers";
import { pollutants } from "../../constants/pollutants";
import { isModelingAvailable } from "../../services/ModelingLayerService";
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

interface ModelingLayerControlProps extends CustomTriggerProps {
  /**
   * « inline » rend la seule liste d'options, sans déclencheur ni menu, pour
   * être insérée dans le panneau de fond de carte. La logique de disponibilité
   * selon le pas de temps et la désactivation automatique restent ici : ce
   * composant en est le propriétaire, seule sa présentation change.
   */
  variant?: "dropdown" | "inline";
  currentModelingLayer: ModelingLayerType | null;
  onModelingLayerChange: (layerType: ModelingLayerType | null) => void;
  selectedPollutant?: string;
  selectedTimeStep?: string;
  /** Id du trigger pour association avec un <label htmlFor> (accessibilité) */
  triggerId?: string;
}

const ModelingLayerControl: React.FC<ModelingLayerControlProps> = ({
  currentModelingLayer,
  onModelingLayerChange,
  selectedPollutant,
  selectedTimeStep = "heure",
  variant = "dropdown",
  triggerId,
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const { t } = useTranslation();
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
      const pollutantName = t(`pollutants.${selectedPollutant}`);
      return `${t("controls.modelingPollutant")} ${pollutantName}`;
    }
    return t("controls.modelingVent");
  };

  const getDisplayText = () => {
    if (currentModelingLayer) {
      return getDisplayLabel(currentModelingLayer);
    }
    return t("controls.modeling");
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

  /** Liste d'options partagée par les deux présentations */
  const renderOptions = (itemClassName?: string) =>
    layerTypes.map((layerType) => {
      const isSelected = currentModelingLayer === layerType;
      const isItemDisabled = layerType === "pollutant" && !selectedPollutant;
      return (
        <button
          key={layerType}
          type="button"
          disabled={isItemDisabled}
          aria-pressed={isSelected}
          onClick={() => {
            // Bascule : recliquer l'option active la désélectionne
            if (isSelected) {
              onModelingLayerChange(null);
            } else {
              onModelingLayerChange(layerType);
            }
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors",
            isSelected
              ? "border border-[hsl(var(--brand-200))] bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-800))]"
              : "text-gray-700 hover:bg-gray-50/80",
            isItemDisabled && "cursor-not-allowed opacity-50",
            itemClassName
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border",
              isSelected
                ? "border-[hsl(var(--brand-600))]"
                : "border-gray-300/60"
            )}
          >
            {isSelected && (
              <span className="h-1.5 w-1.5 rounded-[1px] bg-[hsl(var(--brand-600))]" />
            )}
          </span>
          <span className="truncate">{getDisplayLabel(layerType)}</span>
        </button>
      );
    });

  if (variant === "inline") {
    if (isDisabled) {
      return (
        <p className="px-2.5 py-1.5 text-[11px] text-gray-500">
          {t("controls.modelingUnavailable")}
        </p>
      );
    }
    return (
      <div className="pl-4 pr-1" data-testid="modeling-inline">
        {renderOptions()}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({
            displayText: isDisabled
              ? t("controls.modelingUnavailable")
              : getDisplayText(),
            disabled: isDisabled,
          })
        ) : (
        <DropdownButton
          id={triggerId}
          disabled={isDisabled}
          variant={isDisabled ? "disabled" : "elegant"}
          hideChevron={isDisabled}
          className="min-w-[96px] max-w-[180px]"
          title={
            isDisabled
              ? t("controls.modelingUnavailable")
              : currentModelingLayer
              ? `${t("controls.modeling")}: ${getDisplayLabel(currentModelingLayer)}`
              : t("controls.modeling")
          }
        >
          <span className="block truncate pr-6">
            {isDisabled ? t("controls.modelingUnavailable") : getDisplayText()}
          </span>
        </DropdownButton>
        )}
      </DropdownMenuTrigger>
      {!isDisabled && (
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

