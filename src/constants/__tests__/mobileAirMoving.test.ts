import { describe, it, expect } from 'vitest';
import {
  isFixedMobileAirSession,
  resolveSessionMoving,
  mobileAirMovingI18nKey,
} from '../../constants/mobileAirMoving';

describe('mobileAirMoving', () => {
  it('détecte la mesure fixe (moving=4)', () => {
    expect(isFixedMobileAirSession(4)).toBe(true);
    expect(isFixedMobileAirSession(0)).toBe(false);
    expect(isFixedMobileAirSession(null)).toBe(false);
    expect(isFixedMobileAirSession(undefined)).toBe(false);
  });

  it('résout le mode session depuis le premier point non-null', () => {
    expect(
      resolveSessionMoving([{ moving: null }, { moving: 1 }, { moving: 1 }])
    ).toBe(1);
    expect(resolveSessionMoving([{ moving: null }, { moving: null }])).toBe(
      null
    );
    expect(resolveSessionMoving([{ moving: 4 }])).toBe(4);
  });

  it('fournit une clé i18n par mode', () => {
    expect(mobileAirMovingI18nKey(0)).toBe('mobileAir.moving.walk');
    expect(mobileAirMovingI18nKey(4)).toBe('mobileAir.moving.fixed');
    expect(mobileAirMovingI18nKey(null)).toBe('mobileAir.moving.unknown');
  });
});
