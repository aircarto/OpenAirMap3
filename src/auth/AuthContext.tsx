'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from 'oidc-client-ts';
import { isKeycloakAuthEnabled } from './keycloakConfig';
import { getUserManager } from './oidcClient';
import { getAccessToken, setAccessToken } from './tokenStore';
import { AtmoMicroV2Service } from '../services/AtmoMicroV2Service';

export type AuthUserInfo = {
  sub?: string;
  email?: string;
  preferredUsername?: string;
  name?: string;
};

type AuthContextValue = {
  enabled: boolean;
  ready: boolean;
  isAuthenticated: boolean;
  user: AuthUserInfo | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const toUserInfo = (user: User | null): AuthUserInfo | null => {
  if (!user?.profile) return null;
  const profile = user.profile;
  return {
    sub: typeof profile.sub === 'string' ? profile.sub : undefined,
    email: typeof profile.email === 'string' ? profile.email : undefined,
    preferredUsername:
      typeof profile.preferred_username === 'string'
        ? profile.preferred_username
        : undefined,
    name: typeof profile.name === 'string' ? profile.name : undefined,
  };
};

const syncTokenFromUser = (user: User | null): void => {
  const expired = user?.expired ?? true;
  const token = !expired && user?.access_token ? user.access_token : null;
  const previous = getAccessToken();
  setAccessToken(token);
  // Invalide les caches microspot seulement si le Bearer change.
  if (previous !== token) {
    AtmoMicroV2Service.resetCaches();
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const enabled = isKeycloakAuthEnabled();
  const [ready, setReady] = useState(!enabled);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAccessToken(null);
      setUser(null);
      setReady(true);
      return;
    }

    const manager = getUserManager();
    if (!manager) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const applyUser = (next: User | null) => {
      if (cancelled) return;
      setUser(next);
      syncTokenFromUser(next);
    };

    const bootstrap = async () => {
      try {
        const current = await manager.getUser();
        applyUser(current);
      } catch (error) {
        console.warn('[auth] Impossible de restaurer la session Keycloak', error);
        applyUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void bootstrap();

    const onLoaded = (u: User) => applyUser(u);
    const onUnloaded = () => applyUser(null);
    const onRenewed = (u: User) => applyUser(u);
    const onSilentRenewError = (error: Error) => {
      console.warn('[auth] Échec du renew silencieux Keycloak', error);
      applyUser(null);
    };

    manager.events.addUserLoaded(onLoaded);
    manager.events.addUserUnloaded(onUnloaded);
    manager.events.addUserSignedOut(onUnloaded);
    manager.events.addAccessTokenExpiring(() => {
      void manager.signinSilent().catch((error) => {
        console.warn('[auth] signinSilent a échoué', error);
      });
    });
    manager.events.addAccessTokenExpired(onUnloaded);
    manager.events.addSilentRenewError(onSilentRenewError);

    return () => {
      cancelled = true;
      manager.events.removeUserLoaded(onLoaded);
      manager.events.removeUserUnloaded(onUnloaded);
      manager.events.removeUserSignedOut(onUnloaded);
      manager.events.removeSilentRenewError(onSilentRenewError);
    };
  }, [enabled]);

  const login = useCallback(async () => {
    const manager = getUserManager();
    if (!manager) {
      throw new Error('Keycloak non configuré');
    }
    await manager.signinRedirect({
      state: { returnTo: window.location.href },
    });
  }, []);

  const logout = useCallback(async () => {
    const manager = getUserManager();
    if (!manager) {
      setAccessToken(null);
      setUser(null);
      return;
    }
    try {
      await manager.signoutRedirect();
    } catch (error) {
      console.warn('[auth] Logout Keycloak échoué, nettoyage local', error);
      await manager.removeUser();
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled,
      ready,
      isAuthenticated: Boolean(user && !user.expired && user.access_token),
      user: toUserInfo(user),
      login,
      logout,
    }),
    [enabled, ready, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return ctx;
};
