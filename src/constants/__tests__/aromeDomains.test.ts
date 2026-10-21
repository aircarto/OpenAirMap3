import { describe, expect, it } from 'vitest';
import { mapInstantToAromeUtc } from '../aromeDomains';

describe('mapInstantToAromeUtc', () => {
  it('convertit une heure locale Europe/Paris (été) vers UTC', () => {
    // Suppose un navigateur en fuseau avec offset d'été (CEST = UTC+2).
    // On fixe via construction Date locale : 2026-07-15 14:00 local.
    const utc = mapInstantToAromeUtc({
      date: '2026-07-15',
      hour: 14,
      minute: 0,
    });
    const local = new Date(2026, 6, 15, 14, 0, 0, 0);
    expect(utc.date).toBe(
      `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`
    );
    expect(utc.hour).toBe(local.getUTCHours());
  });

  it('gère le passage de minuit (jour UTC éventuellement la veille)', () => {
    const utc = mapInstantToAromeUtc({ date: '2026-01-15', hour: 0, minute: 0 });
    const local = new Date(2026, 0, 15, 0, 0, 0, 0);
    expect(utc.hour).toBe(local.getUTCHours());
    expect(utc.date).toBe(
      `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`
    );
  });
});
