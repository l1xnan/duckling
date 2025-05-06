import { Monaco } from '@monaco-editor/react';

import { formatSQL } from '@/api';
import { Parser } from '@/ast';
import { analyzeContext, insertUnderscore } from '@/ast/analyze';
import { completionRegistry } from '@/components/editor/monacoConfig';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Position } from 'monaco-editor/esm/vs/editor/editor.api';
import { format } from 'sql-formatter';
import { TableSchemaType } from './MonacoEditor';

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
export function monacoRegisterProvider(
  monaco?: Monaco,
  tableSchema?: TableSchemaType | null,
) {
  if (!monaco) {
    return;
  }

  monaco.languages.registerCompletionItemProvider('*', {
    triggerCharacters: ['.', ' ', '(', '\n'], // Trigger completion on dot, space, and parenthesis
    provideCompletionItems: (model, position, _context, _cancelationToken) => {
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

      const suggestions: monaco.languages.CompletionItem[] = [];
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const sql = insertUnderscore(code, offset);
      const ctx = analyzeContext(parser, sql, offset);
      if (ctx?.scope === 'table') {
        suggestions.push(
          ...Object.keys(tableSchema ?? {})?.map((table_name) => ({
            label: table_name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table_name,
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
          ...columns.map((table_name) => ({
            label: table_name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: table_name,
            range,
          })),
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
    },
  });

  monaco.languages.registerDocumentFormattingEditProvider('sql', {
    async provideDocumentFormattingEdits(model, _options) {
      const formatted = await formatSQL(model.getValue());
      return [
        {
          range: model.getFullModelRange(),
          text: formatted,
        },
      ];
    },
  });

  // define a range formatting provider
  // select some codes and right click those codes
  // you contextmenu will have an "Format Selection" action
  monaco.languages.registerDocumentRangeFormattingEditProvider('sql', {
    async provideDocumentRangeFormattingEdits(model, range, _options) {
      const formatted = format(model.getValueInRange(range), {
        tabWidth: 2,
      });
      return [
        {
          range: range,
          text: formatted,
        },
      ];
    },
  });
}

export function handleProvideCompletionItems(
  model: monaco.editor.ITextModel,
  position: Position,
) {
  const modelUri = model.uri.toString();
  const tableSchema = completionRegistry.get(modelUri);

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

  const suggestions: monaco.languages.CompletionItem[] = [];
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };

  const sql = insertUnderscore(code, offset);
  const ctx = analyzeContext(parser, sql, offset);
  if (ctx?.scope === 'table') {
    suggestions.push(
      ...Object.keys(tableSchema ?? {})?.map((table_name) => ({
        label: table_name,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: table_name,
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
      ...columns.map((table_name) => ({
        label: table_name,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: table_name,
        range,
      })),
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
