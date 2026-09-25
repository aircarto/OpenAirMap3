import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MobileAirMovingMode } from '../../types';
import { mobileAirMovingI18nKey } from '../../constants/mobileAirMoving';
import { cn } from '../../lib/utils';

interface MobileAirMovingBadgeProps {
  moving?: MobileAirMovingMode | null;
  className?: string;
  /** Affiche uniquement l’icône (aria-label = libellé). */
  iconOnly?: boolean;
}

const iconClass = 'h-3.5 w-3.5 shrink-0';

const MovingIcon: React.FC<{ moving?: MobileAirMovingMode | null }> = ({
  moving,
}) => {
  switch (moving) {
    case 0: // à pied
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="4.5" r="2" />
          <path d="M12 7.5v4.5l-3 6M12 12l3 6M9 11.5l3 .5 3-.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 1: // vélo
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="6.5" cy="16.5" r="3" />
          <circle cx="17.5" cy="16.5" r="3" />
          <path d="M6.5 16.5l4-8h4l3 8M10.5 8.5h3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 2: // voiture
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M4 15.5h16v2.5H4zM6 15.5l1.5-5h9l1.5 5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7.5" cy="18.5" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="18.5" r="1.25" fill="currentColor" stroke="none" />
        </svg>
      );
    case 3: // TC
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="5" y="3.5" width="14" height="13" rx="2" />
          <path d="M5 11.5h14M9 16.5v2.5M15 16.5v2.5" strokeLinecap="round" />
          <circle cx="8.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 4: // fixe
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      );
  }
};

/**
 * Badge mode mobilité (panneau seulement — pas sur la carte).
 */
export const MobileAirMovingBadge: React.FC<MobileAirMovingBadgeProps> = ({
  moving,
  className,
  iconOnly = false,
}) => {
  const { t } = useTranslation();
  const label = t(mobileAirMovingI18nKey(moving));

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-[rgb(16_32_56_/_0.12)] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--fg-muted)]',
        className
      )}
      title={label}
      aria-label={label}
    >
      <MovingIcon moving={moving} />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
};

export default MobileAirMovingBadge;
