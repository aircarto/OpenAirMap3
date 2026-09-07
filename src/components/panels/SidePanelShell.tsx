import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import SidePanelHeader from "./SidePanelHeader";

/**
 * Taille d'un panneau latéral. Référence unique du projet : les hooks
 * (`useSidePanels`, `useSignalAir`, `useMobileAir`) et `MapFloatingActions`
 * importent ce type au lieu d'en redéclarer chacun une copie.
 */
export type PanelSize = "normal" | "fullscreen" | "hidden";

/**
 * Durée de l'animation de sortie. Doit rester égale à `--dur-panel` : le
 * timeout JS libère l'état exactement quand l'animation CSS se termine.
 */
export const PANEL_EXIT_MS = 300;

/** Échelles de largeur. Deux suffisent — il en existait cinq, par dérive. */
const WIDTHS = {
  default: "w-full sm:w-[320px] md:w-[400px] lg:w-[600px] xl:w-[650px]",
  compact: "w-full sm:w-[340px] md:w-[420px] lg:w-[480px] xl:w-[520px]",
} as const;

export interface SidePanelShellProps {
  isOpen: boolean;
  /**
   * Taille pilotée par l'appelant. Requise : les onze panneaux la recevaient
   * déjà tous de MapPanelsContainer, et le repli « non contrôlé » qu'ils
   * portaient chacun (`externalPanelSize || internalPanelSize`) n'était donc
   * jamais emprunté.
   */
  panelSize: PanelSize;
  onSizeChange: (size: PanelSize) => void;
  onHidden?: () => void;
  /**
   * Fermeture véritable, distincte du rabat. Un bouton n'apparaît dans
   * l'en-tête que si elle est fournie (aujourd'hui : SignalAir, qui désactive
   * sa source entière).
   */
  onClose?: () => void;
  closeLabel?: string;
  title: React.ReactNode;
  /** Ligne secondaire sous le titre (source, adresse, horodatage…) */
  subtitle?: React.ReactNode;
  /** Pastille collée au titre, ex. rappel du bouton de réouverture */
  badge?: React.ReactNode;
  /** Contrôles propres au panneau, posés avant les boutons de taille */
  headerExtra?: React.ReactNode;
  width?: keyof typeof WIDTHS;
  testId?: string;
  /**
   * Nom de la région. Par défaut le titre s'il est une chaîne — un titre
   * composé de JSX ne peut pas servir de libellé accessible.
   */
  ariaLabel?: string;
  /** Remplace les classes de la zone défilante (espacement interne) */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Coquille commune des panneaux latéraux.
 *
 * Elle existait en onze exemplaires copiés-collés : onze `getPanelClasses`, onze
 * en-têtes, onze zones défilantes, avec la dérive qui accompagne toujours la
 * duplication (cinq échelles de largeur, un `border-l` à l'envers, cinq panneaux
 * qui ne s'animaient jamais, une réservation de 64 px pour un header supprimé).
 *
 * Ce qu'elle possède : la taille courante, l'animation de sortie et son portail,
 * l'en-tête, la zone défilante, la touche Échap. Les panneaux ne gardent que
 * leur contenu.
 *
 * Surface `glass-2` : l'alpha de ce niveau est documenté « flyouts et panneaux :
 * portent du texte dense ». Coins francs et non arrondis, assumé — le panneau est
 * un frère flex qui POUSSE la colonne carte au lieu de la survoler, arrondir le
 * bord droit découvrirait le fond de page et non la carte.
 */
export const SidePanelShell: React.FC<SidePanelShellProps> = ({
  isOpen,
  panelSize: size,
  onSizeChange,
  onHidden,
  onClose,
  closeLabel,
  title,
  subtitle,
  badge,
  headerExtra,
  width = "default",
  testId,
  ariaLabel,
  bodyClassName,
  children,
}) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleSizeChange = useCallback(
    (next: PanelSize) => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);

      if (next === "hidden" && size !== "hidden") {
        // La taille passe à "hidden" AVANT l'animation : le panneau quitte le
        // flux flex et la carte se redimensionne tout de suite. L'animation se
        // joue ensuite dans un portail, hors du conteneur.
        onSizeChange(next);
        setIsAnimatingOut(true);
        exitTimeoutRef.current = setTimeout(() => {
          setIsAnimatingOut(false);
          onHidden?.();
        }, PANEL_EXIT_MS);
        return;
      }

      setIsAnimatingOut(false);
      onSizeChange(next);
    },
    [onSizeChange, onHidden, size]
  );

  // Réouverture : purge un état de sortie resté armé
  useEffect(() => {
    if (isOpen && size !== "hidden") setIsAnimatingOut(false);
  }, [isOpen, size]);

  useEffect(
    () => () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    },
    []
  );

  /**
   * Échap replie le panneau, mais seulement si le focus est DANS le panneau.
   *
   * Le panneau n'est pas modal : un Échap global lui appartiendrait à tort et
   * détournerait celui qui vide le champ de recherche ou ferme un flyout du
   * rail. La garde sur `contains(activeElement)` donne la portée voulue, et
   * `defaultPrevented` laisse la priorité à un popover Radix ouvert à
   * l'intérieur, qui consomme déjà la touche pour se fermer.
   *
   * Écouteur sur `window` plutôt que `onKeyDown` sur le conteneur : poser un
   * gestionnaire de clavier sur un élément non interactif (`role="region"`)
   * est précisément ce que déconseille jsx-a11y, et le bouton « rabattre »
   * reste de toute façon l'affordance clavier principale.
   */
  useEffect(() => {
    if (!isOpen || size === "hidden") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const root = panelRef.current;
      if (!root || !root.contains(document.activeElement)) return;
      handleSizeChange("hidden");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, size, handleSizeChange]);

  const panelClasses = cn(
    "glass-2 relative z-panel flex h-full min-h-0 flex-col",
    isAnimatingOut
      ? // `fixed` pour rester visible alors que le panneau est déjà sorti du flux
        cn(
          "fixed left-0 top-0",
          WIDTHS[width],
          "animate-slide-out-left will-change-transform"
        )
      : size === "fullscreen"
      ? // `absolute` et non un frère flex : en plein écran le panneau recouvre la
        // carte au lieu de la comprimer à zéro.
        "absolute inset-0 w-full animate-slide-in-left"
      : size === "hidden"
      ? "hidden"
      : cn(WIDTHS[width], "animate-slide-in-left"),
    size !== "hidden" &&
      !isAnimatingOut &&
      "transition-all [transition-duration:var(--dur-panel)] [transition-timing-function:var(--ease-out)]"
  );

  const content = (
    <div
      ref={panelRef}
      className={panelClasses}
      data-testid={testId}
      // `region` et non `dialog` : ces panneaux poussent le contenu au lieu de le
      // recouvrir, ils ne sont pas modaux. Annoncer `dialog`/`aria-modal`
      // promettrait un piège de focus qui n'existe pas.
      role="region"
      aria-label={
        ariaLabel ?? (typeof title === "string" ? title : undefined)
      }
    >
      <SidePanelHeader
        title={title}
        subtitle={subtitle}
        badge={badge}
        extra={headerExtra}
        size={size}
        onSizeChange={handleSizeChange}
        onClose={onClose}
        closeLabel={closeLabel}
      />

      {size !== "hidden" && (
        <div
          className={cn(
            // `min-h-0` est ce qui rend `overflow-y-auto` effectif : sans lui la
            // zone refuse de se réduire sous la hauteur de son contenu et c'est
            // le panneau entier qui déborde.
            "min-h-0 flex-1 overflow-y-auto",
            bodyClassName ?? "space-y-4 p-3 sm:space-y-6 sm:p-4"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;
  if (isAnimatingOut && size === "hidden")
    return createPortal(content, document.body);
  if (size === "hidden") return null;
  return content;
};

export default SidePanelShell;
