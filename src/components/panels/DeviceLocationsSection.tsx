import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceLocationStay } from '../../types';
import CollapsiblePanelSection from './CollapsiblePanelSection';
import DeviceLocationsList from './DeviceLocationsList';

export interface DeviceLocationsSectionProps {
  stays: DeviceLocationStay[];
  /** Survol / focus d'un site (highlight courbe). */
  highlightedLocationId: string | null;
  onHighlightLocation: (locationId: string | null) => void;
  onCenterLocation: (stay: DeviceLocationStay) => void;
  onLoadPeriod: (stay: DeviceLocationStay) => void;
  /** Préfixe de titre optionnel (mode comparaison : nom de station). */
  stationLabel?: string;
  storageKey?: string;
  className?: string;
}

/**
 * Encart repliable listant les sites successifs d'un microcapteur AtmoMicro.
 * Visible uniquement si stays.length >= 2 (filtré par l'appelant).
 */
const DeviceLocationsSection: React.FC<DeviceLocationsSectionProps> = ({
  stays,
  highlightedLocationId,
  onHighlightLocation,
  onCenterLocation,
  onLoadPeriod,
  stationLabel,
  storageKey = 'device-locations',
  className,
}) => {
  const { t } = useTranslation();

  const title = useMemo(() => {
    const base = t('panels.deviceLocations.title');
    return stationLabel ? `${stationLabel} — ${base}` : base;
  }, [stationLabel, t]);

  if (stays.length < 2) {
    return null;
  }

  return (
    <CollapsiblePanelSection
      title={title}
      storageKey={storageKey}
      defaultOpen={true}
      className={className}
      trailing={
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {t('panels.deviceLocations.count', { count: stays.length })}
        </span>
      }
    >
      <DeviceLocationsList
        stays={stays}
        highlightedLocationId={highlightedLocationId}
        onHighlightLocation={onHighlightLocation}
        onCenterLocation={onCenterLocation}
        onLoadPeriod={onLoadPeriod}
      />
    </CollapsiblePanelSection>
  );
};

export default DeviceLocationsSection;
