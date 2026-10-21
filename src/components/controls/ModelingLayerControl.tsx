import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ModelingLayerType } from "../../constants/mapLayers";
import {
  AROME_DOMAIN_IDS,
  type AromeDomainId,
} from "../../constants/aromeDomains";
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
  aromeDomain?: AromeDomainId;
  onAromeDomainChange?: (domain: AromeDomainId) => void;
  selectedPollutant?: string;
  selectedTimeStep?: string;
  /** Id du trigger pour association avec un <label htmlFor> (accessibilité) */
  triggerId?: string;
}

const ModelingLayerControl: React.FC<ModelingLayerControlProps> = ({
  currentModelingLayer,
  onModelingLayerChange,
  aromeDomain = "Marseille",
  onAromeDomainChange,
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

  const getDisplayLabel = (layerType: ModelingLayerType): string => {
    if (layerType === "pollutant" && selectedPollutant) {
      const pollutantName = t(`pollutants.${selectedPollutant}`);
      return `${t("controls.modelingPollutant")} ${pollutantName}`;
    }
    if (layerType === "arome") {
      return `${t("controls.modelingArome")} · ${aromeDomain}`;
    }
    return t("controls.modelingVent");
  };

  const getDisplayText = () => {
    if (currentModelingLayer) {
      return getDisplayLabel(currentModelingLayer);
    }
    return t("controls.modeling");
  };

  const layerTypes: ModelingLayerType[] = ["pollutant", "vent", "arome"];
  const azurRestricted = !isModelingAvailable(selectedTimeStep);

  const isLayerDisabled = (layerType: ModelingLayerType): boolean => {
    if (layerType === "arome") return false;
    if (azurRestricted) return true;
    if (layerType === "pollutant" && !selectedPollutant) return true;
    return false;
  };

  // Retirer polluant/vent si le pas de temps ne le permet plus ; garder AROME.
  const prevAzurRestrictedRef = useRef(azurRestricted);
  const hasCalledRef = useRef(false);

  useEffect(() => {
    if (
      azurRestricted &&
      !prevAzurRestrictedRef.current &&
      currentModelingLayer &&
      currentModelingLayer !== "arome" &&
      !hasCalledRef.current
    ) {
      hasCalledRef.current = true;
      onModelingLayerChange(null);
      setTimeout(() => {
        hasCalledRef.current = false;
      }, 100);
    }
    prevAzurRestrictedRef.current = azurRestricted;
    if (!azurRestricted) {
      hasCalledRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azurRestricted, currentModelingLayer]);

  const renderDomainPicker = () => {
    if (currentModelingLayer !== "arome" || !onAromeDomainChange) return null;
    return (
      <div
        className="mt-1.5 space-y-1 border-t border-gray-100 pt-1.5"
        data-testid="arome-domain-picker"
      >
        <p className="px-2.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {t("controls.aromeDomain")}
        </p>
        <div className="flex flex-wrap gap-1 px-2 pb-1">
          {AROME_DOMAIN_IDS.map((domain) => {
            const selected = aromeDomain === domain;
            return (
              <button
                key={domain}
                type="button"
                aria-pressed={selected}
                onClick={() => onAromeDomainChange(domain)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] transition-colors",
                  selected
                    ? "border border-[hsl(var(--brand-200))] bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-800))]"
                    : "border border-transparent text-gray-600 hover:bg-gray-50"
                )}
              >
                {domain}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /** Liste d'options partagée par les deux présentations */
  const renderOptions = (itemClassName?: string) =>
    layerTypes.map((layerType) => {
      const isSelected = currentModelingLayer === layerType;
      const itemDisabled = isLayerDisabled(layerType);
      return (
        <button
          key={layerType}
          type="button"
          disabled={itemDisabled}
          aria-pressed={isSelected}
          onClick={() => {
            if (itemDisabled) return;
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
            itemDisabled && "cursor-not-allowed opacity-50",
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
          <span className="truncate">
            {layerType === "arome"
              ? t("controls.modelingArome")
              : getDisplayLabel(layerType)}
          </span>
        </button>
      );
    });

  if (variant === "inline") {
    return (
      <div className="pl-4 pr-1" data-testid="modeling-inline">
        {renderOptions()}
        {renderDomainPicker()}
        {azurRestricted && (
          <p className="px-2.5 py-1 text-[10px] text-gray-500">
            {t("controls.modelingUnavailable")}
          </p>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({
            displayText: getDisplayText(),
            disabled: false,
          })
        ) : (
        <DropdownButton
          id={triggerId}
          variant="elegant"
          className="min-w-[96px] max-w-[180px]"
          title={
            currentModelingLayer
              ? `${t("controls.modeling")}: ${getDisplayLabel(currentModelingLayer)}`
              : t("controls.modeling")
          }
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
          value={currentModelingLayer || ""}
          onValueChange={(value) => {
            if (value && currentModelingLayer === value) {
              onModelingLayerChange(null);
            } else if (value) {
              onModelingLayerChange(value as ModelingLayerType);
            }
          }}
        >
          {layerTypes.map((layerType) => {
            const isSelected = currentModelingLayer === layerType;
            const itemDisabled = isLayerDisabled(layerType);

            return (
              <DropdownMenuRadioItem
                key={layerType}
                value={layerType}
                disabled={itemDisabled}
                onClick={(e) => {
                  if (isSelected && !itemDisabled) {
                    e.preventDefault();
                    onModelingLayerChange(null);
                  }
                }}
                className={cn(
                  "py-2 pr-3 text-sm",
                  isSelected && "bg-[#e7eef8] text-[#1f3c6d]",
                  itemDisabled &&
                    "text-gray-400 cursor-not-allowed opacity-50"
                )}
              >
                {layerType === "arome"
                  ? t("controls.modelingArome")
                  : getDisplayLabel(layerType)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        {renderDomainPicker()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModelingLayerControl;
