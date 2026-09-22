import { describe, expect, it } from 'vitest';

import { buildCountBySubquerySql } from '@/lib/sql/countBySubquery';
import { buildPivotSql, type PivotConfig } from '@/lib/sql/pivot';
import {
  stripTrailingStatementSemicolons,
  wrapSqlAsAliasedSubquery,
  wrapSqlAsSubquery,
} from '@/lib/sql/wrapSubquery';

describe('wrapSubquery', () => {
  it('strips trailing semicolons', () => {
    expect(stripTrailingStatementSemicolons('SELECT 1;;  ')).toBe('SELECT 1');
  });

  it('puts closing paren on its own line after a trailing line comment', () => {
    const source = `select version()
-- 注释`;
    const wrapped = wrapSqlAsAliasedSubquery(source, '__count_src');
    expect(wrapped).toBe(`(
select version()
-- 注释
) AS __count_src`);
    expect(wrapped).not.toMatch(/--[^\n]*\)/);
  });

  it('count-by subquery survives trailing line comment', () => {
    const sql = buildCountBySubquerySql({
      sourceSql: `select version()
-- 注释`,
      column: 'version()',
      dialect: 'duckdb',
    });
    expect(sql).toContain('-- 注释\n) AS __count_src');
    expect(sql).not.toMatch(/--[^\n]*\) AS __count_src/);
  });

  it('pivot subquery survives trailing line comment', () => {
    const config: PivotConfig = {
      rows: ['x'],
      columns: [],
      measures: [{ field: '*', agg: 'count' }],
    };
    const sql = buildPivotSql(config, {
      kind: 'subquery',
      sourceSql: `select 1
-- end`,
      dialect: 'duckdb',
    });
    expect(sql).toContain('-- end\n) AS __pivot_src');
  });
});
