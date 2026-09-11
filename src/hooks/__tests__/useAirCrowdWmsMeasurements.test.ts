import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAirCrowdWmsMeasurements } from '../useAirCrowdWmsMeasurements';

const fetchTemporalData = vi.fn();

vi.mock('../../services/DataServiceFactory', () => ({
  DataServiceFactory: {
    getService: () => ({
      fetchTemporalData,
    }),
  },
}));

describe('useAirCrowdWmsMeasurements', () => {
  beforeEach(() => {
    fetchTemporalData.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ne fetch pas et renvoie devices vides si disabled', async () => {
    const { result } = renderHook(() =>
      useAirCrowdWmsMeasurements({
        enabled: false,
        date: '2026-09-02',
        hour: 11,
        pollutant: 'pm25',
        selectedSources: ['atmoMicro'],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(fetchTemporalData).not.toHaveBeenCalled();
    expect(result.current.devices).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('charge le snapshot le plus proche pour l’heure demandée', async () => {
    fetchTemporalData.mockResolvedValue([
      {
        timestamp: new Date(2026, 8, 2, 11, 0).toISOString(),
        devices: [
          {
            id: '05C1A382',
            name: 'Meyreuil',
            latitude: 43.5,
            longitude: 5.5,
            source: 'atmoMicro',
            pollutant: 'pm25',
            value: 12,
            unit: 'µg/m³',
            timestamp: new Date(2026, 8, 2, 11, 0).toISOString(),
            status: 'active',
          },
        ],
        deviceCount: 1,
        averageValue: 12,
        qualityLevels: {},
      },
    ]);

    const { result } = renderHook(() =>
      useAirCrowdWmsMeasurements({
        enabled: true,
        date: '2026-09-02',
        hour: 11,
        pollutant: 'pm25',
        selectedSources: ['atmoMicro'],
        atmoMicroAllowedSiteIds: ['05C1A382'],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchTemporalData).toHaveBeenCalled();
    expect(result.current.devices).toHaveLength(1);
    expect(result.current.devices[0].id).toBe('05C1A382');
    expect(result.current.error).toBeNull();
  });
});
