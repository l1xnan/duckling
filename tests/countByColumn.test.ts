import { describe, expect, it, vi } from 'vitest';

import {
  buildCountByColumnSql,
  buildTableRowCountSql,
  formatCountPercent,
  parseScalarCountResult,
  resolveAllRowsTotal,
  sumCountRows,
  withCountPercent,
  quoteIdent,
  quoteTableExpr,
} from '@/lib/sql/countByColumn';
import { buildSubqueryRowCountSql } from '@/lib/sql/countBySubquery';

describe('countByColumn SQL', () => {
  it('quotes postgres identifiers', () => {
    expect(quoteIdent('userId', 'postgres')).toBe('"userId"');
    expect(quoteIdent('a"b', 'postgres')).toBe('"a""b"');
  });

  it('quotes mysql identifiers with backticks', () => {
    expect(quoteIdent('userId', 'mysql')).toBe('`userId`');
  });

  it('quotes bare table paths but not table functions', () => {
    expect(quoteTableExpr('public.items', 'postgres')).toBe(
      '"public"."items"',
    );
    expect(
      quoteTableExpr("read_csv('a.csv', auto_detect=true)", 'duckdb'),
    ).toBe("read_csv('a.csv', auto_detect=true)");
  });

  it('builds group-by count SQL with where and limit', () => {
    const sql = buildCountByColumnSql({
      tableExpr: 'public.orders',
      column: 'status',
      dialect: 'postgres',
      where: "status <> ''",
      limit: 100,
    });
    expect(sql).toContain('SELECT "status" AS value, COUNT(*) AS count');
    expect(sql).toContain('FROM "public"."orders"');
    expect(sql).toContain("WHERE status <> ''");
    expect(sql).toContain('GROUP BY "status"');
    expect(sql).toContain('ORDER BY count DESC');
    expect(sql).toContain('LIMIT 100');
  });

  it('uses backticks for mysql', () => {
    const sql = buildCountByColumnSql({
      tableExpr: 'app.users',
      column: 'role',
      dialect: 'mysql',
    });
    expect(sql).toContain('SELECT `role` AS value');
    expect(sql).toContain('FROM `app`.`users`');
  });

  it('builds table row count SQL with where', () => {
    const sql = buildTableRowCountSql({
      tableExpr: 'public.orders',
      dialect: 'postgres',
      where: "status = 'open'",
    });
    expect(sql).toBe(
      `SELECT COUNT(*) AS count FROM "public"."orders" WHERE status = 'open'`,
    );
  });

  it('builds subquery row count SQL', () => {
    expect(buildSubqueryRowCountSql('SELECT * FROM t;')).toBe(
      'SELECT COUNT(*) AS count FROM (SELECT * FROM t) AS __count_src',
    );
  });
});

describe('withCountPercent', () => {
  it('computes percent against all matching rows', () => {
    const rows = [
      { value: 'a', count: 25 },
      { value: 'b', count: 75 },
    ];
    const result = withCountPercent(rows, 100);
    expect(result).toEqual([
      { value: 'a', count: 25, percent: '25.00%' },
      { value: 'b', count: 75, percent: '75.00%' },
    ]);
    expect(sumCountRows(result)).toBe(100);
    expect(
      result.reduce(
        (sum, row) => sum + parseFloat(row.percent),
        0,
      ),
    ).toBeCloseTo(100);
  });

  it('returns 0% when total is zero', () => {
    expect(formatCountPercent(10, 0)).toBe('0%');
    expect(withCountPercent([{ count: 10 }], 0)[0].percent).toBe('0%');
  });

  it('truncated groups sum to less than 100% of all rows', () => {
    const rows = [
      { count: 400 },
      { count: 300 },
      { count: 200 },
    ];
    const total = 1000;
    const result = withCountPercent(rows, total);
    const percentSum = result.reduce(
      (sum, row) => sum + parseFloat(row.percent),
      0,
    );
    expect(percentSum).toBeCloseTo(90);
    expect(percentSum).toBeLessThan(100);
    expect(sumCountRows(rows)).toBe(900);
  });

  it('parseScalarCountResult reads count column', () => {
    expect(parseScalarCountResult([{ count: 42 }])).toBe(42);
    expect(parseScalarCountResult([{ COUNT: 7n }])).toBe(7);
  });

  it('resolveAllRowsTotal prefers parent total', async () => {
    const fetch = vi.fn(async () => 999);
    await expect(
      resolveAllRowsTotal([{ count: 10 }], 500, fetch),
    ).resolves.toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolveAllRowsTotal fetches when parent total missing', async () => {
    const fetch = vi.fn(async () => 200);
    await expect(
      resolveAllRowsTotal([{ count: 50 }], undefined, fetch),
    ).resolves.toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('resolveAllRowsTotal skips fetch when no groups', async () => {
    const fetch = vi.fn(async () => 200);
    await expect(resolveAllRowsTotal([], undefined, fetch)).resolves.toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
