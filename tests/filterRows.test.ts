import { describe, expect, it } from 'vitest';

import {
  buildQuickFilterWhere,
  cellToSearchText,
  filterRows,
} from '@/lib/filterRows';
import { quoteIdent } from '@/lib/sql/countByColumn';

describe('filterRows', () => {
  const rows = [
    { id: 1, name: 'Alice', note: null },
    { id: 2, name: 'Bob', note: 'vip' },
    { id: 3, name: 'Carol', note: 'VIP-gold' },
  ];

  it('returns all rows for empty query', () => {
    expect(filterRows(rows, '')).toEqual(rows);
    expect(filterRows(rows, '   ')).toEqual(rows);
  });

  it('filters case-insensitively across columns', () => {
    expect(filterRows(rows, 'bob')).toEqual([rows[1]]);
    expect(filterRows(rows, 'VIP')).toHaveLength(2);
  });

  it('restricts search to given columns', () => {
    expect(filterRows(rows, '1', ['name'])).toEqual([]);
    expect(filterRows(rows, '1', ['id'])).toEqual([rows[0]]);
  });

  it('cellToSearchText handles null and objects', () => {
    expect(cellToSearchText(null)).toBe('');
    expect(cellToSearchText({ a: 1 })).toBe('{"a":1}');
  });
});

describe('buildQuickFilterWhere', () => {
  it('builds ILIKE OR for postgres', () => {
    const w = buildQuickFilterWhere(
      ['name', 'email'],
      "o'brien",
      'postgres',
      quoteIdent,
    );
    expect(w).toContain('"name"::text ILIKE');
    expect(w).toContain("'%o''brien%'");
    expect(w).toContain(' OR ');
  });

  it('uses LIKE for mysql', () => {
    const w = buildQuickFilterWhere(['x'], 'ab', 'mysql', quoteIdent);
    expect(w).toContain('LIKE');
    expect(w).not.toContain('ILIKE');
  });
});
