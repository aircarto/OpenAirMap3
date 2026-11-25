import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  planChunks,
  runExtraction,
  type ExtractionFailure,
  type ExtractionProgress,
  type ExtractionRequest,
} from '../../services/microspot/campaignExtraction';
import { CampaignDataStore } from '../../services/microspot/campaignDataStore';
import {
  buildCampaignCsvBlob,
  campaignCsvFilename,
  type CampaignCsvContext,
} from '../../services/microspot/campaignCsv';
import { MicrospotAuthError } from '../../services/microspot/MicrospotCampaignClient';

export type ExtractionStatus = 'idle' | 'running' | 'done' | 'aborted' | 'error';

export interface ExtractionState {
  status: ExtractionStatus;
  progress: ExtractionProgress | null;
  failures: ExtractionFailure[];
  error: string | null;
  authError: boolean;
  /** Incrémenté à chaque mise à jour du store : déclenche le recalcul des vues. */
  version: number;
  request: ExtractionRequest | null;
  startedAt: number | null;
  finishedAt: number | null;
}

const INITIAL: ExtractionState = {
  status: 'idle',
  progress: null,
  failures: [],
  error: null,
  authError: false,
  version: 0,
  request: null,
  startedAt: null,
  finishedAt: null,
};

/** Throttle des mises à jour React de la progression (centaines de requêtes). */
const PROGRESS_THROTTLE_MS = 200;

export function useCampaignExtraction() {
  const [state, setState] = useState<ExtractionState>(INITIAL);
  const [exporting, setExporting] = useState<{ written: number; total: number } | null>(null);
  const storeRef = useRef<CampaignDataStore | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const execute = useCallback(
    async (request: ExtractionRequest, chunks: ReturnType<typeof planChunks>, store: CampaignDataStore) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      storeRef.current = store;

      setState((s) => ({
        ...s,
        status: 'running',
        error: null,
        authError: false,
        request,
        startedAt: Date.now(),
        finishedAt: null,
        progress: { done: 0, total: chunks.length, rows: store.rowCount, failed: 0 },
      }));

      let lastEmit = 0;
      try {
        const result = await runExtraction(request, chunks, {
          store,
          signal: controller.signal,
          onProgress: (progress) => {
            const now = Date.now();
            if (now - lastEmit < PROGRESS_THROTTLE_MS && progress.done < progress.total) return;
            lastEmit = now;
            setState((s) => ({ ...s, progress }));
          },
        });
        if (abortRef.current !== controller) return; // remplacée par une autre extraction
        setState((s) => ({
          ...s,
          status: result.aborted ? 'aborted' : 'done',
          failures: result.failures,
          version: s.version + 1,
          finishedAt: Date.now(),
          progress: s.progress && {
            ...s.progress,
            rows: store.rowCount,
            failed: result.failures.length,
          },
        }));
      } catch (error) {
        if (abortRef.current !== controller) return;
        setState((s) => ({
          ...s,
          status: 'error',
          authError: error instanceof MicrospotAuthError,
          error: error instanceof Error ? error.message : String(error),
          version: s.version + 1,
          finishedAt: Date.now(),
        }));
      }
    },
    []
  );

  const start = useCallback(
    (request: ExtractionRequest) => {
      setState((s) => ({ ...INITIAL, version: s.version + 1 }));
      void execute(request, planChunks(request), new CampaignDataStore());
    },
    [execute]
  );

  /** Relance uniquement les tranches en échec, en complétant le store courant. */
  const retryFailures = useCallback(() => {
    const store = storeRef.current;
    if (!store || !state.request || state.failures.length === 0) return;
    const chunks = state.failures.map((f) => f.chunk);
    setState((s) => ({ ...s, failures: [] }));
    void execute(state.request, chunks, store);
  }, [execute, state.request, state.failures]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    storeRef.current = null;
    setState((s) => ({ ...INITIAL, version: s.version + 1 }));
  }, []);

  const exportCsv = useCallback(
    async (context: CampaignCsvContext) => {
      const store = storeRef.current;
      const request = state.request;
      if (!store || !request) return;
      setExporting({ written: 0, total: 0 });
      try {
        const blob = await buildCampaignCsvBlob(store, context, (written, total) =>
          setExporting({ written, total })
        );
        saveAs(blob, campaignCsvFilename(context.campaignId, context.campaignName, request.from, request.to));
      } finally {
        setExporting(null);
      }
    },
    [state.request]
  );

  return {
    state,
    store: storeRef.current,
    exporting,
    start,
    cancel,
    reset,
    retryFailures,
    exportCsv,
  };
}
