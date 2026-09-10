import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { PanelSize } from "./SidePanelShell";

export interface SidePanelHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  /** Contrôles propres au panneau, posés avant les boutons de taille */
  extra?: React.ReactNode;
  size: PanelSize;
  onSizeChange: (size: PanelSize) => void;
  /**
   * Fermeture véritable, distincte du rabat, quand le panneau en propose une :
   * SignalAir désactive sa source entière. Le bouton n'apparaît que si elle est
   * fournie, avec son propre libellé — « fermer » et « rabattre » ne disent pas
   * la même chose et ne peuvent pas partager une infobulle.
   */
  onClose?: () => void;
  closeLabel?: string;
}

/**
 * En-tête commun des panneaux latéraux : titre, sous-titre, pastille, puis les
 * deux boutons de taille (agrandir/rétrécir, rabattre).
 *
 * Les boutons font 44 px — la cible tactile du reste de la refacto — au lieu des
 * `p-1.5 sm:p-2` d'origine qui donnaient ~30 px, et portent `.panel-control`
 * pour l'anneau de focus double conçu pour les surfaces translucides.
 */
export const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
  title,
  subtitle,
  badge,
  extra,
  size,
  onSizeChange,
  onClose,
  closeLabel,
}) => {
  const { t } = useTranslation();
  const isFullscreen = size === "fullscreen";

  const controlClass =
    "panel-control flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[color:var(--fg-muted)] hover:bg-black/5 hover:text-[color:var(--fg)]";

  return (
    <div
      className={cn(
        // Rembourrage horizontal aligné sur celui du corps (p-3 sm:p-4) : le
        // titre et les cartes de contenu doivent partager la même marge gauche.
        // Vertical plus serré, les boutons de 44 px donnant déjà la hauteur.
        "flex items-center justify-between gap-2 px-3 py-1.5 sm:px-4",
        "border-b border-[rgb(16_32_56_/_0.09)]"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold text-[color:var(--fg)] sm:text-lg">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="truncate text-xs text-[color:var(--fg-muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {extra}

      {/* Débord dans le rembourrage : les cibles de 44 px restent optiquement
          près du bord, comme la croix des notices, sans rétrécir la cible. */}
      <div className="-mr-1 flex shrink-0 items-center sm:-mr-2">
        {/* Sous sm le panneau occupe déjà toute la largeur (carte repliée) :
            agrandir / rétrécir n'a aucun effet visible. */}
        <button
          type="button"
          onClick={() => onSizeChange(isFullscreen ? "normal" : "fullscreen")}
          className={cn(controlClass, "hidden sm:flex")}
          title={isFullscreen ? t("panels.shrinkPanel") : t("panels.expandPanel")}
          aria-label={
            isFullscreen ? t("panels.shrinkPanel") : t("panels.expandPanel")
          }
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isFullscreen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
            />
          </svg>
        </button>

        {/* Rabattre : double chevron « vers le côté », et non une croix. Un
            panneau peut proposer les DEUX actions (SignalAir ferme sa source en
            plus de se rabattre) et deux croix seraient indiscernables. La croix
            reste réservée à la fermeture véritable. */}
        <button
          type="button"
          onClick={() => onSizeChange("hidden")}
          className={controlClass}
          title={t("panels.collapsePanel")}
          aria-label={t("panels.collapsePanel")}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m9 14l-7-7 7-7"
            />
          </svg>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={controlClass}
            title={closeLabel ?? t("panels.closePanel")}
            aria-label={closeLabel ?? t("panels.closePanel")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SidePanelHeader;
