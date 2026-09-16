'use client';

import dynamic from 'next/dynamic';
import { featureFlags } from '@/config/featureFlags';

const MapApp = dynamic(() => import('@/App'), {
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
