import { describe, expect, it } from 'vitest';

import { buildCellPredicate, mergeWhere } from '@/lib/sql/drillDown';
import { buildExplainSql, buildSampleSql } from '@/lib/sql/sample';

describe('buildSampleSql', () => {
  it('uses dialect-specific sampling', () => {
    expect(buildSampleSql({ tableExpr: 't', dialect: 'postgres' })).toContain(
      'TABLESAMPLE',
    );
    expect(buildSampleSql({ tableExpr: 't', dialect: 'duckdb' })).toContain(
      'USING SAMPLE',
    );
    expect(buildSampleSql({ tableExpr: 't', dialect: 'mysql' })).toContain(
      'RAND()',
    );
    expect(buildSampleSql({ tableExpr: 'public.t', dialect: 'sqlite' })).toContain(
      'RANDOM()',
    );
  });
});

describe('buildExplainSql', () => {
  it('prefixes EXPLAIN and strips semicolon', () => {
    expect(buildExplainSql('select 1;', 'postgres')).toBe('EXPLAIN select 1');
    expect(buildExplainSql('select 1', 'postgres', true)).toContain(
      'EXPLAIN (ANALYZE',
    );
  });
});

describe('drill-down predicates', () => {
  it('builds equality / null / boolean', () => {
    expect(buildCellPredicate('status', 'open', 'postgres')).toBe(
      `"status" = 'open'`,
    );
    expect(buildCellPredicate('n', 3, 'postgres')).toBe('"n" = 3');
    expect(buildCellPredicate('x', null, 'mysql')).toBe('`x` IS NULL');
    expect(buildCellPredicate('f', true, 'postgres')).toBe('"f" = TRUE');
    expect(buildCellPredicate('f', true, 'mysql')).toBe('`f` = 1');
  });

  it('merges WHERE with AND', () => {
    expect(mergeWhere(undefined, 'a = 1')).toBe('a = 1');
    expect(mergeWhere('b > 0', 'a = 1')).toBe('(b > 0) AND (a = 1)');
  });
});
