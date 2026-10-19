import { describe, expect, it } from 'vitest';

import {
  buildColumnProfileSql,
  buildColumnProfileSubquerySql,
} from '@/lib/sql/columnProfile';
import { buildCountBySubquerySql } from '@/lib/sql/countBySubquery';

describe('column profile SQL', () => {
  it('builds aggregate profile query', () => {
    const sql = buildColumnProfileSql({
      tableExpr: 'public.orders',
      column: 'status',
      dialect: 'postgres',
      where: "status <> ''",
    });
    expect(sql).toContain('COUNT(*) AS total');
    expect(sql).toContain('null_count');
    expect(sql).toContain('distinct_count');
    expect(sql).toContain('MIN("status") AS min_value');
    expect(sql).toContain('FROM "public"."orders"');
    expect(sql).toContain("WHERE status <> ''");
  });

  it('builds profile aggregates over a subquery', () => {
    const sql = buildColumnProfileSubquerySql({
      sourceSql: 'SELECT id, status FROM orders;',
      column: 'status',
      dialect: 'postgres',
    });
    expect(sql).toContain('COUNT(*) AS total');
    expect(sql).toContain('COUNT(DISTINCT "status") AS distinct_count');
    expect(sql).toContain('FROM (\nSELECT id, status FROM orders\n) AS __count_src');
    expect(sql).not.toMatch(/orders\);/);
  });
});

describe('count-by subquery SQL', () => {
  it('wraps source SQL and strips trailing semicolon', () => {
    const sql = buildCountBySubquerySql({
      sourceSql: 'SELECT id, status FROM orders;',
      column: 'status',
      dialect: 'postgres',
      limit: 50,
    });
    expect(sql).toContain('FROM (\nSELECT id, status FROM orders\n) AS __count_src');
    expect(sql).toContain('GROUP BY "status"');
    expect(sql).toContain('LIMIT 50');
    expect(sql).not.toMatch(/orders\);/);
  });
});
