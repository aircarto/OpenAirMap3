import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataServiceFactory } from '../services/DataServiceFactory';
import { AtmoMicroService } from '../services/AtmoMicroService';
import { AtmoRefService } from '../services/AtmoRefService';
import { NebuleAirService } from '../services/NebuleAirService';
import { SignalAirService } from '../services/SignalAirService';
import type {
  MeasurementDevice,
  SignalAirReport,
  TemporalDataPoint,
} from '../types';
import {
  buildSlotFetchWindow,
  buildSnapshotBufferWindow,
  instantToIsoLocal,
  isInstantInBuffer,
  shouldPrefetchBuffer,
  snapshotBufferKey,
  type MapInstant,
  type SnapshotBufferWindow,
} from '../utils/mapInstant';
import {
  isHttpNotFound,
  mergeTemporalDataPoints,
  pickClosestTemporalPoint,
  resolveSnapshotTemporalSources,
} from '../utils/instantSnapshot';
import { filterReportsByDisplayWindow } from '../utils/signalAirDateUtils';

const NETWORK_DEBOUNCE_MS = 300;

export interface UseInstantSnapshotProps {
  enabled: boolean;
  instant: MapInstant | null;
  timeStep: string;
  pollutant: string;
  selectedSources: string[];
  signalAirEnabled?: boolean;
  signalAirSelectedTypes?: string[];
}

export interface UseInstantSnapshotResult {
  devices: MeasurementDevice[];
  reports: SignalAirReport[];
  loading: boolean;
  error: string | null;
}

type SnapshotBufferCache = SnapshotBufferWindow & {
  pollutant: string;
  timeStep: string;
  sourcesKey: string;
  typesKey: string;
  signalAirEnabled: boolean;
  points: TemporalDataPoint[];
  reports: SignalAirReport[];
};

const identityMatchesCache = (
  cache: SnapshotBufferCache | null,
  pollutant: string,
  timeStep: string,
  sourcesKey: string,
  typesKey: string,
  signalAirEnabled: boolean
): cache is SnapshotBufferCache =>
  Boolean(
    cache &&
      cache.pollutant === pollutant &&
      cache.timeStep === timeStep &&
      cache.sourcesKey === sourcesKey &&
      cache.typesKey === typesKey &&
      cache.signalAirEnabled === signalAirEnabled
  );

const windowKeyFor = (
  buffer: Pick<SnapshotBufferWindow, 'startDate' | 'endDate'>,
  pollutant: string,
  timeStep: string,
  sourcesKey: string,
  typesKey: string,
  signalAirEnabled: boolean
): string =>
  `${snapshotBufferKey(buffer, pollutant, timeStep, sourcesKey)}|${typesKey}|${signalAirEnabled}`;

/**
 * Snapshot capteurs + SignalAir autour de l’instant TimeBar.
 * Charge un bloc (7 j / 30 j / 365 j), pick local au slider.
 * Prefetch silencieux au bord : le cache affiché n’est remplacé que si l’instant
 * quitte le bloc (ou sur miss bloquant).
 */
export const useInstantSnapshot = ({
  enabled,
  instant,
  timeStep,
  pollutant,
  selectedSources,
  signalAirEnabled = false,
  signalAirSelectedTypes = [],
}: UseInstantSnapshotProps): UseInstantSnapshotResult => {
  const [cache, setCache] = useState<SnapshotBufferCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<SnapshotBufferCache | null>(null);
  const pendingCacheRef = useRef<SnapshotBufferCache | null>(null);
  const blockingIdRef = useRef(0);
  const prefetchIdRef = useRef(0);
  const prefetchInFlightRef = useRef(false);
  const instantRef = useRef(instant);
  instantRef.current = instant;

  const atmoMicroService = useRef(
    DataServiceFactory.getService('atmoMicro') as AtmoMicroService
  );
  const atmoRefService = useRef(
    DataServiceFactory.getService('atmoRef') as AtmoRefService
  );
  const nebuleAirService = useRef(
    DataServiceFactory.getService('nebuleair') as NebuleAirService
  );
  const signalAirService = useRef(
    DataServiceFactory.getService('signalair') as SignalAirService
  );

  const sourcesKey = useMemo(
    () => selectedSources.slice().sort().join(','),
    [selectedSources]
  );
  const typesKey = useMemo(
    () => signalAirSelectedTypes.slice().sort().join(','),
    [signalAirSelectedTypes]
  );

  const instantDate = instant?.date ?? '';
  const instantHour = instant?.hour ?? -1;
  const instantMinute = instant?.minute ?? 0;

  cacheRef.current = cache;

  const applyCache = useCallback((next: SnapshotBufferCache) => {
    cacheRef.current = next;
    setCache(next);
  }, []);

  const fetchBufferWindow = useCallback(
    async (
      window: SnapshotBufferWindow,
      context: {
        blocking: boolean;
        pollutant: string;
        timeStep: string;
        sourcesKey: string;
        typesKey: string;
        signalAirEnabled: boolean;
        selectedSources: string[];
        signalAirSelectedTypes: string[];
      }
    ) => {
      const requestId = context.blocking
        ? ++blockingIdRef.current
        : ++prefetchIdRef.current;

      if (context.blocking) {
        prefetchIdRef.current += 1;
        prefetchInFlightRef.current = false;
        setLoading(true);
        setError(null);
      } else {
        prefetchInFlightRef.current = true;
      }

      const temporalSources = resolveSnapshotTemporalSources(
        context.selectedSources
      );

      try {
        const sourcePromises: Promise<TemporalDataPoint[]>[] = [];

        if (temporalSources.includes('atmoMicro')) {
          sourcePromises.push(
            atmoMicroService.current.fetchTemporalData({
              pollutant: context.pollutant,
              timeStep: context.timeStep,
              startDate: window.startDate,
              endDate: window.endDate,
            })
          );
        }
        if (temporalSources.includes('atmoRef')) {
          sourcePromises.push(
            atmoRefService.current
              .fetchTemporalData({
                pollutant: context.pollutant,
                timeStep: context.timeStep,
                startDate: window.startDate,
                endDate: window.endDate,
              })
              .catch((err) => {
                if (isHttpNotFound(err)) return [];
                throw err;
              })
          );
        }
        if (temporalSources.includes('communautaire.nebuleair')) {
          sourcePromises.push(
            nebuleAirService.current.fetchTemporalData({
              pollutant: context.pollutant,
              timeStep: context.timeStep,
              startDate: window.startDate,
              endDate: window.endDate,
            })
          );
        }

        const signalAirTypes =
          context.signalAirSelectedTypes.length > 0
            ? context.signalAirSelectedTypes
            : ['odeur', 'bruit', 'brulage', 'visuel'];

        const signalAirPromise: Promise<SignalAirReport[]> =
          context.signalAirEnabled
            ? signalAirService.current
                .fetchData({
                  pollutant: context.pollutant,
                  timeStep: context.timeStep,
                  sources: ['signalair'],
                  signalAirPeriod: {
                    startDate: window.startInstant.date,
                    endDate: window.endInstant.date,
                  },
                  signalAirSelectedTypes: signalAirTypes,
                })
                .then((raw) => (Array.isArray(raw) ? raw : []))
                .catch((err) => {
                  console.warn('SignalAir: erreur snapshot:', err);
                  return [];
                })
            : Promise.resolve([]);

        const [sourceSettled, signalAirReports] = await Promise.all([
          Promise.allSettled(sourcePromises),
          signalAirPromise,
        ]);

        const isStale = context.blocking
          ? requestId !== blockingIdRef.current
          : requestId !== prefetchIdRef.current;
        if (isStale) return;

        const series = sourceSettled.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        );
        const failures = sourceSettled.filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        );

        if (failures.length > 0) {
          console.warn(
            '[SNAPSHOT] Une ou plusieurs sources ont échoué:',
            failures.map((failure) => failure.reason)
          );
        }

        if (
          series.length === 0 &&
          failures.length > 0 &&
          !context.signalAirEnabled
        ) {
          const firstError = failures[0].reason;
          if (context.blocking) {
            cacheRef.current = null;
            setCache(null);
            setLoading(false);
            setError(
              firstError instanceof Error
                ? firstError.message
                : 'Erreur lors du chargement du créneau'
            );
          }
          return;
        }

        const nextCache: SnapshotBufferCache = {
          ...window,
          pollutant: context.pollutant,
          timeStep: context.timeStep,
          sourcesKey: context.sourcesKey,
          typesKey: context.typesKey,
          signalAirEnabled: context.signalAirEnabled,
          points: mergeTemporalDataPoints(series),
          reports: signalAirReports,
        };

        if (context.blocking) {
          pendingCacheRef.current = null;
          applyCache(nextCache);
        } else {
          pendingCacheRef.current = nextCache;
          const currentInstant = instantRef.current;
          const active = cacheRef.current;
          const leftActive =
            !currentInstant ||
            !active ||
            !isInstantInBuffer(currentInstant, active, context.timeStep);
          if (
            currentInstant &&
            leftActive &&
            isInstantInBuffer(currentInstant, nextCache, context.timeStep)
          ) {
            applyCache(nextCache);
            pendingCacheRef.current = null;
          }
        }
        setError(null);
      } catch (err) {
        const isStale = context.blocking
          ? requestId !== blockingIdRef.current
          : requestId !== prefetchIdRef.current;
        if (isStale) return;
        console.error('❌ [SNAPSHOT] Erreur fetch mesures:', err);
        if (context.blocking) {
          cacheRef.current = null;
          setCache(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Erreur lors du chargement du créneau'
          );
        }
      } finally {
        if (context.blocking && requestId === blockingIdRef.current) {
          setLoading(false);
        }
        if (!context.blocking && requestId === prefetchIdRef.current) {
          prefetchInFlightRef.current = false;
        }
      }
    },
    [applyCache]
  );

  const fetchBufferWindowRef = useRef(fetchBufferWindow);
  fetchBufferWindowRef.current = fetchBufferWindow;

  useEffect(() => {
    if (!enabled || !instant) {
      blockingIdRef.current += 1;
      prefetchIdRef.current += 1;
      prefetchInFlightRef.current = false;
      cacheRef.current = null;
      pendingCacheRef.current = null;
      setCache(null);
      setLoading(false);
      setError(null);
      return;
    }

    const temporalSources = resolveSnapshotTemporalSources(selectedSources);
    if (temporalSources.length === 0 && !signalAirEnabled) {
      blockingIdRef.current += 1;
      prefetchIdRef.current += 1;
      prefetchInFlightRef.current = false;
      cacheRef.current = null;
      pendingCacheRef.current = null;
      setCache(null);
      setLoading(false);
      setError(null);
      return;
    }

    const desired = buildSnapshotBufferWindow(instant, timeStep);
    const current = cacheRef.current;
    const identityOk = identityMatchesCache(
      current,
      pollutant,
      timeStep,
      sourcesKey,
      typesKey,
      signalAirEnabled
    );
    const inBuffer =
      identityOk && isInstantInBuffer(instant, current, timeStep);
    const desiredKey = windowKeyFor(
      desired,
      pollutant,
      timeStep,
      sourcesKey,
      typesKey,
      signalAirEnabled
    );
    const cachedKey = identityOk
      ? windowKeyFor(
          current,
          pollutant,
          timeStep,
          sourcesKey,
          typesKey,
          signalAirEnabled
        )
      : '';

    const fetchContext = {
      pollutant,
      timeStep,
      sourcesKey,
      typesKey,
      signalAirEnabled,
      selectedSources,
      signalAirSelectedTypes,
    };

    if (inBuffer) {
      setLoading(false);
      const pending = pendingCacheRef.current;
      const pendingReady =
        pending &&
        identityMatchesCache(
          pending,
          pollutant,
          timeStep,
          sourcesKey,
          typesKey,
          signalAirEnabled
        ) &&
        windowKeyFor(
          pending,
          pollutant,
          timeStep,
          sourcesKey,
          typesKey,
          signalAirEnabled
        ) === desiredKey;
      const nearEdge = shouldPrefetchBuffer(instant, current, timeStep);
      const shouldPrefetch =
        nearEdge &&
        desiredKey !== cachedKey &&
        !pendingReady &&
        !prefetchInFlightRef.current;

      if (!shouldPrefetch) return;

      const timer = window.setTimeout(() => {
        if (prefetchInFlightRef.current) return;
        void fetchBufferWindowRef.current(desired, {
          ...fetchContext,
          blocking: false,
        });
      }, NETWORK_DEBOUNCE_MS);

      return () => {
        window.clearTimeout(timer);
      };
    }

    const pending = pendingCacheRef.current;
    if (
      pending &&
      identityMatchesCache(
        pending,
        pollutant,
        timeStep,
        sourcesKey,
        typesKey,
        signalAirEnabled
      ) &&
      isInstantInBuffer(instant, pending, timeStep)
    ) {
      applyCache(pending);
      pendingCacheRef.current = null;
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void fetchBufferWindowRef.current(desired, {
        ...fetchContext,
        blocking: true,
      });
    }, NETWORK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
    // selectedSources / types capturés via clés stables
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clés stables
  }, [
    enabled,
    instantDate,
    instantHour,
    instantMinute,
    timeStep,
    pollutant,
    sourcesKey,
    signalAirEnabled,
    typesKey,
  ]);

  const devices = useMemo(() => {
    if (!instant) return [];
    if (
      !identityMatchesCache(
        cache,
        pollutant,
        timeStep,
        sourcesKey,
        typesKey,
        signalAirEnabled
      )
    ) {
      return [];
    }
    if (!isInstantInBuffer(instant, cache, timeStep)) return [];
    const { targetMs } = buildSlotFetchWindow(instant, timeStep);
    return pickClosestTemporalPoint(cache.points, targetMs)?.devices ?? [];
  }, [
    cache,
    instant,
    pollutant,
    timeStep,
    sourcesKey,
    typesKey,
    signalAirEnabled,
  ]);

  const reports = useMemo(() => {
    if (!instant) return [];
    if (
      !identityMatchesCache(
        cache,
        pollutant,
        timeStep,
        sourcesKey,
        typesKey,
        signalAirEnabled
      )
    ) {
      return [];
    }
    if (!isInstantInBuffer(instant, cache, timeStep)) return [];
    return filterReportsByDisplayWindow(
      cache.reports,
      instantToIsoLocal(instant),
      timeStep
    );
  }, [
    cache,
    instant,
    pollutant,
    timeStep,
    sourcesKey,
    typesKey,
    signalAirEnabled,
  ]);

  return { devices, reports, loading, error };
};
