import path from 'path';
import { describe, expect, it } from 'vitest';

import { file_path_to_function } from './analyze';

// ── file_path_to_function ─────────────────────────────────────────

describe('file_path_to_function', () => {
  it('converts parquet path', () => {
    expect(file_path_to_function('data.parquet')).toBe(
      "read_parquet('data.parquet')",
    );
  });

  it('converts csv path', () => {
    expect(file_path_to_function('data.csv')).toBe("read_csv('data.csv')");
  });

  it('converts tsv path', () => {
    expect(file_path_to_function('data.tsv')).toBe(
      "read_csv('data.tsv', delim='\\t')",
    );
  });

  it('converts json path', () => {
    expect(file_path_to_function('data.json')).toBe("read_json('data.json')");
  });

  it('converts jsonl path', () => {
    expect(file_path_to_function('data.jsonl')).toBe(
      "read_json('data.jsonl')",
    );
  });

  it('converts xlsx path', () => {
    expect(file_path_to_function('data.xlsx')).toBe("read_xlsx('data.xlsx')");
  });

  it('handles absolute paths', () => {
    expect(file_path_to_function('D:/data/file.parquet')).toBe(
      "read_parquet('D:/data/file.parquet')",
    );
  });

  it('handles relative paths', () => {
    expect(file_path_to_function('./data/file.csv')).toBe(
      "read_csv('./data/file.csv')",
    );
  });

  it('wraps unknown extensions in quotes', () => {
    expect(file_path_to_function('data.txt')).toBe("'data.txt'");
  });
});

// ── get_tables with file references ──────────────────────────────

describe('get_tables', () => {
  // These tests require the tree-sitter WASM parser.
  // They run in vitest with environment: 'node'.
  let parser: InstanceType<typeof import('./index').Parser>;
  let get_tables: typeof import('./analyze').get_tables;

  async function setup() {
    if (!parser) {
      const { Parser: _Parser, Language, Query: _Query } = await import('web-tree-sitter');
      await _Parser.init();
      const p = new _Parser();
      // Resolve WASM from project node_modules
      const wasmPath = path.resolve(
        process.cwd(),
        'node_modules/@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm',
      );
      const lang = await Language.load(wasmPath);
      p.setLanguage(lang);
      // Add the query method that the custom Parser class provides
      (p as any).query = (source: string) => new _Query(lang, source);
      parser = p as any;
      const analyze = await import('./analyze');
      get_tables = analyze.get_tables;
    }
    return parser;
  }

  it('detects read_parquet invocation', async () => {
    const parser = await setup();
    const sql = "select * from read_parquet('data.parquet')";
    const tree = parser.parse(sql)!;
    const fromNode = tree.rootNode
      .descendantsOfType('from')
      .find((n) => n.parent?.type === 'statement');
    expect(fromNode).toBeTruthy();

    const tables = get_tables(parser, fromNode!);
    expect(tables.length).toBeGreaterThanOrEqual(1);

    const fileTable = tables.find((t) => t.fileFunction);
    expect(fileTable).toBeTruthy();
    expect(fileTable!.fileFunction).toBe("read_parquet('data.parquet')");
  });

  it('detects read_parquet with alias', async () => {
    const parser = await setup();
    const sql = "select t.* from read_parquet('data.parquet') AS t";
    const tree = parser.parse(sql)!;
    const fromNode = tree.rootNode
      .descendantsOfType('from')
      .find((n) => n.parent?.type === 'statement');
    expect(fromNode).toBeTruthy();

    const tables = get_tables(parser, fromNode!);
    const fileTable = tables.find((t) => t.fileFunction);
    expect(fileTable).toBeTruthy();
    expect(fileTable!.alias).toBe('t');
    expect(fileTable!.fileFunction).toBe("read_parquet('data.parquet')");
  });

  it('detects table_path literal', async () => {
    const parser = await setup();
    const sql = "select * from 'data.parquet'";
    const tree = parser.parse(sql)!;
    const fromNode = tree.rootNode
      .descendantsOfType('from')
      .find((n) => n.parent?.type === 'statement');
    expect(fromNode).toBeTruthy();

    const tables = get_tables(parser, fromNode!);
    const fileTable = tables.find((t) => t.fileFunction);
    expect(fileTable).toBeTruthy();
    expect(fileTable!.fileFunction).toBe("read_parquet('data.parquet')");
  });

  it('regular table has no fileFunction', async () => {
    const parser = await setup();
    const sql = 'select * from my_table';
    const tree = parser.parse(sql)!;
    const fromNode = tree.rootNode
      .descendantsOfType('from')
      .find((n) => n.parent?.type === 'statement');
    expect(fromNode).toBeTruthy();

    const tables = get_tables(parser, fromNode!);
    expect(tables.length).toBe(1);
    expect(tables[0].name).toBe('my_table');
    expect(tables[0].fileFunction).toBeFalsy();
  });
});

// ── analyzeContext integration ────────────────────────────────────

describe('analyzeContext with file references', () => {
  let parser: InstanceType<typeof import('./index').Parser>;
  let analyzeContext: typeof import('./analyze').analyzeContext;

  async function setup() {
    if (!parser) {
      const { Parser: _Parser, Language, Query: _Query } = await import('web-tree-sitter');
      await _Parser.init();
      const p = new _Parser();
      const wasmPath = path.resolve(
        process.cwd(),
        'node_modules/@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm',
      );
      const lang = await Language.load(wasmPath);
      p.setLanguage(lang);
      (p as any).query = (source: string) => new _Query(lang, source);
      parser = p as any;
      const analyze = await import('./analyze');
      analyzeContext = analyze.analyzeContext;
    }
    return parser;
  }

  it('SELECT context from read_parquet includes fileFunction in tablesInScope', async () => {
    const p = await setup();
    // Simulate cursor after "s" in: select *, s from read_parquet('data.parquet')
    const code = "select *, s from read_parquet('data.parquet')";
    const offset = code.indexOf('s from'); // cursor at 's'
    const sql = code.slice(0, offset) + '_' + code.slice(offset); // insert underscore
    const ctx = analyzeContext(p, sql, offset);
    expect(ctx).toBeTruthy();
    expect(ctx!.type).toBe('COLUMN');
    expect(ctx!.tablesInScope).toBeTruthy();
    expect(ctx!.tablesInScope!.length).toBeGreaterThanOrEqual(1);

    const fileTable = ctx!.tablesInScope!.find((t) => t.fileFunction);
    expect(fileTable).toBeTruthy();
    expect(fileTable!.fileFunction).toBe("read_parquet('data.parquet')");
  });

  it('SELECT context from alias uses fileFunction table', async () => {
    const p = await setup();
    const code = "select t.s from read_parquet('data.parquet') as t";
    const offset = code.indexOf('.s') + 1; // cursor at 's'
    const sql = code.slice(0, offset) + '_' + code.slice(offset);
    const ctx = analyzeContext(p, sql, offset);
    expect(ctx).toBeTruthy();
    expect(ctx!.type).toBe('COLUMN');
    expect(ctx!.tablesInScope).toBeTruthy();

    const fileTable = ctx!.tablesInScope!.find((t) => t.fileFunction);
    expect(fileTable).toBeTruthy();
    expect(fileTable!.alias).toBe('t');
  });

  it('SELECT context from table_path literal includes fileFunction', async () => {
    const p = await setup();
    const code = "select *, s from 'data.parquet'";
    const offset = code.indexOf('s from');
    const sql = code.slice(0, offset) + '_' + code.slice(offset);
    const ctx = analyzeContext(p, sql, offset);
    expect(ctx).toBeTruthy();
    expect(ctx!.type).toBe('COLUMN');

    const fileTable = ctx!.tablesInScope?.find((t) => t.fileFunction);
    expect(fileTable).toBeTruthy();
  });

  it('debug: inspect invocation AST', async () => {
    const p = await setup();
    const tree = p.parse("select *, s_ from read_parquet('data.parquet')")!;
    const invocations = tree.rootNode.descendantsOfType('invocation');
    for (const inv of invocations) {
      console.log('invocation node:', inv.type, 'children:', inv.childCount);
      for (let i = 0; i < inv.childCount; i++) {
        const child = inv.child(i)!;
        const field = inv.fieldNameForChild(i);
        console.log(`  [${i}] type=${child.type} named=${child.isNamed} field=${field} text=${JSON.stringify(child.text)}`);
        if (child.type === 'object_reference' || child.type === 'term') {
          for (let j = 0; j < child.childCount; j++) {
            const gc = child.child(j)!;
            const gf = child.fieldNameForChild(j);
            console.log(`    [${j}] type=${gc.type} named=${gc.isNamed} field=${gf} text=${JSON.stringify(gc.text)}`);
          }
        }
      }
    }
    expect(invocations.length).toBeGreaterThanOrEqual(1);
  });
});
