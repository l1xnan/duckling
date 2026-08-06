import {
  analyzeContext,
  insertUnderscore,
  makeSuggestions,
  ContextType as SqlContextType,
} from '@/ast/analyze';
import { getSqlParser } from '@/ast/parserSingleton';
import { showColumns } from '@/api';
import {
  buildFunctionSuggestions,
  buildKeywordSuggestions,
  functionsForDialect,
  unionSuggestions,
} from '@/components/editor/dialectSuggestions';
import { completionRegistry, dialectRegistry } from '@/components/editor/monacoConfig';
import type { DialectRef } from '@/lib/connectionRef';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Position } from 'monaco-editor/esm/vs/editor/editor.api';

const parser = await getSqlParser();

// ── File columns cache ───────────────────────────────────────────────

const fileColumnsCache = new Map<string, { name: string; type: string }[]>();

async function getFileColumns(
  tableExpr: string,
  dialect: DialectRef,
): Promise<{ name: string; type: string }[]> {
  const cacheKey = `${(dialect as any).connectionId ?? ''}::${tableExpr}`;
  const cached = fileColumnsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await showColumns(tableExpr, dialect);
    const cols: { name: string; type: string }[] = data.map((row: any) => ({
      name: row.column_name ?? row.name ?? Object.values(row)[0],
      type: row.column_type ?? row.type ?? Object.values(row)[1],
    }));
    fileColumnsCache.set(cacheKey, cols);
    return cols;
  } catch (e) {
    console.warn('getFileColumns failed:', e);
    return [];
  }
}

export function parseSqlAndFindTableNameAndAliases(sql: string) {
  const regex =
    /\b(?:FROM|JOIN)\s+([^\s.]+(?:\.[^\s.]+)?)\s*(?:AS)?\s*([^\s,]+)?/gi;
  const tables = [];

  while (true) {
    const match = regex.exec(sql);
    if (!match) {
      break;
    }
    const table_name = match[1];
    if (!/\(/.test(table_name)) {
      // exclude function calls
      let alias = match[2] as string | null;
      if (alias && /on|where|inner|left|right|join/.test(alias)) {
        alias = null;
      }
      tables.push({
        table_name,
        alias: alias || table_name,
      });
    }
  }

  return tables;
}

export async function handleProvideCompletionItems(
  model: monaco.editor.ITextModel,
  position: Position,
  context?: monaco.languages.CompletionContext,
) {
  const modelUri = model.uri.toString();
  const completeMeta = completionRegistry.get(modelUri);
  const { prefixCode = '' } = completeMeta ?? {};

  const word = model.getWordUntilPosition(position);
  const code = model.getValue();

  let offset = model.getOffsetAt(position);

  const sql = prefixCode + insertUnderscore(code, offset);
  offset += prefixCode.length;

  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };

  const dialect =
    dialectRegistry.get(modelUri) ??
    (completeMeta?.dialect as { dialect?: string } | undefined)?.dialect ??
    'duckdb';

  const keywords =
    completeMeta?.keywords && completeMeta.keywords.length > 0
      ? completeMeta.keywords
      : undefined;
  const keywordItems = buildKeywordSuggestions(keywords);
  const functionItems = buildFunctionSuggestions(
    unionFunctions(completeMeta, dialect),
  );

  const ctx = analyzeContext(parser, sql, offset);

  // No recognizable clause context (statement start, bare keyword, etc.) →
  // fall back to keywords + functions so typing `SEL` / `read_` still pops.
  if (!ctx) {
    // Avoid auto-popping on Enter/space on an empty line (no word to match);
    // explicit Ctrl+Space still shows the fallback list.
    if (
      word.word === '' &&
      context?.triggerKind !== monaco.languages.CompletionTriggerKind.Invoke
    ) {
      return { suggestions: [] };
    }
    return {
      suggestions: toCompletionItems(
        unionSuggestions(functionItems, keywordItems),
        range,
      ),
    };
  }

  const items = makeSuggestions(ctx, completeMeta ?? {});

  // Append columns from file references (read_xxx('...')) if any
  if (ctx.type === SqlContextType.COLUMN && completeMeta?.dialect) {
    const fileTables = ctx.tablesInScope?.filter((t) => t.fileFunction) ?? [];
    if (fileTables.length > 0) {
      const fileCols = await Promise.all(
        fileTables.map((t) => getFileColumns(t.fileFunction!, completeMeta.dialect!)),
      );
      for (const cols of fileCols) {
        for (const { name, type } of cols) {
          items.push({ label: name, type: SqlContextType.COLUMN, insertText: name, detail: type });
        }
      }
    }
  }

  const merged = unionSuggestions(items, [
    ...keywordItems,
    ...(ctx.type === SqlContextType.COLUMN
      ? functionItems
      : ctx.type === SqlContextType.TABLE
        ? buildFileFunctionItems(dialect)
        : []),
  ]);

  return { suggestions: toCompletionItems(merged, range) };
}

const FILE_FUNCTIONS = [
  'read_parquet',
  'read_csv',
  'read_tsv',
  'read_json',
  'read_json_objects',
  'read_xlsx',
  'read_text',
  'read_blob',
  'glob',
];

/** File-source functions for FROM clauses (DuckDB engine dialects). */
function buildFileFunctionItems(dialect: string) {
  if (dialect !== 'duckdb' && dialect !== 'quack' && dialect !== 'folder' && dialect !== 'file') {
    return [];
  }
  return buildFunctionSuggestions(FILE_FUNCTIONS);
}

/** DB-reported functions unioned with the curated per-dialect fallback. */
function unionFunctions(
  completeMeta: { functions?: string[] } | undefined,
  dialect: string,
): string[] {
  const db = completeMeta?.functions ?? [];
  const curated = functionsForDialect(dialect);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...db, ...curated]) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(name);
  }
  return out;
}

function toCompletionItems(
  items: ReturnType<typeof unionSuggestions>,
  range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number },
) {
  return items.map(({ label, type, insertText, detail, snippet }) => {
    const item: monaco.languages.CompletionItem = {
      label,
      kind: convertKind(type),
      insertText: insertText ?? label,
      detail,
      range,
    };
    if (snippet) {
      item.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
    }
    if (type === SqlContextType.KEYWORD) {
      // Keep identifiers (tables/columns) ranked above keywords.
      item.sortText = `z-${label}`;
    }
    return item;
  });
}

function convertKind(type: SqlContextType) {
  if (type == SqlContextType.TABLE) {
    return monaco.languages.CompletionItemKind.Class;
  }
  if (type == SqlContextType.COLUMN) {
    return monaco.languages.CompletionItemKind.Field;
  }
  if (type == SqlContextType.KEYWORD) {
    return monaco.languages.CompletionItemKind.Keyword;
  }
  if (type == SqlContextType.FUNCTION) {
    return monaco.languages.CompletionItemKind.Function;
  }
  if (type == SqlContextType.DATABASE) {
    return monaco.languages.CompletionItemKind.Module;
  }
  return monaco.languages.CompletionItemKind.Field;
}
