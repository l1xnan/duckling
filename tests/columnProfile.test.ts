import { describe, expect, it } from 'vitest';

import {
  buildColumnProfileSql,
  buildColumnTopNSql,
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

  it('builds top-N distribution', () => {
    const sql = buildColumnTopNSql({
      tableExpr: 't',
      column: 'c',
      dialect: 'mysql',
      topN: 5,
    });
    expect(sql).toContain('SELECT `c` AS value, COUNT(*) AS count');
    expect(sql).toContain('LIMIT 5');
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
    expect(sql).toContain('FROM (SELECT id, status FROM orders) AS __count_src');
    expect(sql).toContain('GROUP BY "status"');
    expect(sql).toContain('LIMIT 50');
    expect(sql).not.toMatch(/orders\);/);
  });
});
