/** Événement navigateur : session Keycloak changée (login / logout / expire). */
export const OAM_AUTH_CHANGED_EVENT = 'oam-auth-changed';

export const dispatchAuthChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OAM_AUTH_CHANGED_EVENT));
};
