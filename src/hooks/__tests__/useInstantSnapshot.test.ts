import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInstantSnapshot } from '../useInstantSnapshot';
import { DataServiceFactory } from '../../services/DataServiceFactory';
import {
  addMinutesToInstant,
  buildSnapshotBufferWindow,
  lastCompletedSlotInstant,
  type MapInstant,
} from '../../utils/mapInstant';
import type { TemporalDataPoint } from '../../types';

vi.mock('../../services/DataServiceFactory', () => ({
  DataServiceFactory: {
    getService: vi.fn(),
  },
}));

const now = new Date(2026, 8, 14, 11, 40, 0, 0);

const deviceFor = (id: string, timestamp: string): TemporalDataPoint => ({
  timestamp,
  devices: [
    {
      id,
      name: id,
      latitude: 43.3,
      longitude: 5.4,
      source: 'atmoRef',
      pollutant: 'pm25',
      value: 12,
      unit: 'µg/m³',
      timestamp,
      status: 'active',
      qualityLevel: 'bon',
    },
  ],
  deviceCount: 1,
  averageValue: 12,
  qualityLevels: { bon: 1 },
});

describe('useInstantSnapshot', () => {
  const fetchTemporalData = vi.fn();

  beforeEach(() => {
    fetchTemporalData.mockReset();
    vi.mocked(DataServiceFactory.getService).mockImplementation(
      (code: string) => {
        if (code === 'signalair') {
          return { fetchData: vi.fn().mockResolvedValue([]) };
        }
        return { fetchTemporalData };
      }
    );
  });

  it('garde le cache affiché pendant le prefetch, puis bascule au pending hors bloc', async () => {
    vi.useFakeTimers({ now });
    const live = lastCompletedSlotInstant('heure', now);
    const firstWindow = buildSnapshotBufferWindow(live, 'heure', now);

    fetchTemporalData.mockImplementation(
      async (params: { startDate: string }) => [
        deviceFor(
          params.startDate === firstWindow.startDate ? 'first' : 'next',
          params.startDate
        ),
      ]
    );

    const { result, rerender } = renderHook(
      (props: { instant: MapInstant }) =>
        useInstantSnapshot({
          enabled: true,
          instant: props.instant,
          timeStep: 'heure',
          pollutant: 'pm25',
          selectedSources: ['atmoRef'],
        }),
      { initialProps: { instant: live } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.devices[0]?.id).toBe('first');
    expect(fetchTemporalData).toHaveBeenCalledTimes(1);

    const nearStart = firstWindow.startInstant;
    rerender({ instant: nearStart });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(fetchTemporalData).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.devices[0]?.id).toBe('first');

    const outside = addMinutesToInstant(nearStart, -60, 'heure');
    rerender({ instant: outside });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.devices[0]?.id).toBe('next');
    expect(result.current.loading).toBe(false);

    vi.useRealTimers();
  });
});
