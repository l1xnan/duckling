import { describe, expect, it } from 'vitest';

import {
  buildCountByColumnSql,
  quoteIdent,
  quoteTableExpr,
} from '@/lib/sql/countByColumn';

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
});
