'use client';

import dynamic from 'next/dynamic';
import { featureFlags } from '@/config/featureFlags';

const loadMapApp = () =>
  import('@/App').catch((error: unknown) => {
    // Après rebuild / cache webpack corrompu, le navigateur garde une URL de chunk
    // obsolète. Un seul reload récupère le nouveau manifest.
    if (
      typeof window !== 'undefined' &&
      error instanceof Error &&
      (error.name === 'ChunkLoadError' || /Loading chunk .* failed/i.test(error.message))
    ) {
      const key = 'oam-chunk-reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {
          /* navigation en cours */
        });
      }
      sessionStorage.removeItem(key);
    }
    throw error;
  });

const MapApp = dynamic(loadMapApp, {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-600">
      Chargement de la carte…
    </div>
  ),
});

const MaintenancePage = dynamic(() => import('@/components/MaintenancePage'), {
  ssr: false,
});

/**
 * Point d'entrée client de la carte (Leaflet / MapLibre / amCharts).
 * SSR désactivé pour éviter window/document au rendu serveur.
 */
export default function MapAppEntry() {
  if (featureFlags.maintenanceMode) {
    return <MaintenancePage />;
  }
  return <MapApp />;
}
