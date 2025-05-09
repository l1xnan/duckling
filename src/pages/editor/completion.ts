import { Parser } from '@/ast';
import { analyzeContext, insertUnderscore } from '@/ast/analyze';
import { completionRegistry } from '@/components/editor/monacoConfig';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Position } from 'monaco-editor/esm/vs/editor/editor.api';

const parser = await Parser.load();

export function parseSqlAndFindTableNameAndAliases(sql: string) {
  const regex =
    /\b(?:FROM|JOIN)\s+([^\s.]+(?:\.[^\s.]+)?)\s*(?:AS)?\s*([^\s,]+)?/gi;
  const tables = [];

  // eslint-disable-next-line no-constant-condition
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

export function handleProvideCompletionItems(
  model: monaco.editor.ITextModel,
  position: Position,
) {
  const modelUri = model.uri.toString();
  const completeMeta = completionRegistry.get(modelUri);
  const { prefixCode, tables: tableSchema } = completeMeta ?? {};

  console.log('completeMeta:', completeMeta);
  const word = model.getWordUntilPosition(position);
  const code = model.getValue();

  const offset = model.getOffsetAt(position);
  console.log(
    'code',
    `"${code}"`,
    word,
    'position:',
    position,
    'offset:',
    offset,
  );

  const sql = prefixCode
    ? prefixCode + code + '_'
    : insertUnderscore(code, offset);

  console.log('sql:', sql);

  const suggestions: monaco.languages.CompletionItem[] = [];
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };

  const ctx = analyzeContext(parser, sql, offset);
  if (ctx?.scope === 'table') {
    suggestions.push(
      ...Object.keys(tableSchema ?? {})?.map((table_name) => ({
        label: table_name,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: /\s/.test(table_name) ? `\`${table_name}\`` : table_name,
        range,
      })),
    );
    console.log('from suggestions', suggestions);
  } else if (ctx?.scope === 'column') {
    const columns: string[] = [];
    ctx.tables?.forEach((table) => {
      columns.push(...(tableSchema?.[table.table ?? ''] ?? []));
    });

    suggestions.push(
      ...columns.map((column_name) => {
        return {
          label: column_name,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: /\s/.test(column_name) ? `\`${column_name}\`` : column_name,
          range,
        };
      }),
    );
    console.log('select suggestions', suggestions);
  } else if (ctx?.scope === 'keyword') {
    const kind = monaco.languages.CompletionItemKind.Keyword;
  } else if (ctx?.scope === 'function') {
    const kind = monaco.languages.CompletionItemKind.Function;
  } else if (ctx?.scope === 'database') {
    const kind = monaco.languages.CompletionItemKind.Module;
  }

  return { suggestions };
}
