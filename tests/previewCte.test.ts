import path from 'path';
import { describe, expect, it } from 'vitest';

import type { Parser } from '@/ast';
import {
  isSingleSqlIdentifier,
  resolveCtePreview,
} from '@/lib/sql/previewCte';

describe('isSingleSqlIdentifier', () => {
  it('accepts unquoted and quoted identifiers', () => {
    expect(isSingleSqlIdentifier('sales')).toBe(true);
    expect(isSingleSqlIdentifier('  sales  ')).toBe(true);
    expect(isSingleSqlIdentifier('"Sales"')).toBe(true);
    expect(isSingleSqlIdentifier('`sales`')).toBe(true);
  });

  it('rejects SQL fragments', () => {
    expect(isSingleSqlIdentifier('select * from sales')).toBe(false);
    expect(isSingleSqlIdentifier('a as')).toBe(false);
    expect(isSingleSqlIdentifier('a, b')).toBe(false);
    expect(isSingleSqlIdentifier('a\nb')).toBe(false);
  });
});

describe('resolveCtePreview', () => {
  let parser: Parser;

  async function setup() {
    if (!parser) {
      const { Parser: _Parser, Language, Query: _Query } = await import(
        'web-tree-sitter'
      );
      await _Parser.init();
      const p = new _Parser();
      const wasmPath = path.resolve(
        process.cwd(),
        'node_modules/@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm',
      );
      const lang = await Language.load(wasmPath);
      p.setLanguage(lang);
      (p as Parser).query = (source: string) => new _Query(lang, source);
      parser = p as Parser;
    }
    return parser;
  }

  const sql = `with
    a as (
        select 1 as x
    ),
    b as (
        select x + 1 as y from a
    ),
    c as (
        select y * 2 as z from b
    )
select z from c`;

  it('rewrites when the cursor is on a CTE name', async () => {
    const p = await setup();
    const offset = sql.indexOf('b as');
    const preview = resolveCtePreview(sql, offset, undefined, p);
    expect(preview?.cteName).toBe('b');
    expect(preview?.sql).toContain('b as (');
    expect(preview?.sql).toContain('select x + 1 as y from a');
    expect(preview?.sql).toMatch(/SELECT \* FROM b$/);
    expect(preview?.sql).not.toContain('c as (');
    expect(preview?.sql).not.toContain('select z from c');
  });

  it('keeps only the target CTE and earlier ones', async () => {
    const p = await setup();
    const offset = sql.indexOf('a as');
    const preview = resolveCtePreview(sql, offset, undefined, p);
    expect(preview?.cteName).toBe('a');
    expect(preview?.sql).toMatch(/SELECT \* FROM a$/);
    expect(preview?.sql).not.toContain('b as (');
  });

  it('rewrites when the selection is exactly the CTE identifier', async () => {
    const p = await setup();
    const offset = sql.indexOf('c as');
    const preview = resolveCtePreview(sql, offset, 'c', p);
    expect(preview?.cteName).toBe('c');
    expect(preview?.sql).toContain('c as (');
    expect(preview?.sql).toMatch(/SELECT \* FROM c$/);
  });

  it('does not rewrite a SQL fragment selection', async () => {
    const p = await setup();
    const offset = sql.indexOf('select z');
    expect(
      resolveCtePreview(sql, offset, 'select z from c', p),
    ).toBeNull();
  });

  it('does not rewrite when the cursor is in the CTE body', async () => {
    const p = await setup();
    const offset = sql.indexOf('x + 1');
    expect(resolveCtePreview(sql, offset, undefined, p)).toBeNull();
  });

  it('does not rewrite a non-CTE identifier', async () => {
    const p = await setup();
    const offset = sql.indexOf('z from');
    expect(resolveCtePreview(sql, offset, undefined, p)).toBeNull();
  });

  it('preserves WITH RECURSIVE', async () => {
    const p = await setup();
    const rec = `with recursive t as (
  select 1 as n
  union all
  select n + 1 from t where n < 3
)
select * from t`;
    const offset = rec.indexOf('t as');
    const preview = resolveCtePreview(rec, offset, undefined, p);
    expect(preview?.sql.toLowerCase()).toContain('with recursive');
    expect(preview?.sql).toMatch(/SELECT \* FROM t$/);
  });

  it('matches unquoted names case-insensitively', async () => {
    const p = await setup();
    const offset = sql.indexOf('b as');
    const preview = resolveCtePreview(sql, offset, 'B', p);
    expect(preview?.cteName).toBe('b');
  });
});