import { describe, expect, it } from 'vitest';

import { resolveTableRender } from '@/stores/setting';
import {
  columnPinningFor,
  estimateColumnWidth,
  selectionBounds,
  transposeRecords,
} from '@/components/tables/tanstackGrid';

describe('resolveTableRender', () => {
  it('keeps canvas as the default', () => {
    expect(resolveTableRender(undefined)).toBe('canvas');
    expect(resolveTableRender('canvas')).toBe('canvas');
    expect(resolveTableRender('vtable')).toBe('canvas');
  });

  it('selects the DOM grid only for dom', () => {
    expect(resolveTableRender('dom')).toBe('dom');
  });
});

describe('tanstack grid model', () => {
  it('pins the row-number column ahead of user pins', () => {
    expect(columnPinningFor(['b', 'a'], ['c'])).toEqual({
      start: ['#', 'b', 'a'],
      end: ['c'],
    });
  });

  it('turns records into one row per field', () => {
    const rows = transposeRecords(
      ['name', 'n'],
      [
        { name: 'a', n: 1 },
        { name: 'b', n: 2 },
      ],
    );
    expect(rows).toEqual([
      { __field: 'name', r0: 'a', r1: 'b' },
      { __field: 'n', r0: 1, r1: 2 },
    ]);
  });

  it('normalizes a selection dragged up and left', () => {
    expect(selectionBounds({ row: 4, col: 3 }, { row: 1, col: 1 })).toEqual({
      r0: 1,
      c0: 1,
      r1: 4,
      c1: 3,
    });
  });

  it('caps estimated column width at 200', () => {
    expect(estimateColumnWidth(['id'], 12)).toBeGreaterThanOrEqual(72);
    expect(estimateColumnWidth(['x'.repeat(400)], 12)).toBe(200);
  });
});
