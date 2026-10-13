import { describe, it, expect } from 'vitest';
import type { DeviceLocationStay } from '../../../../types';
import {
  getLocationChangeMarkers,
  getLocationHighlightBands,
} from '../deviceLocationChartOverlays';

const stay = (
  id: string,
  label: string,
  intervals: Array<{ start: string; end: string }>
): DeviceLocationStay => ({
  locationId: id,
  label,
  lat: 43,
  lon: 5,
  intervals,
  isCurrent: false,
});

describe('deviceLocationChartOverlays', () => {
  it('émet un marqueur pour chaque changement de site (sauf le premier)', () => {
    const markers = getLocationChangeMarkers([
      stay('a', 'Site A', [
        {
          start: '2025-10-01T00:00:00.000Z',
          end: '2026-03-01T00:00:00.000Z',
        },
      ]),
      stay('b', 'Site B', [
        {
          start: '2026-05-01T00:00:00.000Z',
          end: '2026-10-01T00:00:00.000Z',
        },
      ]),
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0].label).toBe('Site B');
    expect(markers[0].timestamp).toBe(
      new Date('2026-05-01T00:00:00.000Z').getTime()
    );
  });

  it('filtre les marqueurs hors plage visible', () => {
    const markers = getLocationChangeMarkers(
      [
        stay('a', 'Site A', [
          {
            start: '2025-10-01T00:00:00.000Z',
            end: '2026-03-01T00:00:00.000Z',
          },
        ]),
        stay('b', 'Site B', [
          {
            start: '2026-05-01T00:00:00.000Z',
            end: '2026-10-01T00:00:00.000Z',
          },
        ]),
      ],
      new Date('2025-10-01T00:00:00.000Z').getTime(),
      new Date('2026-04-01T00:00:00.000Z').getTime()
    );
    expect(markers).toHaveLength(0);
  });

  it('calcule les bandes de highlight découpées à la plage', () => {
    const bands = getLocationHighlightBands(
      stay('a', 'Site A', [
        {
          start: '2026-01-01T00:00:00.000Z',
          end: '2026-03-01T00:00:00.000Z',
        },
      ]),
      new Date('2026-02-01T00:00:00.000Z').getTime(),
      new Date('2026-04-01T00:00:00.000Z').getTime()
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].start).toBe(new Date('2026-02-01T00:00:00.000Z').getTime());
    expect(bands[0].end).toBe(new Date('2026-03-01T00:00:00.000Z').getTime());
  });
});
