'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { Link } from '../../i18n/navigation';

const CampaignsPage = dynamic(() => import('./CampaignsPage'), {
  ssr: false,
  loading: () => <CenteredMessage>…</CenteredMessage>,
});

const CenteredMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center text-slate-700">
    {children}
  </main>
);

/**
 * Réservée aux utilisateurs connectés : sans session, écran de connexion.
 * Le retour après Keycloak ramène ici (state.returnTo dans AuthContext.login).
 */
export const CampaignsGate: React.FC = () => {
  const { t } = useTranslation();
  const { enabled, ready, isAuthenticated, login } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!enabled) {
    return (
      <CenteredMessage>
        <h1 className="text-lg font-semibold text-[#1f3c6d]">{t('campaigns.title')}</h1>
        <p className="max-w-md text-sm">{t('campaigns.authDisabled')}</p>
        <Link href="/" className="text-sm font-medium text-[#1f3c6d] hover:underline">
          ← {t('campaigns.backToMap')}
        </Link>
      </CenteredMessage>
    );
  }

  if (!ready) {
    return <CenteredMessage>{t('auth.loading')}</CenteredMessage>;
  }

  if (!isAuthenticated) {
    return (
      <CenteredMessage>
        <h1 className="text-lg font-semibold text-[#1f3c6d]">{t('campaigns.title')}</h1>
        <p className="max-w-md text-sm" data-testid="campaigns-login-required">
          {t('campaigns.loginRequired')}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            login().catch((error) => {
              console.error('[auth] login', error);
              setBusy(false);
            });
          }}
          className="rounded-md bg-[#1f3c6d] px-4 py-2 text-sm font-medium text-white hover:bg-[#183055] disabled:opacity-50"
          data-testid="campaigns-login"
        >
          {t('auth.login')}
        </button>
        <Link href="/" className="text-sm font-medium text-[#1f3c6d] hover:underline">
          ← {t('campaigns.backToMap')}
        </Link>
      </CenteredMessage>
    );
  }

  return <CampaignsPage />;
};

export default CampaignsGate;
