import { Parser } from '@/ast';
import {
  analyzeContext,
  insertUnderscore,
  makeSuggestions,
  ContextType as SqlContextType,
} from '@/ast/analyze';
import { showColumns } from '@/api';
import { completionRegistry } from '@/components/editor/monacoConfig';
import type { DialectRef } from '@/lib/connectionRef';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Position } from 'monaco-editor/esm/vs/editor/editor.api';

const parser = await Parser.load();

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
) {
  const modelUri = model.uri.toString();
  const completeMeta = completionRegistry.get(modelUri);
  const { prefixCode = '' } = completeMeta ?? {};

  console.log('completeMeta:', completeMeta);
  const word = model.getWordUntilPosition(position);
  const code = model.getValue();

  let offset = model.getOffsetAt(position);
  console.log(`code: "${code}", offset: ${offset}`);
  console.log(`word: `, word, `position:`, position);

  const sql = prefixCode + insertUnderscore(code, offset);
  offset += prefixCode.length;

  console.log('sql:', sql);

  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };

  const ctx = analyzeContext(parser, sql, offset);

  if (!ctx || !completeMeta) {
    return;
  }

  const items = makeSuggestions(ctx, completeMeta);

  // Append columns from file references (read_xxx('...')) if any
  if (ctx.type === SqlContextType.COLUMN && completeMeta.dialect) {
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

  const suggestions = items.map(({ label, type, insertText, detail }) => {
    return {
      label,
      kind: convertKind(type),
      insertText: label ?? insertText,
      detail,
      range,
    };
  });

  console.log(suggestions);
  return { suggestions };
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
