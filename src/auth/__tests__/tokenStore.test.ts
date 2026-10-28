import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAccessToken,
  setAccessToken,
  isAuthenticated,
  subscribeAccessToken,
} from '../tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('stocke et lit le Bearer', () => {
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);

    setAccessToken('jwt-test');
    expect(getAccessToken()).toBe('jwt-test');
    expect(isAuthenticated()).toBe(true);
  });

  it('notifie les abonnés uniquement si le token change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessToken(listener);

    setAccessToken('a');
    setAccessToken('a');
    setAccessToken('b');
    unsubscribe();
    setAccessToken('c');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, 'a');
    expect(listener).toHaveBeenNthCalledWith(2, 'b');
  });
});
