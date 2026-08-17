import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useMapControls } from "../../../contexts/mapControlsContext";
import RailBrand from "./RailBrand";
import RailFiltersSection from "./sections/RailFiltersSection";
import RailLayersSection from "./sections/RailLayersSection";
import RailTimeSection from "./sections/RailTimeSection";
import RailShortcutsSection from "./sections/RailShortcutsSection";
import RailFooter from "./sections/RailFooter";
import { useRailRoving, type RailOrientation } from "./useRailRoving";
import type {
  BaseLayerControlBinding,
  RailShortcutsBinding,
} from "./railBindings";

export interface MapControlRailProps {
  orientation?: RailOrientation;
  /** État local à la carte : voyage par props, pas par contexte */
  baseLayer: BaseLayerControlBinding;
  shortcuts: RailShortcutsBinding;
}

/**
 * Rail de contrôles de la carte.
 *
 * Ancré en `absolute` DANS la colonne carte (le `div.flex-1.relative`
 * d'AirQualityMap) et non en `fixed` : les panneaux latéraux sont des frères
 * flex qui poussent cette colonne, donc le rail glisse avec elle au lieu de
 * rester par-dessus.
 *
 * Il publie son emprise en `--rail-inset` sur la colonne carte, ce dont se
 * servent les contrôles Leaflet ancrés à gauche et la légende centrée pour
 * s'écarter — sans mesure JS et en suivant le décalage des panneaux.
 */
export const MapControlRail: React.FC<MapControlRailProps> = ({
  orientation = "vertical",
  baseLayer,
  shortcuts,
}) => {
  const { t } = useTranslation();
  const { ui } = useMapControls();
  const { containerRef, onKeyDownCapture, onItemFocus } =
    useRailRoving(orientation);
  const railRef = useRef<HTMLElement | null>(null);

  // Publie l'emprise du rail sur la colonne carte. En horizontal (mobile) le
  // rail est en bas : il ne décale rien latéralement.
  useEffect(() => {
    const rail = railRef.current;
    const column = rail?.parentElement;
    if (!rail || !column) return;

    if (orientation === "horizontal") {
      column.style.setProperty("--rail-inset", "0px");
      return () => column.style.removeProperty("--rail-inset");
    }

    const publish = () => {
      // largeur + marge gauche + gouttière
      const inset = rail.offsetWidth + 12 + 12;
      column.style.setProperty("--rail-inset", `${inset}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(rail);
    return () => {
      observer.disconnect();
      column.style.removeProperty("--rail-inset");
    };
  }, [orientation]);

  const isVertical = orientation === "vertical";

  return (
    <nav
      ref={railRef}
      data-testid="map-control-rail"
      aria-label={t("rail.regionLabel")}
      className={cn(
        "glass-1 absolute z-rail flex animate-rail-in",
        isVertical
          ? "left-3 top-3 max-h-[calc(100%-1.5rem)] w-[max(3.75rem,60px)] flex-col items-center"
          : "bottom-2 left-2 right-2 flex-row items-center",
        "gap-1 p-1.5"
      )}
      style={{
        borderRadius: isVertical ? "var(--r-xl)" : "var(--r-lg)",
        paddingBottom: isVertical ? undefined : "calc(0.375rem + env(safe-area-inset-bottom))",
      }}
    >
      <RailBrand onOpenAbout={ui.onOpenInfoModal} />

      {/* Le toolbar englobe la zone de défilement ET le pied : tous les items
          doivent participer au même roving tabindex, sinon ceux du pied
          garderaient tabIndex 0 et créeraient un arrêt de tabulation
          supplémentaire. Seuls les groupes de contrôles défilent. */}
      <div
        ref={containerRef}
        role="toolbar"
        aria-orientation={isVertical ? "vertical" : "horizontal"}
        aria-label={t("rail.toolbarLabel")}
        onKeyDownCapture={onKeyDownCapture}
        className={cn(
          "flex min-h-0 min-w-0 items-center gap-1",
          isVertical ? "flex-col" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 items-center gap-1",
            isVertical
              ? "flex-col overflow-y-auto overflow-x-hidden"
              : "flex-row overflow-x-auto overflow-y-hidden [scroll-snap-type:x_mandatory]",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          style={{
            // Masques de bord : indiquent qu'il reste des items hors champ
            maskImage: isVertical
              ? "linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)"
              : "linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)",
          }}
        >
          <RailFiltersSection
            orientation={orientation}
            onItemFocus={onItemFocus}
          />
          <RailLayersSection
            orientation={orientation}
            onItemFocus={onItemFocus}
            baseLayer={baseLayer}
          />
          <RailTimeSection orientation={orientation} onItemFocus={onItemFocus} />
          <RailShortcutsSection
            orientation={orientation}
            shortcuts={shortcuts}
          />
        </div>

        {/* Pied épinglé : ne défile jamais avec les groupes de contrôles */}
        <RailFooter orientation={orientation} onItemFocus={onItemFocus} />
      </div>
    </nav>
  );
};

export default MapControlRail;
