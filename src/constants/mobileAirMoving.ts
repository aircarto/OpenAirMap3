import type { MobileAirMovingMode } from '../types';

/** Code 4 = mesure fixe (un seul point carte, pas de polyline). */
export const MOBILE_AIR_MOVING_FIXED: MobileAirMovingMode = 4;

export const MOBILE_AIR_MOVING_MODES: readonly MobileAirMovingMode[] = [
  0, 1, 2, 3, 4,
] as const;

export const isFixedMobileAirSession = (
  moving: MobileAirMovingMode | null | undefined
): boolean => moving === MOBILE_AIR_MOVING_FIXED;

/** Clé i18n pour un mode (ex. `mobileAir.moving.walk`). */
export const mobileAirMovingI18nKey = (
  moving: MobileAirMovingMode | null | undefined
): string => {
  switch (moving) {
    case 0:
      return 'mobileAir.moving.walk';
    case 1:
      return 'mobileAir.moving.bike';
    case 2:
      return 'mobileAir.moving.car';
    case 3:
      return 'mobileAir.moving.transit';
    case 4:
      return 'mobileAir.moving.fixed';
    default:
      return 'mobileAir.moving.unknown';
  }
};

/**
 * Mode de la session : premier point non-null, sinon null (anciens relevés).
 */
export const resolveSessionMoving = (
  points: Array<{ moving?: MobileAirMovingMode | null }>
): MobileAirMovingMode | null => {
  for (const point of points) {
    if (point.moving === 0 || point.moving === 1 || point.moving === 2
      || point.moving === 3 || point.moving === 4) {
      return point.moving;
    }
  }
  return null;
};
