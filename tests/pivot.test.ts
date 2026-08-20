import { describe, expect, it } from 'vitest';

import {
  applyPivotShowAs,
  buildDistinctCountSql,
  buildPivotSql,
  formatPivotPercent,
  isNumericAgg,
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

  it('builds distinct count probe SQL', () => {
    const tableSql = buildDistinctCountSql(
      'region',
      { kind: 'table', tableExpr: 'public.orders', dialect: 'postgres' },
      "status = 'ok'",
    );
    expect(tableSql).toBe(
      `SELECT COUNT(DISTINCT "region") AS distinct_count FROM "public"."orders" WHERE status = 'ok'`,
    );

    const subSql = buildDistinctCountSql('year', {
      kind: 'subquery',
      sourceSql: 'SELECT * FROM t',
      dialect: 'duckdb',
    });
    expect(subSql).toContain('COUNT(DISTINCT "year")');
    expect(subSql).toContain('FROM (SELECT * FROM t) AS __pivot_src');
  });

  it('classifies numeric aggregations', () => {
    expect(isNumericAgg('sum')).toBe(true);
    expect(isNumericAgg('avg')).toBe(true);
    expect(isNumericAgg('count')).toBe(false);
    expect(isNumericAgg('min')).toBe(false);
  });
});

describe('pivot showAs', () => {
  const config: Pick<PivotConfig, 'rows' | 'columns' | 'measures'> = {
    rows: ['region'],
    columns: ['year'],
    measures: [
      { field: '*', agg: 'count' },
      { field: 'amount', agg: 'sum' },
    ],
  };

  const records = [
    { region: 'East', year: '2020', count_star: 30, sum_amount: 300 },
    { region: 'East', year: '2021', count_star: 70, sum_amount: 700 },
    { region: 'West', year: '2020', count_star: 50, sum_amount: 500 },
    { region: 'West', year: '2021', count_star: 50, sum_amount: 500 },
  ];

  it('returns records unchanged for value mode', () => {
    const out = applyPivotShowAs(records, config, 'value');
    expect(out).toEqual(records);
    expect(out).toBe(records);
  });

  it('computes row percentages per measure', () => {
    const out = applyPivotShowAs(records, config, 'rowPct');
    expect(out[0]?.count_star).toBe(30);
    expect(out[1]?.count_star).toBe(70);
    expect(out[0]?.sum_amount).toBe(30);
    expect(out[1]?.sum_amount).toBe(70);
    expect(out[2]?.count_star).toBe(50);
    expect(out[3]?.count_star).toBe(50);
  });

  it('computes column percentages per measure', () => {
    const out = applyPivotShowAs(records, config, 'colPct');
    expect(out[0]?.count_star).toBeCloseTo(37.5);
    expect(out[2]?.count_star).toBeCloseTo(62.5);
    expect(out[0]?.sum_amount).toBeCloseTo(37.5);
    expect(out[2]?.sum_amount).toBeCloseTo(62.5);
  });

  it('uses grand total when row dimension is empty', () => {
    const colsOnly = {
      rows: [] as string[],
      columns: ['year'],
      measures: [{ field: '*', agg: 'count' as const }],
    };
    const rows = [
      { year: '2020', count_star: 25 },
      { year: '2021', count_star: 75 },
    ];
    const out = applyPivotShowAs(rows, colsOnly, 'rowPct');
    expect(out[0]?.count_star).toBeCloseTo(25);
    expect(out[1]?.count_star).toBeCloseTo(75);
  });

  it('uses grand total when column dimension is empty', () => {
    const rowsOnly = {
      rows: ['region'],
      columns: [] as string[],
      measures: [{ field: 'amount', agg: 'sum' as const }],
    };
    const rows = [
      { region: 'A', sum_amount: 40 },
      { region: 'B', sum_amount: 60 },
    ];
    const out = applyPivotShowAs(rows, rowsOnly, 'colPct');
    expect(out[0]?.sum_amount).toBeCloseTo(40);
    expect(out[1]?.sum_amount).toBeCloseTo(60);
  });

  it('returns 0% denominator for zero totals', () => {
    const out = applyPivotShowAs(
      [{ region: 'A', year: '2020', sum_amount: 0 }],
      {
        rows: ['region'],
        columns: ['year'],
        measures: [{ field: 'amount', agg: 'sum' }],
      },
      'rowPct',
    );
    expect(out[0]?.sum_amount).toBe(0);
    expect(formatPivotPercent(0, 0)).toBe('0%');
  });

  it('leaves non-numeric measure values unchanged', () => {
    const out = applyPivotShowAs(
      [{ region: 'A', year: '2020', sum_amount: 'n/a' }],
      {
        rows: ['region'],
        columns: ['year'],
        measures: [{ field: 'amount', agg: 'sum' }],
      },
      'rowPct',
    );
    expect(out[0]?.sum_amount).toBe('n/a');
  });

  it('formats pivot percent strings', () => {
    expect(formatPivotPercent(12.345, 100)).toBe('12.35%');
    expect(formatPivotPercent(1, 0)).toBe('0%');
  });
});
