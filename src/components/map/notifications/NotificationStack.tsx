import React from "react";
import { cn } from "../../../lib/utils";
import type { Notice, NoticeTone } from "./notice";

export interface NotificationStackProps {
  notices: Notice[];
  /** Nombre visible avant repli ; les suivantes sont comptées dans une pastille */
  maxVisible?: number;
  className?: string;
}

/**
 * Pile unique des notices de la carte.
 *
 * Remplace une douzaine de `<div>` posées à la main sur `top-24`, `top-32`,
 * `top-36` et `top-40 right-4` : trois partageaient `top-32` et trois `top-40`,
 * si bien qu'elles se recouvraient physiquement dès que deux couches feux
 * chargeaient en même temps. Une colonne flex supprime le problème par
 * construction, au lieu de le déplacer d'un cran.
 *
 * Le conteneur est une région live : aujourd'hui aucune de ces notices n'était
 * annoncée, donc un lecteur d'écran n'était jamais informé qu'une couche avait
 * échoué à charger. Les notices d'erreur portent en plus leur propre
 * `role="alert"` pour être annoncées immédiatement.
 */
const toneBar: Record<NoticeTone, string> = {
  info: "border-l-[hsl(var(--brand-600))]",
  warn: "border-l-[#F59E0B]",
  error: "border-l-[#B42318]",
  neutral: "border-l-[color:var(--fg-muted)]",
};

const toneText: Record<NoticeTone, string> = {
  info: "text-[color:var(--fg)]",
  warn: "text-[color:var(--fg-warn)]",
  error: "text-[color:var(--fg-danger)]",
  neutral: "text-[color:var(--fg-muted)]",
};

export const NotificationStack: React.FC<NotificationStackProps> = ({
  notices,
  maxVisible = 4,
  className,
}) => {
  if (notices.length === 0) return null;

  const visible = notices.slice(0, maxVisible);
  const hiddenCount = notices.length - visible.length;

  return (
    <div
      data-testid="map-notifications"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        // `w-full` est nécessaire : l'enveloppe aligne ses enfants en `items-end`,
        // sans quoi la pile se dimensionne à son contenu et les notices se
        // retrouvent bien plus étroites que la largeur réservée.
        "flex w-full max-h-[calc(100%-12rem)] flex-col items-end gap-2 overflow-y-auto",
        className
      )}
    >
      {visible.map((notice) => (
        <div
          key={notice.id}
          {...(notice.tone === "error" ? { role: "alert" } : {})}
          className={cn(
            "glass-3 pointer-events-auto flex w-full max-w-[22rem] items-start gap-2 border-l-[3px] px-3 py-2",
            "rounded-[var(--r-md)] text-xs animate-scale-in",
            toneBar[notice.tone]
          )}
        >
          {notice.busy && (
            <span
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-b-transparent opacity-70"
            />
          )}
          <div className={cn("min-w-0 flex-1", toneText[notice.tone])}>
            <p className="font-medium">{notice.message}</p>
            {notice.detail && (
              <p className="mt-0.5 text-[11px] opacity-80">{notice.detail}</p>
            )}
          </div>
          {notice.onDismiss && (
            <button
              type="button"
              onClick={notice.onDismiss}
              aria-label={notice.dismissLabel}
              // 44x44 de cible tactile : l'ancien bouton de la carte promo
              // faisait ~20x20, sous le minimum
              className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-[color:var(--fg-muted)] transition-colors hover:bg-black/5 hover:text-[color:var(--fg)]"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {hiddenCount > 0 && (
        <span className="glass-3 rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg-muted)]">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

export default NotificationStack;
