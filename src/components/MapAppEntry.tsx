'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
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

const mapLoading = (
  <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-600">
    Chargement de la carte…
  </div>
);

/**
 * Attend la restauration sessionStorage Keycloak avant de monter la carte,
 * sinon le premier fetch microspot part sans Bearer (params privilégiés → 401).
 */
const AuthReadyGate = ({ children }: { children: ReactNode }) => {
  const { enabled, ready } = useAuth();
  if (enabled && !ready) {
    return mapLoading;
  }
  return children;
};

/**
 * Point d'entrée client de la carte (Leaflet / MapLibre / amCharts).
 * SSR désactivé pour éviter window/document au rendu serveur.
 */
export default function MapAppEntry() {
  if (featureFlags.maintenanceMode) {
    return <MaintenancePage />;
  }
  return (
    <AuthProvider>
      <AuthReadyGate>
        <MapApp />
      </AuthReadyGate>
    </AuthProvider>
  );
}
