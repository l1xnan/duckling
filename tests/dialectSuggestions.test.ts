import { describe, expect, it } from 'vitest';

import { ContextType, SuggestionType } from '@/ast/analyze';
import {
  DIALECT_FUNCTIONS,
  SQL_KEYWORDS,
  buildFunctionSuggestions,
  buildKeywordSuggestions,
  functionsForDialect,
  unionSuggestions,
} from '@/components/editor/dialectSuggestions';

describe('dialectSuggestions keyword lists', () => {
  it('contains core SQL keywords', () => {
    for (const kw of ['SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'JOIN', 'AND', 'OR']) {
      expect(SQL_KEYWORDS).toContain(kw);
    }
  });

  it('contains statement-level keywords', () => {
    for (const kw of ['CREATE', 'INSERT', 'UPDATE', 'DELETE', 'PIVOT', 'COPY']) {
      expect(SQL_KEYWORDS).toContain(kw);
    }
  });

  it('is all uppercase', () => {
    for (const kw of SQL_KEYWORDS) {
      expect(kw).toBe(kw.toUpperCase());
    }
  });
});

describe('dialectSuggestions functions', () => {
  it('provides non-empty lists for every dialect', () => {
    for (const dialect of ['duckdb', 'postgres', 'mysql', 'sqlite', 'clickhouse']) {
      expect(DIALECT_FUNCTIONS[dialect].length).toBeGreaterThan(30);
    }
  });

  it('maps quack/folder/file to the duckdb list', () => {
    for (const d of ['quack', 'folder', 'file', undefined]) {
      expect(functionsForDialect(d)).toBe(DIALECT_FUNCTIONS.duckdb);
    }
  });

  it('falls back to duckdb for unknown dialects', () => {
    expect(functionsForDialect('oracle')).toBe(DIALECT_FUNCTIONS.duckdb);
  });

  it('duckdb includes file functions and core aggregates', () => {
    for (const f of ['read_parquet', 'read_csv', 'strftime', 'date_diff', 'unnest', 'count']) {
      expect(DIALECT_FUNCTIONS.duckdb).toContain(f);
    }
  });

  it('per-dialect spot checks', () => {
    expect(DIALECT_FUNCTIONS.postgres).toContain('now');
    expect(DIALECT_FUNCTIONS.mysql).toContain('ifnull');
    expect(DIALECT_FUNCTIONS.sqlite).toContain('strftime');
    expect(DIALECT_FUNCTIONS.clickhouse).toContain('groupArray');
  });

  it('clickhouse keeps exact canonical case', () => {
    const ch = DIALECT_FUNCTIONS.clickhouse;
    expect(ch).toContain('groupArray');
    expect(ch).toContain('toDateTime');
    expect(ch.some((f) => f === 'grouparray')).toBe(false);
  });
});

describe('builders and merge', () => {
  it('builds keyword suggestions with trailing space (except value literals)', () => {
    const items = buildKeywordSuggestions(['SELECT', 'NULL', 'FROM']);
    expect(items).toEqual([
      { type: ContextType.KEYWORD, label: 'SELECT', insertText: 'SELECT ' },
      { type: ContextType.KEYWORD, label: 'NULL', insertText: 'NULL' },
      { type: ContextType.KEYWORD, label: 'FROM', insertText: 'FROM ' },
    ]);
  });

  it('builds snippet function suggestions with cursor inside parens', () => {
    const items = buildFunctionSuggestions(['count', 'groupArray']);
    expect(items).toEqual([
      { type: ContextType.FUNCTION, label: 'count', insertText: 'count($0)', snippet: true },
      { type: ContextType.FUNCTION, label: 'groupArray', insertText: 'groupArray($0)', snippet: true },
    ]);
  });

  it('uses the default keyword list when none passed', () => {
    const items = buildKeywordSuggestions();
    expect(items.length).toBe(SQL_KEYWORDS.length);
    expect(items[0].type).toBe(ContextType.KEYWORD);
  });

  it('unions keeping the first occurrence per case-insensitive label', () => {
    const base: SuggestionType[] = [
      { type: ContextType.COLUMN, label: 'count', insertText: 'count' },
      { type: ContextType.TABLE, label: 'users', insertText: 'users' },
    ];
    const extra = buildKeywordSuggestions(['SELECT', 'COUNT']);
    const merged = unionSuggestions(base, extra);
    expect(merged.map((m) => m.label)).toEqual(['count', 'users', 'SELECT']);
  });

  it('keeps original case from the preferred (DB) source', () => {
    const db: SuggestionType[] = [
      { type: ContextType.FUNCTION, label: 'groupArray', insertText: 'groupArray($0)', snippet: true },
    ];
    const curated = buildFunctionSuggestions(['grouparray']);
    const merged = unionSuggestions(db, curated);
    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('groupArray');
    expect(merged[0].insertText).toBe('groupArray($0)');
  });
});
