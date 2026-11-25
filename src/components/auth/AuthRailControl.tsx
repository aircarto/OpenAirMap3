'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import RailItem from '../map/rail/RailItem';
import { IconUser } from '../map/rail/railIcons';
import type { RailOrientation } from '../map/rail/useRailRoving';
import {
  RAIL_FLYOUT_CLASS,
  RAIL_FLYOUT_SIDE_OFFSET,
  railFlyoutSide,
} from '../map/rail/railFlyout';

export interface AuthRailControlProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Contrôle rail : connexion Keycloak optionnelle.
 * Masqué si Keycloak n'est pas activé via les variables d'environnement.
 */
export const AuthRailControl: React.FC<AuthRailControlProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { t } = useTranslation();
  const { enabled, ready, isAuthenticated, user, login, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!enabled) {
    return null;
  }

  const displayName =
    user?.preferredUsername || user?.name || user?.email || t('auth.signedIn');

  const handleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await login();
    } catch (error) {
      console.error('[auth] login', error);
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await logout();
    } catch (error) {
      console.error('[auth] logout', error);
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <RailItem
        itemId="auth"
        data-testid="rail-auth-loading"
        aria-label={t('auth.loading')}
        title={t('auth.loading')}
        onFocus={onItemFocus}
        label={t('auth.loading')}
        icon={<IconUser />}
        caption="…"
        disabled
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <RailItem
        itemId="auth"
        data-testid="rail-auth-login"
        aria-label={t('auth.login')}
        title={t('auth.loginHint')}
        onClick={() => {
          void handleLogin();
        }}
        onFocus={onItemFocus}
        label={t('auth.login')}
        icon={<IconUser />}
        caption={busy ? '…' : t('auth.loginCaption')}
        disabled={busy}
      />
    );
  }

  const side = railFlyoutSide(orientation);

  return (
    <div className="relative">
      <RailItem
        itemId="auth"
        data-testid="rail-auth-user"
        aria-label={t('auth.account', { name: displayName })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={displayName}
        onClick={() => setMenuOpen((open) => !open)}
        onFocus={onItemFocus}
        label={t('auth.account', { name: displayName })}
        icon={<IconUser />}
        caption={t('auth.signedInCaption')}
      />
      {menuOpen ? (
        <div
          role="menu"
          className={`${RAIL_FLYOUT_CLASS} absolute z-[2100] min-w-[12rem] p-2`}
          style={
            side === 'right'
              ? { left: '100%', marginLeft: RAIL_FLYOUT_SIDE_OFFSET, bottom: 0 }
              : { bottom: '100%', marginBottom: RAIL_FLYOUT_SIDE_OFFSET, left: 0 }
          }
        >
          <p className="truncate px-2 py-1 text-xs text-slate-500" title={displayName}>
            {displayName}
          </p>
          <p className="px-2 pb-2 text-[11px] text-slate-400">{t('auth.privilegedHint')}</p>
          <button
            type="button"
            role="menuitem"
            data-testid="rail-auth-logout"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
            disabled={busy}
            onClick={() => {
              void handleLogout();
            }}
          >
            {t('auth.logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default AuthRailControl;
