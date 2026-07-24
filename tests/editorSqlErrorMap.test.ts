import { describe, expect, it } from 'vitest';

import { mapParseLocationToDocument } from '@/stores/editorSqlError';

describe('mapParseLocationToDocument', () => {
  it('uses location as-is without source range', () => {
    expect(mapParseLocationToDocument({ line: 3, column: 5 })).toEqual({
      line: 3,
      column: 5,
    });
  });

  it('offsets by selection start for first line of fragment', () => {
    expect(
      mapParseLocationToDocument(
        { line: 1, column: 2 },
        { startLineNumber: 10, startColumn: 5 },
      ),
    ).toEqual({ line: 10, column: 6 });
  });

  it('offsets line only for subsequent lines of fragment', () => {
    expect(
      mapParseLocationToDocument(
        { line: 2, column: 3 },
        { startLineNumber: 10, startColumn: 5 },
      ),
    ).toEqual({ line: 11, column: 3 });
  });
});
