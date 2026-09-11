import { useEffect, useMemo, useRef, useState } from 'react';
import { DataServiceFactory } from '../services/DataServiceFactory';
import { AtmoMicroService } from '../services/AtmoMicroService';
import { AtmoRefService } from '../services/AtmoRefService';
import { NebuleAirService } from '../services/NebuleAirService';
import type { MeasurementDevice, TemporalDataPoint } from '../types';
import {
  buildAirCrowdWmsHourWindow,
  filterDevicesByAtmoMicroWhitelist,
  mergeTemporalDataPoints,
  pickClosestTemporalPoint,
  resolveAirCrowdWmsTemporalSources,
} from '../utils/airCrowdWmsMeasurements';

const DEBOUNCE_MS = 300;
/** Pas de temps forcé : les layers WMS AirCrowd sont horaires. */
const AIRCROWD_WMS_TIME_STEP = 'heure';

export interface UseAirCrowdWmsMeasurementsProps {
  enabled: boolean;
  date: string;
  hour: number;
  pollutant: string;
  selectedSources: string[];
  atmoMicroAllowedSiteIds?: Array<string | number>;
}

export interface UseAirCrowdWmsMeasurementsResult {
  devices: MeasurementDevice[];
  loading: boolean;
  error: string | null;
}

/**
 * Snapshot capteurs aligné sur la date/heure de la carto WMS AirCrowd.
 * Masque le live dès l’activation ; charge via fetchTemporalData (1 h).
 */
export const useAirCrowdWmsMeasurements = ({
  enabled,
  date,
  hour,
  pollutant,
  selectedSources,
  atmoMicroAllowedSiteIds,
}: UseAirCrowdWmsMeasurementsProps): UseAirCrowdWmsMeasurementsResult => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const atmoMicroService = useRef(
    DataServiceFactory.getService('atmoMicro') as AtmoMicroService
  );
  const atmoRefService = useRef(
    DataServiceFactory.getService('atmoRef') as AtmoRefService
  );
  const nebuleAirService = useRef(
    DataServiceFactory.getService('nebuleair') as NebuleAirService
  );

  const sourcesKey = useMemo(
    () => selectedSources.slice().sort().join(','),
    [selectedSources]
  );

  const allowedIdsKey = useMemo(
    () =>
      (atmoMicroAllowedSiteIds ?? [])
        .map((id) => id.toString().toUpperCase())
        .sort()
        .join(','),
    [atmoMicroAllowedSiteIds]
  );

  useEffect(() => {
    if (!enabled || !date) {
      requestIdRef.current += 1;
      setDevices([]);
      setLoading(false);
      setError(null);
      return;
    }

    const temporalSources = resolveAirCrowdWmsTemporalSources(selectedSources);
    if (temporalSources.length === 0) {
      requestIdRef.current += 1;
      setDevices([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setDevices([]);

    const timer = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      const { startDate, endDate, targetMs } = buildAirCrowdWmsHourWindow(
        date,
        hour
      );

      try {
        const promises: Promise<TemporalDataPoint[]>[] = [];

        if (temporalSources.includes('atmoMicro')) {
          promises.push(
            atmoMicroService.current.fetchTemporalData({
              pollutant,
              timeStep: AIRCROWD_WMS_TIME_STEP,
              startDate,
              endDate,
            })
          );
        }
        if (temporalSources.includes('atmoRef')) {
          promises.push(
            atmoRefService.current.fetchTemporalData({
              pollutant,
              timeStep: AIRCROWD_WMS_TIME_STEP,
              startDate,
              endDate,
            })
          );
        }
        if (temporalSources.includes('communautaire.nebuleair')) {
          promises.push(
            nebuleAirService.current.fetchTemporalData({
              pollutant,
              timeStep: AIRCROWD_WMS_TIME_STEP,
              startDate,
              endDate,
            })
          );
        }

        const results = await Promise.all(promises);
        if (requestId !== requestIdRef.current) return;

        const merged = mergeTemporalDataPoints(results);
        const closest = pickClosestTemporalPoint(merged, targetMs);
        const snapshot = closest?.devices ?? [];
        const filtered = filterDevicesByAtmoMicroWhitelist(
          snapshot,
          atmoMicroAllowedSiteIds
        );

        setDevices(filtered);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('❌ [AIRCROWD WMS] Erreur fetch mesures:', err);
        setDevices([]);
        setLoading(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des mesures AirCrowd'
        );
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
    // sourcesKey / allowedIdsKey capturent le contenu des tableaux
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable keys
  }, [enabled, date, hour, pollutant, sourcesKey, allowedIdsKey]);

  return { devices, loading, error };
};
