import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useMapControls } from "../../../contexts/mapControlsContext";
import RailBrand from "./RailBrand";
import RailFiltersSection from "./sections/RailFiltersSection";
import RailBaseLayerSection from "./sections/RailBaseLayerSection";
import RailModesSection from "./sections/RailModesSection";
import RailShortcutsSection from "./sections/RailShortcutsSection";
import RailFooter from "./sections/RailFooter";
import { useRailRoving, type RailOrientation } from "./useRailRoving";
import { useRailOrientation } from "./useRailBreakpoint";
import type {
  BaseLayerControlBinding,
  CommunitySourcesBinding,
  RailShortcutsBinding,
} from "./railBindings";

export interface MapControlRailProps {
  /** Forçage de l'orientation ; par défaut déduite de la largeur disponible */
  orientation?: RailOrientation;
  /**
   * Un panneau latéral occupe la colonne carte : le rail se resserre pour ne pas
   * ajouter sa largeur à la compression. Sans effet en orientation horizontale.
   */
  compact?: boolean;
  /** État local à la carte : voyage par props, pas par contexte */
  baseLayer: BaseLayerControlBinding;
  shortcuts: RailShortcutsBinding;
  communitySources: CommunitySourcesBinding;
}

/**
 * Rail de contrôles de la carte.
 *
 * Ancré en `absolute` DANS la colonne carte (le `div.flex-1.relative`
 * d'AirQualityMap) et non en `fixed` : les panneaux latéraux sont des frères
 * flex qui poussent cette colonne, donc le rail glisse avec elle au lieu de
 * rester par-dessus.
 *
 * Il publie son emprise en `--rail-inset` (vertical) et `--rail-bottom-inset`
 * (horizontal / mobile) sur la colonne carte, ce dont se servent les contrôles
 * Leaflet ancrés à gauche, la légende et l'attribution pour s'écarter — sans
 * mesure JS et en suivant le décalage des panneaux.
 *
 * Deux largeurs en vertical : 72 px par défaut, 60 px quand `compact` dit qu'un
 * panneau comprime déjà la colonne. La place ne manque que dans le second cas,
 * il n'y a donc pas de raison d'y calibrer aussi le premier.
 */
export const MapControlRail: React.FC<MapControlRailProps> = ({
  orientation: forcedOrientation,
  compact = false,
  baseLayer,
  shortcuts,
  communitySources,
}) => {
  const detectedOrientation = useRailOrientation();
  const orientation = forcedOrientation ?? detectedOrientation;
  const { t } = useTranslation();
  const { ui } = useMapControls();
  const { containerRef, onKeyDownCapture, onItemFocus } =
    useRailRoving(orientation);
  const railRef = useRef<HTMLElement | null>(null);

  // Publie l'emprise du rail sur la colonne carte. En horizontal (mobile) le
  // rail est en bas : on publie sa hauteur pour que légende et `.leaflet-bottom`
  // s'élèvent au-dessus ; en vertical, seul le décalage latéral compte.
  // Pas de publication sur :root : l'attribution n'est plus en position:fixed.
  useEffect(() => {
    const rail = railRef.current;
    const column = rail?.parentElement;
    if (!rail || !column) return;

    if (orientation === "horizontal") {
      column.style.setProperty("--rail-inset", "0px");
      const publishBottom = () => {
        // Hauteur du rail + offset `bottom` (safe-area) pour que légende /
        // attribution s'adossent juste au-dessus.
        const bottomPx = Number.parseFloat(getComputedStyle(rail).bottom) || 8;
        const inset = rail.offsetHeight + bottomPx;
        column.style.setProperty("--rail-bottom-inset", `${inset}px`);
      };
      publishBottom();
      const observer = new ResizeObserver(publishBottom);
      observer.observe(rail);
      return () => {
        observer.disconnect();
        column.style.removeProperty("--rail-inset");
        column.style.removeProperty("--rail-bottom-inset");
      };
    }

    column.style.setProperty("--rail-bottom-inset", "0px");
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
      column.style.removeProperty("--rail-bottom-inset");
    };
  }, [orientation]);

  // Les tutoriels ciblent des items qui peuvent être hors de la zone visible du
  // rail (défilement vertical, ou barre horizontale sur mobile). Un événement
  // custom plutôt qu'un contexte : config/tours/* reste des données pures, sans
  // couplage à l'arbre React.
  useEffect(() => {
    const handler = (event: Event) => {
      const selector = (event as CustomEvent<{ selector?: string }>).detail
        ?.selector;
      const target = selector
        ? containerRef.current?.querySelector<HTMLElement>(selector)
        : null;
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    window.addEventListener("openairmap:rail-reveal", handler);
    return () => window.removeEventListener("openairmap:rail-reveal", handler);
  }, [containerRef]);

  const isVertical = orientation === "vertical";

  return (
    <nav
      ref={railRef}
      data-testid="map-control-rail"
      aria-label={t("rail.regionLabel")}
      className={cn(
        "glass-1 absolute z-rail flex animate-rail-in",
        isVertical
          // Réserve 5rem en bas : la bande instrument (rose des vents et échelle)
            // occupe l'angle bas-gauche, et sur un viewport court le rail
            // l'atteindrait — mesuré à 620 px de haut.
            ? "left-3 top-3 max-h-[calc(100%-5rem)] flex-col items-center"
          // Horizontal : left/right fixes ; le `bottom` est en style (safe-area iOS)
          : "left-2 right-2 flex-row items-center",
        // Les `max()` protègent d'une taille de police racine réduite.
        isVertical &&
          (compact ? "w-[max(3.75rem,60px)]" : "w-[max(4.5rem,72px)]"),
        // Propriétés arbitraires plutôt que les raccourcis de durée et d'easing :
        // ceux-ci sont ambigus pour Tailwind (transition- ou animation-) et sont
        // alors purement et simplement omis de la feuille produite.
        isVertical &&
          "transition-[width] [transition-duration:var(--dur-panel)] [transition-timing-function:var(--ease-out)]",
        "gap-1 p-1.5"
      )}
      style={{
        borderRadius: isVertical ? "var(--r-xl)" : "var(--r-lg)",
        // Consommée par .rail-item. Le défaut (48px) vit dans index.css : le rail
        // horizontal et le mode compact n'ont donc rien à déclarer.
        ...(isVertical && !compact ? { "--rail-item-w": "56px" } : null),
        // Ancrage au-dessus de l'indicateur d'accueil / chrome iOS — pas seulement
        // du padding interne, sinon la barre semble « glisser » sous Safari.
        ...(!isVertical
          ? {
              bottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
            }
          : null),
      } as React.CSSProperties}
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
            communitySources={communitySources}
          />
          <RailModesSection orientation={orientation} onItemFocus={onItemFocus} />
          <RailShortcutsSection
            orientation={orientation}
            shortcuts={shortcuts}
          />
          {/* Dernier de la zone défilante, donc directement au-dessus du pied :
              le fond de carte se range avec les réglages d'affichage. */}
          <RailBaseLayerSection
            orientation={orientation}
            onItemFocus={onItemFocus}
            baseLayer={baseLayer}
          />
        </div>

        {/* Pied épinglé : ne défile jamais avec les groupes de contrôles */}
        <RailFooter orientation={orientation} onItemFocus={onItemFocus} />
      </div>
    </nav>
  );
};

export default MapControlRail;
