import { describe, expect, it } from 'vitest';

import { DataFrame } from '@/utils/dataframe';

describe('DataFrame stats', () => {
  it('computes nulls distinct and numeric aggregates', () => {
    const df = new DataFrame([
      { a: 1, b: 'x' },
      { a: 2, b: null },
      { a: null, b: 'x' },
      { a: 3, b: '' },
    ]);
    const s = df.stats('a');
    expect(s.count).toBe(4);
    expect(s.nulls).toBe(1);
    expect(s.distinct).toBe(3);
    expect(s.sum).toBe(6);
    expect(s.min).toBe(1);
    expect(s.max).toBe(3);

    const sb = df.stats('b');
    expect(sb.nulls).toBe(2); // null + empty string
    expect(sb.distinct).toBe(1);
  });

  it('builds markdown summary', () => {
    const df = new DataFrame([{ n: 10 }, { n: 20 }]);
    const md = df.statsMarkdown();
    expect(md).toContain('| field |');
    expect(md).toContain('| n |');
    expect(md).toContain('30');
  });
});
