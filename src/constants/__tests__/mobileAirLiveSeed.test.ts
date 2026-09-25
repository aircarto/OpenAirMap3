import { describe, it, expect } from 'vitest';
import {
  seedSessionKeysForTest,
} from './mobileAirSeedTestHelpers';

// Helper extrait pour tester le seed préféré sans monter le hook
describe('seed session préférée (live click)', () => {
  it('privilégie la session du point live', () => {
    const routes = [
      {
        sensorId: 'mobileair-032',
        sessionId: 10,
        startTime: '2026-09-24T08:00:00Z',
        endTime: '2026-09-24T09:00:00Z',
      },
      {
        sensorId: 'mobileair-032',
        sessionId: 20,
        startTime: '2026-09-24T12:00:00Z',
        endTime: '2026-09-24T13:00:00Z',
      },
    ];
    // Sans préférence → la plus récente (20)
    expect(
      [...seedSessionKeysForTest(routes, {})]
    ).toEqual(['mobileair-032-20']);
    // Avec préférence → session 10
    expect(
      [...seedSessionKeysForTest(routes, { 'mobileair-032': 10 })]
    ).toEqual(['mobileair-032-10']);
  });
});
