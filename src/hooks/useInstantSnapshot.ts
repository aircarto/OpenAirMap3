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
  buildAdjacentSnapshotBufferWindow,
  buildSlotFetchWindow,
  buildSnapshotBufferWindow,
  getPrefetchEdgeDirection,
  instantToIsoLocal,
  isInstantInBuffer,
  snapshotBufferKey,
  type MapInstant,
  type SnapshotBufferWindow,
  type TimeBarCustomRange,
} from '../utils/mapInstant';
import {
  devicesForSlotWindow,
  isHttpNotFound,
  mergeTemporalDataPoints,
  resolveSnapshotTemporalSources,
} from '../utils/instantSnapshot';
import { filterReportsByDisplayWindow } from '../utils/signalAirDateUtils';
import {
  chunkDatePeriod,
  mergeSignalAirReportsById,
} from '../utils/signalAirChunks';

const NETWORK_DEBOUNCE_MS = 300;

export interface UseInstantSnapshotProps {
  enabled: boolean;
  instant: MapInstant | null;
  timeStep: string;
  pollutant: string;
  selectedSources: string[];
  signalAirEnabled?: boolean;
  signalAirSelectedTypes?: string[];
  /** Plage navigable (custom) : borne le prefetch adjacent. */
  navigableRange?: TimeBarCustomRange | null;
  /**
   * Lecture auto TimeBar : prefetch vers le futur dès 25 % du buffer,
   * et `loading` reste false pour l’UI (le tick attend via un flag interne).
   */
  playbackActive?: boolean;
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

const typesCoveredByCache = (
  cacheTypesKey: string,
  selectedTypes: string[],
  signalAirEnabled: boolean
): boolean => {
  if (!signalAirEnabled) return true;
  if (selectedTypes.length === 0) return true;
  const cached = new Set(cacheTypesKey.split(',').filter(Boolean));
  return selectedTypes.every((type) => cached.has(type));
};

const identityMatchesCache = (
  cache: SnapshotBufferCache | null,
  pollutant: string,
  timeStep: string,
  sourcesKey: string,
  selectedTypes: string[],
  signalAirEnabled: boolean
): cache is SnapshotBufferCache =>
  Boolean(
    cache &&
      cache.pollutant === pollutant &&
      cache.timeStep === timeStep &&
      cache.sourcesKey === sourcesKey &&
      cache.signalAirEnabled === signalAirEnabled &&
      typesCoveredByCache(cache.typesKey, selectedTypes, signalAirEnabled)
  );

const windowKeyFor = (
  buffer: Pick<SnapshotBufferWindow, 'startDate' | 'endDate'>,
  pollutant: string,
  timeStep: string,
  sourcesKey: string,
  signalAirEnabled: boolean
): string =>
  `${snapshotBufferKey(buffer, pollutant, timeStep, sourcesKey)}|${signalAirEnabled}`;

/**
 * Snapshot capteurs + SignalAir autour de l’instant TimeBar.
 * Charge un bloc lookback (24 h / 7 j), pick local au slider.
 * Prefetch silencieux aux deux bords (fenêtre adjacente).
 * Types SignalAir : un sous-ensemble des types en cache ne refetch pas ;
 * un type ajouté force un nouveau fetch.
 */
export const useInstantSnapshot = ({
  enabled,
  instant,
  timeStep,
  pollutant,
  selectedSources,
  signalAirEnabled = false,
  signalAirSelectedTypes = [],
  navigableRange = null,
  playbackActive = false,
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
  const navigableRangeRef = useRef(navigableRange);
  navigableRangeRef.current = navigableRange;

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

  const fetchSignalAirChunked = useCallback(
    async (args: {
      pollutant: string;
      timeStep: string;
      startDate: string;
      endDate: string;
      selectedTypes: string[];
      onChunk?: (reports: SignalAirReport[]) => void;
    }): Promise<SignalAirReport[]> => {
      const chunks = chunkDatePeriod({
        startDate: args.startDate,
        endDate: args.endDate,
      });
      const batches: SignalAirReport[][] = [];
      for (const chunk of chunks) {
        try {
          const raw = await signalAirService.current.fetchData({
            pollutant: args.pollutant,
            timeStep: args.timeStep,
            sources: ['signalair'],
            signalAirPeriod: chunk,
            signalAirSelectedTypes: args.selectedTypes,
          });
          const batch = Array.isArray(raw) ? raw : [];
          batches.push(batch);
          args.onChunk?.(mergeSignalAirReportsById(batches));
        } catch (err) {
          console.warn('SignalAir: erreur chunk snapshot:', err);
        }
      }
      return mergeSignalAirReportsById(batches);
    },
    []
  );

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
        // Annule tout prefetch en cours : le miss bloquant prime.
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
            ? fetchSignalAirChunked({
                pollutant: context.pollutant,
                timeStep: context.timeStep,
                startDate: window.startInstant.date,
                endDate: window.endInstant.date,
                selectedTypes: signalAirTypes,
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

        // Données partielles : afficher + message soft.
        if (failures.length > 0 && series.length > 0) {
          setError(
            `${failures.length} source(s) indisponible(s) — données partielles affichées`
          );
        } else {
          setError(null);
        }
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
    [applyCache, fetchSignalAirChunked]
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

    const desired = buildSnapshotBufferWindow(
      instant,
      timeStep,
      new Date(),
      navigableRange
    );
    const current = cacheRef.current;
    const identityOk = identityMatchesCache(
      current,
      pollutant,
      timeStep,
      sourcesKey,
      signalAirSelectedTypes,
      signalAirEnabled
    );
    const inBuffer =
      identityOk && isInstantInBuffer(instant, current, timeStep);

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
      // Pendant le play : prefetch systématique vers le futur (le début
      // de plage ne doit pas déclencher un prefetch « past » inutile).
      const edge = playbackActive
        ? 'future'
        : getPrefetchEdgeDirection(instant, current, timeStep);
      if (!edge || prefetchInFlightRef.current) return;

      const adjacent = buildAdjacentSnapshotBufferWindow(
        current,
        edge,
        timeStep,
        new Date(),
        navigableRangeRef.current
      );
      const adjacentKey = windowKeyFor(
        adjacent,
        pollutant,
        timeStep,
        sourcesKey,
        signalAirEnabled
      );
      const pending = pendingCacheRef.current;
      const pendingReady =
        pending &&
        identityMatchesCache(
          pending,
          pollutant,
          timeStep,
          sourcesKey,
          signalAirSelectedTypes,
          signalAirEnabled
        ) &&
        windowKeyFor(
          pending,
          pollutant,
          timeStep,
          sourcesKey,
          signalAirEnabled
        ) === adjacentKey;
      const sameAsCurrent =
        windowKeyFor(
          current,
          pollutant,
          timeStep,
          sourcesKey,
          signalAirEnabled
        ) === adjacentKey;

      if (pendingReady || sameAsCurrent) return;

      const timer = window.setTimeout(() => {
        if (prefetchInFlightRef.current) return;
        void fetchBufferWindowRef.current(adjacent, {
          ...fetchContext,
          blocking: false,
        });
      }, playbackActive ? 0 : NETWORK_DEBOUNCE_MS);

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
        signalAirSelectedTypes,
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
    }, playbackActive ? 0 : NETWORK_DEBOUNCE_MS);

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
    playbackActive,
    navigableRange?.start.date,
    navigableRange?.start.hour,
    navigableRange?.end.date,
    navigableRange?.end.hour,
  ]);

  const devices = useMemo(() => {
    if (!instant) return [];
    if (
      !identityMatchesCache(
        cache,
        pollutant,
        timeStep,
        sourcesKey,
        signalAirSelectedTypes,
        signalAirEnabled
      )
    ) {
      return [];
    }
    if (!isInstantInBuffer(instant, cache, timeStep)) {
      // Play : garder un frame figé pendant le miss silencieux (évite carte vide).
      if (playbackActive && loading && cache.points.length > 0) {
        return cache.points[cache.points.length - 1].devices;
      }
      return [];
    }
    const { startDate, endDate, targetMs } = buildSlotFetchWindow(
      instant,
      timeStep
    );
    return devicesForSlotWindow(
      cache.points,
      new Date(startDate).getTime(),
      new Date(endDate).getTime(),
      targetMs
    );
  }, [
    cache,
    instant,
    pollutant,
    timeStep,
    sourcesKey,
    signalAirSelectedTypes,
    signalAirEnabled,
    playbackActive,
    loading,
  ]);

  const reports = useMemo(() => {
    if (!instant) return [];
    if (
      !identityMatchesCache(
        cache,
        pollutant,
        timeStep,
        sourcesKey,
        signalAirSelectedTypes,
        signalAirEnabled
      )
    ) {
      return [];
    }
    if (!isInstantInBuffer(instant, cache, timeStep)) return [];
    const selectedSet = new Set(signalAirSelectedTypes);
    const windowFiltered = filterReportsByDisplayWindow(
      cache.reports,
      instantToIsoLocal(instant),
      timeStep
    );
    if (selectedSet.size === 0) return windowFiltered;
    return windowFiltered.filter((report) =>
      selectedSet.has(report.signalType)
    );
  }, [
    cache,
    instant,
    pollutant,
    timeStep,
    sourcesKey,
    signalAirSelectedTypes,
    signalAirEnabled,
  ]);

  return { devices, reports, loading, error };
};
