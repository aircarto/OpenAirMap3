import { useEffect, useState } from 'react';
import {
  fetchAirCrowdWmsAvailability,
  type AirCrowdWmsAvailability,
} from '../services/AirCrowdWmsLayerService';

export const useAirCrowdWmsAvailability = (enabled: boolean) => {
  const [availability, setAvailability] =
    useState<AirCrowdWmsAvailability | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    fetchAirCrowdWmsAvailability()
      .then((result) => {
        if (cancelled) return;
        setAvailability(result);
        setError(false);
      })
      .catch((fetchError) => {
        console.warn('[AIRCROWD WMS] GetCapabilities indisponible:', fetchError);
        if (cancelled) return;
        setAvailability(null);
        setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { availability, error };
};
