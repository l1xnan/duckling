import { describe, expect, it } from 'vitest';

import {
  buildPivotSql,
  measureAlias,
  measureTitle,
  validatePivotConfig,
  type PivotConfig,
} from '@/lib/sql/pivot';

const baseConfig = (): PivotConfig => ({
  rows: ['region'],
  columns: ['year'],
  measures: [{ field: 'amount', agg: 'sum' }],
});

describe('pivot SQL', () => {
  it('builds multi-dimension multi-measure GROUP BY SQL', () => {
    const sql = buildPivotSql(
      {
        rows: ['region', 'city'],
        columns: ['year'],
        measures: [
          { field: '*', agg: 'count' },
          { field: 'amount', agg: 'sum' },
          { field: 'qty', agg: 'avg' },
        ],
        where: "status = 'ok'",
        limit: 100,
      },
      { kind: 'table', tableExpr: 'public.orders', dialect: 'postgres' },
    );

    expect(sql).toContain(
      'SELECT "region", "city", "year", COUNT(*) AS "count_star", SUM("amount") AS "sum_amount", AVG("qty") AS "avg_qty"',
    );
    expect(sql).toContain('FROM "public"."orders"');
    expect(sql).toContain("WHERE status = 'ok'");
    expect(sql).toContain('GROUP BY "region", "city", "year"');
    expect(sql).toContain('LIMIT 100');
  });

  it('uses backticks for mysql', () => {
    const sql = buildPivotSql(baseConfig(), {
      kind: 'table',
      tableExpr: 'app.sales',
      dialect: 'mysql',
    });
    expect(sql).toContain('SELECT `region`, `year`, SUM(`amount`) AS `sum_amount`');
    expect(sql).toContain('FROM `app`.`sales`');
    expect(sql).toContain('GROUP BY `region`, `year`');
  });

  it('wraps subquery source', () => {
    const sql = buildPivotSql(baseConfig(), {
      kind: 'subquery',
      sourceSql: 'SELECT * FROM t WHERE x > 1;',
      dialect: 'duckdb',
    });
    expect(sql).toContain(
      'FROM (SELECT * FROM t WHERE x > 1) AS __pivot_src',
    );
  });

  it('supports rows-only and columns-only', () => {
    const rowsOnly = buildPivotSql(
      {
        rows: ['region'],
        columns: [],
        measures: [{ field: '*', agg: 'count' }],
      },
      { kind: 'table', tableExpr: 't', dialect: 'sqlite' },
    );
    expect(rowsOnly).toContain('SELECT "region", COUNT(*) AS "count_star"');
    expect(rowsOnly).toContain('GROUP BY "region"');

    const colsOnly = buildPivotSql(
      {
        rows: [],
        columns: ['year'],
        measures: [{ field: 'v', agg: 'max' }],
      },
      { kind: 'table', tableExpr: 't', dialect: 'sqlite' },
    );
    expect(colsOnly).toContain('SELECT "year", MAX("v") AS "max_v"');
    expect(colsOnly).toContain('GROUP BY "year"');
  });

  it('measureAlias and measureTitle defaults', () => {
    expect(measureAlias({ field: '*', agg: 'count' })).toBe('count_star');
    expect(measureTitle({ field: '*', agg: 'count' })).toBe('COUNT(*)');
    expect(measureAlias({ field: 'amount', agg: 'sum' })).toBe('sum_amount');
    expect(measureTitle({ field: 'amount', agg: 'sum' })).toBe('SUM(amount)');
    expect(measureAlias({ field: 'x', agg: 'avg', alias: 'avg_x' })).toBe(
      'avg_x',
    );
  });

  it('validates config', () => {
    expect(
      validatePivotConfig({ rows: [], columns: [], measures: [] })?.code,
    ).toBe('no_measures');
    expect(
      validatePivotConfig({
        rows: [],
        columns: [],
        measures: [{ field: '*', agg: 'count' }],
      })?.code,
    ).toBe('no_dimensions');
    expect(
      validatePivotConfig({
        rows: ['a', 'a'],
        columns: [],
        measures: [{ field: '*', agg: 'count' }],
      })?.code,
    ).toBe('duplicate_field');
    expect(
      validatePivotConfig({
        rows: ['amount'],
        columns: [],
        measures: [{ field: 'amount', agg: 'sum' }],
      })?.code,
    ).toBe('overlap');
    expect(validatePivotConfig(baseConfig())).toBeNull();
  });

  it('throws on invalid config when building SQL', () => {
    expect(() =>
      buildPivotSql(
        { rows: [], columns: [], measures: [] },
        { kind: 'table', tableExpr: 't', dialect: 'duckdb' },
      ),
    ).toThrow(/measure/i);
  });
});
