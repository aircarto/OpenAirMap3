import React, { useId, useState } from 'react';
import { cn } from '../../lib/utils';

const STORAGE_PREFIX = 'oam-panel-section:';

const readStoredOpen = (storageKey: string | undefined, defaultOpen: boolean) => {
  if (!storageKey || typeof sessionStorage === 'undefined') {
    return defaultOpen;
  }
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // sessionStorage indisponible (mode privé / quota)
  }
  return defaultOpen;
};

export interface CollapsiblePanelSectionProps {
  title: string;
  /** Ouvert par défaut si aucune préférence session. */
  defaultOpen?: boolean;
  /** Clé sessionStorage pour mémoriser ouvert/fermé. */
  storageKey?: string;
  children: React.ReactNode;
  className?: string;
  /** Contenu toujours visible à droite du titre (ex. badge). */
  trailing?: React.ReactNode;
}

/**
 * Section repliable pour meta / infos / sessions : fermée par défaut,
 * pousse le scroll du body sans écraser le graphique.
 */
const CollapsiblePanelSection: React.FC<CollapsiblePanelSectionProps> = ({
  title,
  defaultOpen = false,
  storageKey,
  children,
  className,
  trailing,
}) => {
  const contentId = useId();
  const [open, setOpen] = useState(() => readStoredOpen(storageKey, defaultOpen));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(
            `${STORAGE_PREFIX}${storageKey}`,
            next ? '1' : '0'
          );
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        'shrink-0 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)]',
        className
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          'flex min-h-9 w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors',
          'hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2',
          'motion-reduce:transition-none'
        )}
      >
        <svg
          className={cn(
            'h-4 w-4 shrink-0 text-[color:var(--fg-muted)] transition-transform duration-200',
            'motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--fg)]">
          {title}
        </span>
        {trailing}
      </button>
      {open ? (
        <div id={contentId} className="border-t border-[rgb(16_32_56_/_0.06)] px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default CollapsiblePanelSection;
