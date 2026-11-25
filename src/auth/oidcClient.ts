import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';
import {
  getKeycloakAuthority,
  getKeycloakClientId,
  getOidcPostLogoutRedirectUri,
  getOidcRedirectUri,
  isKeycloakAuthEnabled,
} from './keycloakConfig';

let userManager: UserManager | null = null;

/**
 * Singleton UserManager (navigateur uniquement).
 * Null si Keycloak n'est pas configuré.
 */
export const getUserManager = (): UserManager | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!isKeycloakAuthEnabled()) {
    return null;
  }

  if (userManager) {
    return userManager;
  }

  const authority = getKeycloakAuthority();
  const clientId = getKeycloakClientId();
  if (!authority || !clientId) {
    return null;
  }

  userManager = new UserManager({
    authority,
    client_id: clientId,
    redirect_uri: getOidcRedirectUri(),
    post_logout_redirect_uri: getOidcPostLogoutRedirectUri(),
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
    monitorSession: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });

  return userManager;
};

/** Remet le singleton à null (tests). */
export const resetUserManagerForTests = (): void => {
  userManager = null;
};

export type { User };
