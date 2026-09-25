import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MobileAirContextType } from '../../types';
import { mobileAirContextTypeI18nKey } from '../../utils/mobileAirContextMatch';
import { cn } from '../../lib/utils';

interface MobileAirContextTypeIconProps {
  contextType: MobileAirContextType | string;
  className?: string;
  showLabel?: boolean;
}

const iconClass = 'h-4 w-4 shrink-0';

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'fire':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M12 3c2 4-1 5 1 9 0 0 4-2 4-6 3 3 4 6 4 9a7 7 0 11-14 0c0-3 2-6 5-12z" strokeLinejoin="round" />
        </svg>
      );
    case 'industrial':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M3 20h18M5 20V10l5 3V10l5 3V6h4v14" strokeLinejoin="round" />
        </svg>
      );
    case 'traffic':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="8" y="2" width="8" height="18" rx="2" />
          <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'neighbourhood':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M3 20V10l9-6 9 6v10H3z" strokeLinejoin="round" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'works':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M14.5 5.5l4 4M4 20l7-7M16 3l5 5-3.5 1.5L14.5 6.5 16 3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'cleaning':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M12 3v10M8 8h8M7 21h10l-1.5-8h-7L7 21z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'cooking':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M6 14c0-4 2.5-7 6-7s6 3 6 7v5H6v-5zM9 7V4M15 7V4" strokeLinecap="round" />
        </svg>
      );
    case 'meeting':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M3.5 19c1-3 3-4.5 5.5-4.5S14 16 15 19M14 14.5c1.5.2 3 1.2 4 3.5" strokeLinecap="round" />
        </svg>
      );
    case 'fault':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M12 3l9 16H3L12 3z" strokeLinejoin="round" />
          <path d="M12 10v4M12 16.5h.01" strokeLinecap="round" />
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

export const MobileAirContextTypeIcon: React.FC<MobileAirContextTypeIconProps> = ({
  contextType,
  className,
  showLabel = false,
}) => {
  const { t } = useTranslation();
  const label = t(mobileAirContextTypeI18nKey(contextType), {
    defaultValue: contextType,
  });

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={label}
      aria-label={label}
    >
      <TypeIcon type={contextType} />
      {showLabel && <span>{label}</span>}
    </span>
  );
};

export default MobileAirContextTypeIcon;
