'use client';

import dynamic from 'next/dynamic';
import { AuthProvider } from '../../auth/AuthContext';

/**
 * Point d'entrée client de la page Campagnes.
 *
 * Le gate (et tout ce qui utilise react-i18next) est rendu côté client seulement :
 * i18next n'est initialisé que dans le navigateur (I18nLocaleSync), et un
 * useTranslation au rendu serveur suspend sans fin — la requête ne répond jamais.
 */
const CampaignsGate = dynamic(() => import('./CampaignsGate'), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">…</main>
  ),
});

export default function CampaignsAppEntry() {
  return (
    <AuthProvider>
      <CampaignsGate />
    </AuthProvider>
  );
}
