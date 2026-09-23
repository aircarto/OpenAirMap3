import { describe, expect, it } from 'vitest';
import { chunkDatePeriod, mergeSignalAirReportsById } from '../signalAirChunks';

describe('signalAirChunks', () => {
  it('découpe une période > 30 j en chunks', () => {
    const chunks = chunkDatePeriod({
      startDate: '2026-01-01',
      endDate: '2026-03-01',
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].startDate).toBe('2026-01-01');
    expect(chunks[chunks.length - 1].endDate).toBe('2026-03-01');
    for (const chunk of chunks) {
      const start = new Date(`${chunk.startDate}T00:00:00`);
      const end = new Date(`${chunk.endDate}T00:00:00`);
      const days =
        (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      expect(days).toBeLessThanOrEqual(30);
    }
  });

  it('ne découpe pas une période courte', () => {
    const chunks = chunkDatePeriod({
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    });
    expect(chunks).toEqual([
      { startDate: '2026-09-01', endDate: '2026-09-07' },
    ]);
  });

  it('déduplique les reports par id', () => {
    const merged = mergeSignalAirReportsById([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'c' }],
    ]);
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
