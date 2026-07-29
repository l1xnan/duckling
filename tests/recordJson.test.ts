import { describe, expect, it } from 'vitest';

import { formatRecordAsJson } from '@/lib/recordJson';

describe('formatRecordAsJson', () => {
  it('pretty-prints nested objects with 2-space indent', () => {
    const text = formatRecordAsJson({ a: 1, b: { c: 2 } });
    expect(text).toContain('"a": 1');
    expect(text).toContain('\n  "b"');
  });

  it('serializes bigint as string', () => {
    const text = formatRecordAsJson({ n: 10n });
    expect(text).toContain('"n": "10"');
  });
});
