import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface OverlayLegendItem {
  id: string;
  /** Libellé court pour la pastille */
  chipLabel: string;
  /** Titre affiché dans le détail */
  title: string;
  imageUrl: string;
  accentClass?: string;
}

interface OverlayLegendsCardProps {
  items: OverlayLegendItem[];
  /** Affiche le bouton fermer (popover mobile) */
  showCloseButton?: boolean;
  onClose?: () => void;
}

/**
 * Carte de légendes (pastilles + détail image) — à placer dans une colonne flex
 */
export const OverlayLegendsCard: React.FC<OverlayLegendsCardProps> = ({
  items,
  showCloseButton = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );

  useEffect(() => {
    if (expandedId && !items.some((item) => item.id === expandedId)) {
      setExpandedId(null);
    }
  }, [items, expandedId]);

  useEffect(() => {
    setImageStatus('loading');
  }, [expandedId]);

  if (items.length === 0) {
    return null;
  }

  const expandedItem = items.find((item) => item.id === expandedId) ?? null;

  const handleChipClick = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="bg-white px-3 py-2 rounded-md shadow-lg border border-gray-200/70 w-fit max-w-[min(100vw-2rem,20rem)]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-gray-600 font-medium">
          {t('baseLayer.overlayLegendsTitle')}
        </p>
        {showCloseButton && (
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 p-0.5"
            onClick={onClose}
            aria-label={t('baseLayer.overlayLegendsClose')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleChipClick(item.id)}
              className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                isExpanded
                  ? item.accentClass ??
                    'bg-orange-50 text-orange-900 border-orange-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
              aria-pressed={isExpanded}
            >
              {item.chipLabel}
            </button>
          );
        })}
      </div>

      {expandedItem && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-500 font-medium mb-1.5 whitespace-pre-line">
            {expandedItem.title}
          </p>
          <div className="max-h-48 max-w-[280px] overflow-auto overscroll-contain rounded border border-gray-100 bg-gray-50/50 p-1">
            {imageStatus === 'loading' && (
              <p className="text-[11px] text-gray-400 px-1 py-2">
                {t('baseLayer.overlayLegendsLoading')}
              </p>
            )}
            {imageStatus === 'error' && (
              <p className="text-[11px] text-red-500 px-1 py-2">
                {t('baseLayer.overlayLegendsError')}
              </p>
            )}
            <img
              src={expandedItem.imageUrl}
              alt={expandedItem.title}
              className={`h-auto max-w-full ${
                imageStatus === 'ready' ? 'block' : 'hidden'
              }`}
              onLoad={() => setImageStatus('ready')}
              onError={() => setImageStatus('error')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface OverlayLegendsMobileProps {
  items: OverlayLegendItem[];
  sidePanelOffset?: boolean;
}

/**
 * Bouton + popover légendes pour mobile (< lg)
 */
export const OverlayLegendsMobile: React.FC<OverlayLegendsMobileProps> = ({
  items,
  sidePanelOffset = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length === 0) {
      setIsOpen(false);
    }
  }, [items]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  if (items.length === 0) {
    return null;
  }

  const rightOffset = sidePanelOffset
    ? 'right-4'
    : 'right-0 sm:right-2';

  return (
    <div
      ref={panelRef}
      className={`absolute bottom-24 ${rightOffset} z-[1000] lg:hidden`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="bg-white/95 backdrop-blur-sm border border-gray-200/70 rounded-md shadow-lg px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? t('baseLayer.overlayLegendsClose')
            : t('baseLayer.overlayLegendsOpen')
        }
      >
        <span className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-orange-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          {t('baseLayer.overlayLegendsTitle')}
        </span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 max-h-[45vh] overflow-y-auto">
          <OverlayLegendsCard
            items={items}
            showCloseButton
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

export default OverlayLegendsCard;
