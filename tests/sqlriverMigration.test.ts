import { describe, expect, it } from 'vitest';
import { formatSQL } from 'sqlriver';

import { getDuckdbSqlriverProfile } from '@/components/editor/sqlriverDuckdbProfile';
import { toSqlriverDialect } from '@/components/editor/sqlFormat';
import {
  defaultSqlriverOptions,
  normalizeSqlFormatterEngine,
  resolveSqlriverOptions,
} from '@/stores/setting';

describe('sqlriver migration (holywell rename)', () => {
  it('normalizes the legacy holywell engine id to sqlriver', () => {
    expect(normalizeSqlFormatterEngine('holywell')).toBe('sqlriver');
    expect(normalizeSqlFormatterEngine('sqlriver')).toBe('sqlriver');
    expect(normalizeSqlFormatterEngine('sql-formatter')).toBe('sql-formatter');
    expect(normalizeSqlFormatterEngine('shandy-sqlfmt')).toBe('shandy-sqlfmt');
    expect(normalizeSqlFormatterEngine(null)).toBe('sql-formatter');
    expect(normalizeSqlFormatterEngine('bogus')).toBe('sql-formatter');
  });

  it('resolves sqlriver options with legacy fallback (new wins)', () => {
    expect(resolveSqlriverOptions()).toEqual(defaultSqlriverOptions);
    expect(resolveSqlriverOptions({ maxLineLength: 100 })).toMatchObject({
      maxLineLength: 100,
      recover: true,
    });
    expect(resolveSqlriverOptions(undefined, { recover: false })).toMatchObject(
      {
        recover: false,
      },
    );
    expect(
      resolveSqlriverOptions({ maxLineLength: 120 }, { maxLineLength: 60 }),
    ).toMatchObject({ maxLineLength: 120 });
  });

  it('duckdb profile is cached and registers verbatim statements', () => {
    const a = getDuckdbSqlriverProfile();
    const b = getDuckdbSqlriverProfile();
    expect(a).toBe(b);
    expect(a.name).toBe('postgres');
    for (const kw of ['PIVOT', 'INSTALL', 'COPY', 'PRAGMA', 'FROM']) {
      expect(a.statementStarters.has(kw)).toBe(true);
    }
    expect(a.keywords.has('SECRET')).toBe(true);
  });

  it('maps connection dialects to sqlriver dialects', () => {
    expect(toSqlriverDialect('mysql')).toBe('mysql');
    expect(toSqlriverDialect('postgres')).toBe('postgres');
    expect(toSqlriverDialect('sqlite')).toBe('ansi');
    const duckdb = toSqlriverDialect('duckdb');
    expect(typeof duckdb).toBe('object');
    expect(toSqlriverDialect('folder')).toBe(duckdb);
  });

  it('formats SQL through sqlriver with the duckdb profile', () => {
    const out = formatSQL('select id, name from users where active = true;', {
      dialect: 'ansi',
    });
    expect(out).toContain('SELECT');
    expect(out).toContain('FROM');
    expect(formatSQL(out, { dialect: 'ansi' })).toBe(out);

    const duckdb = getDuckdbSqlriverProfile();
    expect(() =>
      formatSQL('PIVOT sales ON year USING SUM(amount);', {
        dialect: duckdb,
      }),
    ).not.toThrow();
  });
});
