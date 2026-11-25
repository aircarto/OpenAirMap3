'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalisationKind } from '../../services/microspot/campaignLocalisations';

export interface SiteListDevice {
  id: string;
  label: string;
  period: string;
  hidden: boolean;
  rows?: number;
}

export interface SiteListItem {
  key: string;
  label: string;
  /** Adresse en cours de résolution, coordonnées… */
  detail: string | null;
  period: string;
  color: string;
  kind: LocalisationKind;
  discovered: boolean;
  extract: boolean;
  shown: boolean;
  rows?: number;
  devices: SiteListDevice[];
}

interface CampaignSiteListProps {
  items: SiteListItem[];
  hasData: boolean;
  running: boolean;
  onToggleExtract: (key: string) => void;
  onSetAllExtract: (value: boolean) => void;
  onToggleShown: (key: string) => void;
  onSetAllShown: (value: boolean) => void;
  onToggleDevice: (key: string, deviceId: string) => void;
  onHover: (key: string | null) => void;
}

/**
 * Liste latérale par localisation : case « extraire » avant chargement,
 * interrupteur « afficher » après, capteurs du site dépliables.
 */
export const CampaignSiteList: React.FC<CampaignSiteListProps> = ({
  items,
  hasData,
  running,
  onToggleExtract,
  onSetAllExtract,
  onToggleShown,
  onSetAllShown,
  onToggleDevice,
  onHover,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const extractCount = items.filter((i) => i.extract && !i.discovered).length;
  const declaredCount = items.filter((i) => !i.discovered).length;

  return (
    <div className="flex min-h-0 flex-col gap-1 text-sm" data-testid="campaigns-sites">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {t('campaigns.sites.title', { count: declaredCount })}
          {!hasData && declaredCount > 0 && (
            <span className="font-normal text-slate-500">
              {' '}
              · {t('campaigns.sites.toExtract', { count: extractCount })}
            </span>
          )}
        </span>
        <span className="flex gap-2 text-xs">
          <button
            type="button"
            className="text-[#1f3c6d] hover:underline disabled:opacity-50"
            disabled={running}
            onClick={() => (hasData ? onSetAllShown(true) : onSetAllExtract(true))}
          >
            {t('campaigns.selectAll')}
          </button>
          <button
            type="button"
            className="text-[#1f3c6d] hover:underline disabled:opacity-50"
            disabled={running}
            onClick={() => (hasData ? onSetAllShown(false) : onSetAllExtract(false))}
          >
            {t('campaigns.selectNone')}
          </button>
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {hasData ? t('campaigns.sites.hintShow') : t('campaigns.sites.hintExtract')}
      </p>
      <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200">
        {items.map((item) => {
          const isOpen = expanded.has(item.key);
          const checked = hasData ? item.shown : item.extract;
          const disabled = running || (hasData && item.rows === undefined) || (!hasData && item.discovered);
          return (
            <li
              key={item.key}
              onMouseEnter={() => onHover(item.key)}
              onMouseLeave={() => onHover(null)}
              data-testid="campaigns-site"
              data-site-key={item.key}
            >
              <div className="flex items-start gap-2 px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => (hasData ? onToggleShown(item.key) : onToggleExtract(item.key))}
                  aria-label={
                    hasData
                      ? t('campaigns.sites.show', { name: item.label })
                      : t('campaigns.sites.extract', { name: item.label })
                  }
                  data-testid="campaigns-site-checkbox"
                />
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.extract || hasData ? item.color : '#cbd5e1' }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => toggleExpanded(item.key)}
                  aria-expanded={isOpen}
                >
                  <span className="truncate font-medium" title={item.label}>
                    {item.label}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {[
                      item.detail,
                      t('campaigns.deviceCount', { count: item.devices.length }),
                      item.period,
                      item.rows !== undefined ? t('campaigns.rows', { count: item.rows }) : null,
                      hasData && item.rows === undefined ? t('campaigns.noData') : null,
                      item.discovered ? t('campaigns.sites.discovered') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <span className="mt-0.5 text-xs text-slate-400" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
                </span>
              </div>
              {isOpen && (
                <ul className="mb-1 ml-9 flex flex-col gap-0.5 pr-2">
                  {item.devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-xs">
                      {hasData && (
                        <input
                          type="checkbox"
                          checked={!d.hidden}
                          disabled={d.rows === undefined}
                          onChange={() => onToggleDevice(item.key, d.id)}
                          aria-label={t('campaigns.sites.showDevice', { name: d.label })}
                        />
                      )}
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{d.label}</span>
                        <span className="text-slate-500">
                          {' '}
                          · {d.period}
                          {d.rows !== undefined && ` · ${t('campaigns.rows', { count: d.rows })}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CampaignSiteList;
