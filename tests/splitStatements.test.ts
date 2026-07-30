import path from 'path';
import { describe, expect, it } from 'vitest';

import type { Parser } from '@/ast';
import {
  findStatementAtOffset,
  splitSqlBySemicolon,
  splitSqlStatements,
  statementHighlightBounds,
} from '@/lib/sql/splitStatements';

describe('splitSqlBySemicolon', () => {
  it('splits multiple statements', () => {
    const slices = splitSqlBySemicolon('SELECT 1; SELECT 2');
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe('SELECT 1');
    expect(slices[1].text).toBe('SELECT 2');
  });

  it('ignores semicolon inside single-quoted string', () => {
    const sql = "SELECT ';' ; SELECT 2";
    const slices = splitSqlBySemicolon(sql);
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe("SELECT ';'");
    expect(slices[1].text).toBe('SELECT 2');
  });

  it('ignores semicolon in line comment', () => {
    const sql = 'SELECT 1 -- ; comment\n; SELECT 2';
    const slices = splitSqlBySemicolon(sql);
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe('SELECT 1 -- ; comment');
    expect(slices[1].text).toBe('SELECT 2');
  });

  it('ignores semicolon in block comment', () => {
    const sql = 'SELECT 1 /* ; */ ; SELECT 2';
    const slices = splitSqlBySemicolon(sql);
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe('SELECT 1 /* ; */');
    expect(slices[1].text).toBe('SELECT 2');
  });

  it('handles single statement without trailing semicolon', () => {
    const slices = splitSqlBySemicolon('SELECT 1');
    expect(slices.length).toBe(1);
    expect(slices[0].text).toBe('SELECT 1');
  });

  it('skips empty statements from double semicolon', () => {
    const slices = splitSqlBySemicolon('SELECT 1;; SELECT 2');
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe('SELECT 1');
    expect(slices[1].text).toBe('SELECT 2');
  });

  it('handles dollar-quoted strings', () => {
    const sql = "SELECT $$a;b$$; SELECT 2";
    const slices = splitSqlBySemicolon(sql);
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe('SELECT $$a;b$$');
    expect(slices[1].text).toBe('SELECT 2');
  });
});

describe('findStatementAtOffset (lexer)', () => {
  it('finds second statement at cursor', () => {
    const sql = 'SELECT 1; SELECT 2';
    const offset = sql.indexOf('2');
    const slice = findStatementAtOffset(sql, offset);
    expect(slice?.text).toBe('SELECT 2');
  });

  it('finds first statement when cursor in whitespace gap', () => {
    const sql = 'SELECT 1;   SELECT 2';
    const gap = sql.indexOf(';') + 1;
    const slice = findStatementAtOffset(sql, gap + 1);
    expect(slice?.text).toBe('SELECT 1');
  });

  it('finds second statement when cursor after gap with no prior stmt', () => {
    const sql = '   SELECT 2';
    const slice = findStatementAtOffset(sql, 2);
    expect(slice?.text).toBe('SELECT 2');
  });
});

describe('statementHighlightBounds', () => {
  const model = {
    getLineContent: (line: number) => {
      const lines = [
        'with a as (',
        '    select *',
        ')',
        'select short',
        'from a',
      ];
      return lines[line - 1] ?? '';
    },
    getPositionAt: (offset: number) => {
      const text = model
        .getLineContent(1)
        .concat(
          '\n',
          model.getLineContent(2),
          '\n',
          model.getLineContent(3),
          '\n',
          model.getLineContent(4),
          '\n',
          model.getLineContent(5),
        );
      let line = 1;
      let col = 1;
      for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === '\n') {
          line += 1;
          col = 1;
        } else {
          col += 1;
        }
      }
      return { lineNumber: line, column: col };
    },
  };

  it('uses widest line width, not full editor width', () => {
    const slice = splitSqlBySemicolon(
      model
        .getLineContent(1)
        .concat(
          '\n',
          model.getLineContent(2),
          '\n',
          model.getLineContent(3),
          '\n',
          model.getLineContent(4),
          '\n',
          model.getLineContent(5),
        ),
    )[0];
    const bounds = statementHighlightBounds(model, slice);
    expect(bounds.startColumn).toBe(1);
    expect(bounds.endColumn).toBe('    select *'.length + 1);
    expect(bounds.endLineNumber).toBe(5);
  });
});

describe('splitSqlStatements with tree-sitter', () => {
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

  it('splits via tree-sitter statement nodes', async () => {
    const p = await setup();
    const slices = splitSqlStatements('SELECT 1; SELECT 2', p);
    expect(slices.length).toBe(2);
    expect(slices[0].text).toBe('SELECT 1');
    expect(slices[1].text).toBe('SELECT 2');
  });

  it('finds current statement via tree-sitter', async () => {
    const p = await setup();
    const sql = 'SELECT 1; SELECT 2';
    const offset = sql.lastIndexOf('2');
    const slice = findStatementAtOffset(sql, offset, p);
    expect(slice?.text).toBe('SELECT 2');
  });

  it('falls back to lexer when tree-sitter truncates complex SQL', async () => {
    const p = await setup();
    const sql = `select
    *,
    case
        when metrics.score < 0.2
            and metrics.category = 'A'
        then 'B'
        else metrics.category
    end as category,
from read_parquet('/tmp/demo/示例数据-2026-v4.parquet')
;`;
    const offset = sql.indexOf('read_parquet');
    const slice = findStatementAtOffset(sql, offset, p);
    expect(slice?.text).toContain('read_parquet(');
    expect(slice?.text).toContain('示例数据');
    expect(slice?.text).toContain('.parquet');
  });

  it('includes outer from/group when cursor is in CTE with clause', async () => {
    const p = await setup();
    const sql = `with
    a as (
        select
            *,
            case
                when metrics.score < 0.2 and metrics.label = 'A'
                then 'B'
                else metrics.label
            end as label,
        from read_parquet('/tmp/demo/示例数据-2026-v4.parquet')
    )
select
    sum(kind = 'X' and label = 'Y') as col_a,
    sum(kind != 'X' and label = 'Z') as col_b,
    col_a / sum(kind = 'X') as rate_a,
    col_b / sum(kind != 'X') as rate_b,
from a
group by all
;`;
    const offset = sql.indexOf('rate_b');
    const slice = findStatementAtOffset(sql, offset, p);
    expect(slice?.text).toContain('from a');
    expect(slice?.text).toContain('group by all');
    expect(slice?.text).toContain('with');
  });
});
