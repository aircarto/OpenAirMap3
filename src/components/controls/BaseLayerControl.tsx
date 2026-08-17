import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { BASE_LAYER_KEYS, BaseLayerKey } from "../../constants/mapLayers";
import { featureFlags } from "../../config/featureFlags";
import { cn } from "../../lib/utils";
import LayerDisclosure from "./LayerDisclosure";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  BurnedAreaPeriod,
  HotspotPeriod,
} from "../../services/EffisLayerService";

const BASE_LAYER_I18N_KEYS: Record<BaseLayerKey, string> = {
  "Carte standard": "baseLayer.standard",
  "Carte OSM": "baseLayer.osm",
  "Satellite IGN": "baseLayer.satelliteIgn",
};

const HOTSPOT_PERIOD_I18N_KEYS: Record<HotspotPeriod, string> = {
  "24h": "baseLayer.firePeriod24h",
  "7d": "baseLayer.firePeriod7d",
};

const BURNED_AREA_PERIOD_I18N_KEYS: Record<BurnedAreaPeriod, string> = {
  today: "baseLayer.firePeriodDay",
  week: "baseLayer.firePeriodWeek",
  season: "baseLayer.firePeriodSeason",
};

interface PeriodSelectorProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
  ariaLabel: string;
  /** Teinte alignée sur celle du toggle auquel le sélecteur se rattache */
  accent: "orange" | "amber";
}

/**
 * Sélecteur de période affiché sous un toggle de couche feux.
 * Rendu en retrait pour signaler qu'il dépend du toggle au-dessus de lui.
 */
function PeriodSelector<T extends string>({
  options,
  value,
  onChange,
  getLabel,
  ariaLabel,
  accent,
}: PeriodSelectorProps<T>) {
  const activeClass =
    accent === "orange"
      ? "bg-orange-600 text-white border-orange-600"
      : "bg-amber-700 text-white border-amber-700";

  return (
    <div
      className="flex gap-1 pl-7 pr-2.5 pb-1.5 pt-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(option);
            }}
            className={`px-2 py-0.5 rounded text-[11px] border transition-colors whitespace-nowrap ${
              isActive
                ? activeClass
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
            aria-pressed={isActive}
          >
            {getLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

interface BaseLayerControlProps {
  currentBaseLayer: BaseLayerKey;
  onBaseLayerChange: (layerKey: BaseLayerKey) => void;
  // Nouveaux props pour le découpage communal
  isCommunalLayerEnabled: boolean;
  onCommunalLayerToggle: (enabled: boolean) => void;
  // Props pour les couches EFFIS (points de chaleur + zones brûlées)
  isEffisHotspotsEnabled: boolean;
  onEffisHotspotsToggle: (enabled: boolean) => void;
  effisHotspotsPeriod: HotspotPeriod;
  onEffisHotspotsPeriodChange: (period: HotspotPeriod) => void;
  isEffisBurnedAreasEnabled: boolean;
  onEffisBurnedAreasToggle: (enabled: boolean) => void;
  effisBurnedAreasPeriod: BurnedAreaPeriod;
  onEffisBurnedAreasPeriodChange: (period: BurnedAreaPeriod) => void;
  // Props pour la couche feux de foret en cours
  isWildfireLayerEnabled: boolean;
  onWildfireLayerToggle: (enabled: boolean) => void;
  /**
   * Côté d'ouverture du panneau. « right » pour le rail, « top » pour l'ancien
   * site bas-gauche. Le contenu est portalisé vers `document.body` : la zone
   * défilante du rail est en `overflow-x: hidden` et rognait auparavant le
   * panneau entièrement — rendu, mais invisible et non cliquable.
   */
  placement?: "top" | "right";
  /** Surface du panneau, pour l'aligner sur celle des flyouts du rail */
  panelClassName?: string;
  /**
   * Contenu du sous-menu « Modélisation ».
   *
   * Injecté par l'appelant plutôt qu'importé ici : ModelingLayerControl reste le
   * propriétaire de sa logique de disponibilité, et BaseLayerControl n'a pas à en
   * dépendre.
   */
  modelingSlot?: React.ReactNode;
  /** Vrai si une couche de modélisation est active, pour la pastille du sous-menu */
  isModelingActive?: boolean;
  /**
   * Déclencheur fourni par l'appelant, rendu dans un `<PopoverTrigger asChild>`.
   *
   * Il doit donc diffuser ses props et sa ref, et NE PAS gérer l'ouverture
   * lui-même : Radix compose son propre gestionnaire de clic, un second
   * basculement dans l'enfant annulerait le premier.
   *
   * `isOpen` sert uniquement au rendu visuel — `aria-expanded` est déjà posé par
   * Radix.
   */
  renderTrigger?: (context: {
    isOpen: boolean;
    label: string;
    icon: React.ReactNode;
  }) => React.ReactNode;
}

const BaseLayerControl: React.FC<BaseLayerControlProps> = ({
  currentBaseLayer,
  onBaseLayerChange,
  isCommunalLayerEnabled,
  onCommunalLayerToggle,
  isEffisHotspotsEnabled,
  onEffisHotspotsToggle,
  effisHotspotsPeriod,
  onEffisHotspotsPeriodChange,
  isEffisBurnedAreasEnabled,
  onEffisBurnedAreasToggle,
  effisBurnedAreasPeriod,
  onEffisBurnedAreasPeriodChange,
  isWildfireLayerEnabled,
  onWildfireLayerToggle,
  placement = "top",
  panelClassName,
  modelingSlot,
  isModelingActive = false,
  renderTrigger,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLayerSelect = (layerKey: BaseLayerKey) => {
    onBaseLayerChange(layerKey);
    setIsOpen(false);
  };

  const handleCommunalLayerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCommunalLayerToggle(!isCommunalLayerEnabled);
  };

  const handleEffisHotspotsToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEffisHotspotsToggle(!isEffisHotspotsEnabled);
  };

  const handleEffisBurnedAreasToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEffisBurnedAreasToggle(!isEffisBurnedAreasEnabled);
  };

  const handleWildfireLayerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWildfireLayerToggle(!isWildfireLayerEnabled);
  };

  const getLayerLabel = (layerKey: BaseLayerKey) =>
    t(BASE_LAYER_I18N_KEYS[layerKey]);

  const getLayerIcon = (layerKey: BaseLayerKey) => {
    if (layerKey === "Satellite IGN") {
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"
          />
        </svg>
      );
    }
    // Icône pour la carte standard
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3"
        />
      </svg>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {renderTrigger ? (
          renderTrigger({
            isOpen,
            label: getLayerLabel(currentBaseLayer),
            icon: getLayerIcon(currentBaseLayer),
          })
        ) : (
          <button
            type="button"
            aria-expanded={isOpen}
            className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-md p-2 text-center shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-gray-300/70 transition-colors"
            title={`${t("baseLayer.title")}: ${getLayerLabel(currentBaseLayer)}`}
          >
            <div className="flex items-center justify-center">
              <span className="text-gray-700">
                {getLayerIcon(currentBaseLayer)}
              </span>
            </div>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={placement === "right" ? "right" : "top"}
        align="start"
        aria-label={t("baseLayer.title")}
        className={cn(
          "w-auto min-w-[248px]",
          panelClassName ??
            "bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-md shadow-sm"
        )}
      >
          <div className="p-1">
            {BASE_LAYER_KEYS.map((layerKey) => (
              <button
                key={layerKey}
                type="button"
                onClick={() => handleLayerSelect(layerKey as BaseLayerKey)}
                className={`w-full flex items-center px-2.5 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                  currentBaseLayer === layerKey
                    ? "bg-blue-50/80 text-blue-900 border border-blue-200/50"
                    : "text-gray-700 hover:bg-gray-50/80"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full border mr-2 flex items-center justify-center ${
                    currentBaseLayer === layerKey
                      ? "border-blue-600"
                      : "border-gray-300/50"
                  }`}
                >
                  {currentBaseLayer === layerKey && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <span>{getLayerLabel(layerKey as BaseLayerKey)}</span>
              </button>
            ))}
            
            {/* Séparateur */}
            <div className="border-t border-gray-200/50 my-1"></div>
            
            {/* Option de découpage communal (overlay layer) */}
            <button
              type="button"
              onClick={handleCommunalLayerToggle}
              className={`w-full flex items-center px-2.5 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                isCommunalLayerEnabled
                  ? "bg-green-50/80 text-green-900 border border-green-200/50"
                  : "text-gray-700 hover:bg-gray-50/80"
              }`}
            >
              <div
                className={`w-3 h-3 rounded border mr-2 flex items-center justify-center ${
                  isCommunalLayerEnabled
                    ? "border-green-600 bg-green-600"
                    : "border-gray-300/50"
                }`}
              >
                {isCommunalLayerEnabled && (
                  <svg
                    className="w-2 h-2 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span>{t("baseLayer.communal")}</span>
            </button>

            {/* Séparateur avant les sous-menus */}
            <div className="my-1 border-t border-gray-200/50" />

            {/* Sous-menu « Modélisation » */}
            {modelingSlot && (
              <LayerDisclosure
                label={t("baseLayer.groupModeling")}
                active={isModelingActive}
              >
                {modelingSlot}
              </LayerDisclosure>
            )}

            {/* Sous-menu « Incendie » : points de chaleur, zones brûlées, feux en cours */}
            <LayerDisclosure
              label={t("baseLayer.groupFire")}
              active={
                isEffisHotspotsEnabled ||
                isEffisBurnedAreasEnabled ||
                isWildfireLayerEnabled
              }
            >
              <div className="pl-4 pr-1">
            <button
              type="button"
              onClick={handleEffisHotspotsToggle}
              className={`w-full flex items-center px-2.5 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                isEffisHotspotsEnabled
                  ? "bg-orange-50/80 text-orange-900 border border-orange-200/50"
                  : "text-gray-700 hover:bg-gray-50/80"
              }`}
            >
              <div
                className={`w-3 h-3 rounded border mr-2 flex items-center justify-center ${
                  isEffisHotspotsEnabled
                    ? "border-orange-600 bg-orange-600"
                    : "border-gray-300/50"
                }`}
              >
                {isEffisHotspotsEnabled && (
                  <svg
                    className="w-2 h-2 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span>{t("baseLayer.effisHotspots")}</span>
            </button>

            {isEffisHotspotsEnabled && (
              <PeriodSelector
                options={["24h", "7d"] as const}
                value={effisHotspotsPeriod}
                onChange={onEffisHotspotsPeriodChange}
                getLabel={(option) => t(HOTSPOT_PERIOD_I18N_KEYS[option])}
                ariaLabel={t("baseLayer.firePeriodHotspotsAria")}
                accent="orange"
              />
            )}

            {/* Option zones brûlées EFFIS (overlay layer) */}
            <button
              type="button"
              onClick={handleEffisBurnedAreasToggle}
              className={`w-full flex items-center px-2.5 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                isEffisBurnedAreasEnabled
                  ? "bg-amber-50/80 text-amber-900 border border-amber-200/50"
                  : "text-gray-700 hover:bg-gray-50/80"
              }`}
            >
              <div
                className={`w-3 h-3 rounded border mr-2 flex items-center justify-center ${
                  isEffisBurnedAreasEnabled
                    ? "border-amber-700 bg-amber-700"
                    : "border-gray-300/50"
                }`}
              >
                {isEffisBurnedAreasEnabled && (
                  <svg
                    className="w-2 h-2 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span>{t("baseLayer.effisBurnedAreas")}</span>
            </button>

            {isEffisBurnedAreasEnabled && (
              <PeriodSelector
                options={["today", "week", "season"] as const}
                value={effisBurnedAreasPeriod}
                onChange={onEffisBurnedAreasPeriodChange}
                getLabel={(option) => t(BURNED_AREA_PERIOD_I18N_KEYS[option])}
                ariaLabel={t("baseLayer.firePeriodBurnedAria")}
                accent="amber"
              />
            )}

            {featureFlags.wildfireLayer && (
              <button
                type="button"
                onClick={handleWildfireLayerToggle}
                className={`w-full flex items-center px-2.5 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                  isWildfireLayerEnabled
                    ? "bg-red-50/80 text-red-900 border border-red-200/50"
                    : "text-gray-700 hover:bg-gray-50/80"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded border mr-2 flex items-center justify-center ${
                    isWildfireLayerEnabled
                      ? "border-red-600 bg-red-600"
                      : "border-gray-300/50"
                  }`}
                >
                  {isWildfireLayerEnabled && (
                    <svg
                      className="w-2 h-2 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span>{t("baseLayer.wildfire")}</span>
              </button>
            )}
              </div>
            </LayerDisclosure>

          </div>
      </PopoverContent>
    </Popover>
  );
};

export default BaseLayerControl;
