'use client';

import { useEffect, useState } from 'react';
import { getUserManager } from '@/auth/oidcClient';
import { setAccessToken } from '@/auth/tokenStore';
import { isKeycloakAuthEnabled } from '@/auth/keycloakConfig';

/**
 * Callback OIDC Authorization Code + PKCE.
 *
 * Hors préfixe de locale (comme /aircarto) pour une redirect_uri Keycloak stable.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isKeycloakAuthEnabled()) {
      window.location.replace('/');
      return;
    }

    const manager = getUserManager();
    if (!manager) {
      setError('Keycloak non configuré');
      return;
    }

    let cancelled = false;

    const finish = async () => {
      try {
        const user = await manager.signinRedirectCallback();
        if (cancelled) return;
        setAccessToken(user.access_token ?? null);

        const state = user.state as { returnTo?: string } | undefined;
        const returnTo =
          typeof state?.returnTo === 'string' && state.returnTo.startsWith(window.location.origin)
            ? state.returnTo
            : '/';
        window.location.replace(returnTo);
      } catch (err) {
        console.error('[auth] Callback Keycloak échoué', err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Échec de la connexion Keycloak'
          );
        }
      }
    };

    void finish();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-slate-800">
        <h1 className="text-lg font-semibold">Connexion impossible</h1>
        <p className="max-w-md text-center text-sm text-slate-600">{error}</p>
        <a
          href="/"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          Retour à la carte
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      Connexion en cours…
    </main>
  );
}
