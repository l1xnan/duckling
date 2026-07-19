import { describe, expect, it } from 'vitest';

import {
  filterHistory,
  formatElapsedMs,
  groupHistoryByConnection,
  isHistoryError,
  normalizeHistoryItem,
  sqlVerb,
  summarizeSql,
  type QueryHistoryItem,
} from '@/lib/queryHistory';

const sample = (over: Partial<QueryHistoryItem> = {}): QueryHistoryItem => ({
  id: over.id ?? '1',
  type: 'query',
  dbId: over.dbId ?? 'db-a',
  stmt: over.stmt ?? 'SELECT 1',
  createdAt: over.createdAt ?? 1000,
  ...over,
});

describe('summarizeSql / sqlVerb', () => {
  it('collapses whitespace and truncates', () => {
    expect(summarizeSql('select   *\nfrom t', 20)).toBe('select * from t');
    expect(summarizeSql('x'.repeat(100), 10).endsWith('…')).toBe(true);
    // Empty statement is non-empty after i18n (catalog or msgid fallback).
    expect(summarizeSql('   ').length).toBeGreaterThan(0);
  });

  it('detects verb', () => {
    expect(sqlVerb('  insert into t values (1)')).toBe('INSERT');
    expect(sqlVerb('-- c\nSELECT 1')).toBe('SELECT');
  });
});

describe('formatElapsedMs', () => {
  it('formats units', () => {
    expect(formatElapsedMs(undefined)).toBe('—');
    expect(formatElapsedMs(42)).toBe('42ms');
    expect(formatElapsedMs(1500)).toBe('1.50s');
  });
});

describe('normalize / filter / group', () => {
  it('normalizes legacy records', () => {
    const n = normalizeHistoryItem({
      id: 'x',
      dbId: 'd1',
      stmt: 'select 1',
      elapsed: 12,
    });
    expect(n?.stmt).toBe('select 1');
    expect(n?.elapsed).toBe(12);
  });

  it('filters by free text', () => {
    const items = [
      sample({ id: '1', stmt: 'SELECT * FROM users' }),
      sample({ id: '2', stmt: 'DELETE FROM logs', dbId: 'db-b' }),
    ];
    expect(filterHistory(items, 'users')).toHaveLength(1);
    expect(filterHistory(items, 'delete')).toHaveLength(1);
    expect(filterHistory(items, '')).toHaveLength(2);
  });

  it('groups by connection newest first', () => {
    const items = [
      sample({ id: '1', dbId: 'a', createdAt: 1 }),
      sample({ id: '2', dbId: 'b', createdAt: 3 }),
      sample({ id: '3', dbId: 'a', createdAt: 2 }),
    ];
    const groups = groupHistoryByConnection(items);
    expect(groups[0].dbId).toBe('b');
    expect(groups[1].dbId).toBe('a');
    expect(groups[1].items.map((i) => i.id)).toEqual(['3', '1']);
  });

  it('detects error runs', () => {
    expect(isHistoryError(sample({ code: 1, message: 'fail' }))).toBe(true);
    expect(isHistoryError(sample({ code: 0, total: 10 }))).toBe(false);
  });
});
