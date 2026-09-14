import { useCallback, useState } from 'react';
import type { MapInstant, MapInstantMode } from '../utils/mapInstant';

export interface UseMapInstantResult {
  mode: MapInstantMode;
  instant: MapInstant | null;
  isExploration: boolean;
  goLive: () => void;
  seekTo: (next: MapInstant) => void;
}

/**
 * Source de vérité unique pour l’instant affiché sur la carte.
 * `instant === null` signifie Live (heure courante / défaut Azur).
 */
export const useMapInstant = (): UseMapInstantResult => {
  const [mode, setMode] = useState<MapInstantMode>('live');
  const [instant, setInstant] = useState<MapInstant | null>(null);

  const goLive = useCallback(() => {
    setMode('live');
    setInstant(null);
  }, []);

  const seekTo = useCallback((next: MapInstant) => {
    setInstant({ date: next.date, hour: next.hour });
    setMode('exploration');
  }, []);

  return {
    mode,
    instant,
    isExploration: mode === 'exploration',
    goLive,
    seekTo,
  };
};
