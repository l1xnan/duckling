import { describe, expect, it } from 'vitest';

import {
  computedSelectFragments,
  joinComputedSelectList,
  parseComputedColumnSql,
  resolveAnalysisTableExpr,
  validateComputedColumns,
  wrapTableExprWithComputed,
} from '@/lib/sql/computedColumns';

describe('computedColumns', () => {
  it('parses expr AS alias', () => {
    expect(parseComputedColumnSql('a+1 as a1')).toEqual({
      expr: 'a+1',
      alias: 'a1',
    });
    expect(parseComputedColumnSql('CAST(x AS INT) AS a1')).toEqual({
      expr: 'CAST(x AS INT)',
      alias: 'a1',
    });
  });

  it('rejects missing alias', () => {
    expect(parseComputedColumnSql('a+1')).toBeNull();
    expect(parseComputedColumnSql('')).toBeNull();
  });

  it('joins select list fragments', () => {
    const cols = [
      { id: '1', sql: 'a+1 AS a1' },
      { id: '2', sql: 'b*2 AS b2' },
    ];
    expect(computedSelectFragments(cols)).toBe('a+1 AS a1, b*2 AS b2');
    expect(joinComputedSelectList(cols)).toBe(', a+1 AS a1, b*2 AS b2');
    expect(joinComputedSelectList([])).toBe('');
  });

  it('validates computed columns', () => {
    expect(
      validateComputedColumns([{ id: '1', sql: 'a+1 AS a1' }]),
    ).toBeNull();
    expect(validateComputedColumns([{ id: '1', sql: 'bad' }])).toMatch(
      /Invalid computed column/,
    );
  });

  it('wraps table expr for analysis when columns exist', () => {
    const wrapped = wrapTableExprWithComputed(
      'public.items',
      [{ id: '1', sql: 'a+1 AS a1' }],
      'postgres',
    );
    expect(wrapped).toBe(
      '(SELECT *, a+1 AS a1 FROM "public"."items") AS __computed',
    );
    expect(
      wrapTableExprWithComputed(
        "read_parquet('data.parquet')",
        [{ id: '1', sql: 'a+1 AS a1' }],
        'duckdb',
      ),
    ).toBe(
      "(SELECT *, a+1 AS a1 FROM read_parquet('data.parquet')) AS __computed",
    );
  });

  it('resolveAnalysisTableExpr leaves bare table when empty', () => {
    expect(resolveAnalysisTableExpr('tbl', [], 'generic')).toBe('tbl');
    expect(resolveAnalysisTableExpr('tbl', undefined, 'generic')).toBe('tbl');
  });
});
