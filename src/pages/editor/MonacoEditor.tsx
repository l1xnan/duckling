import * as B from '@mobily/ts-belt';
import Editor, { EditorProps, Monaco, OnMount } from '@monaco-editor/react';
import { useTheme } from '@mui/material';
import { ForwardedRef, forwardRef, useImperativeHandle, useRef } from 'react';

import { isDarkTheme } from '@/utils';

import type monaco from 'monaco-editor/esm/vs/editor/editor.api';

interface MonacoEditorProps extends EditorProps {}

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}

type OnMountParams = Parameters<OnMount>;

function parseSqlAndFindTableNameAndAliases(sql: string) {
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

// https://codesandbox.io/p/sandbox/monaco-sql-sfot6x
function registerCompletion(monaco: Monaco, tableSchema: TableSchemaType[]) {
  monaco.languages.registerCompletionItemProvider('*', {
    provideCompletionItems: (model, position, _context, _cancelationToken) => {
      const word = model.getWordUntilPosition(position);

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const schemaTableNames = B.pipe(
        tableSchema,
        B.A.map((d) => d.table_name),
        B.A.uniq,
      );

      const schemaTableNamesSet = new Set(schemaTableNames);
      const suggestions: monaco.languages.CompletionItem[] = [];

      const fullQueryText = model.getValue();

      const tableNamesAndAliases = new Map(
        parseSqlAndFindTableNameAndAliases(fullQueryText).map(
          ({ table_name, alias }) => [alias, table_name],
        ),
      );

      const thisLine = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const thisToken = thisLine.trim().split(' ').slice(-1)?.[0] || '';

      const lastTokenBeforeSpace = /\s?(\w+)\s+\w+$/.exec(thisLine.trim())?.[1];
      const lastTokenBeforeDot = /(\w+)\.\w*$/.exec(thisToken)?.[1];

      console.log(
        tableNamesAndAliases,
        thisToken,
        lastTokenBeforeSpace,
        lastTokenBeforeDot,
      );

      if (
        lastTokenBeforeSpace &&
        /from|join|update|into/.test(lastTokenBeforeSpace)
      ) {
        suggestions.push(
          ...schemaTableNames.map((table_name) => ({
            label: table_name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: table_name,
            range,
          })),
        );
      }

      if (lastTokenBeforeDot) {
        let table_name = null as string | null;
        if (schemaTableNamesSet.has(lastTokenBeforeDot)) {
          table_name = lastTokenBeforeDot;
        } else if (tableNamesAndAliases.get(lastTokenBeforeDot)) {
          table_name = tableNamesAndAliases.get(lastTokenBeforeDot) as string;
        }
        if (table_name) {
          suggestions.push(
            ...tableSchema
              .filter((d) => d.table_name === table_name)
              .map(({ column_name }) => ({
                label: column_name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: column_name,
                range,
              })),
          );
        }
      }

      return {
        suggestions: B.pipe(
          suggestions,
          B.A.uniqBy((s) => s.insertText),
        ) as monaco.languages.CompletionItem[],
      };
    },
  });
}
export type TableSchemaType = { table_name: string; column_name: string };

const MonacoEditor = forwardRef<
  EditorRef,
  MonacoEditorProps & {
    tableSchema?: TableSchemaType[];
  }
>(function MonacoEditor(props, ref: ForwardedRef<EditorRef>) {
  const editorRef = useRef<OnMountParams[0] | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {},
    });
    props.onMount?.(editor, monaco);

    registerCompletion(monaco, props.tableSchema ?? []);
  };

  useImperativeHandle(ref, () => ({
    editor: () => editorRef.current,

    getSelectionText: () => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const selection = editor.getSelection();
      if (selection) {
        return editor.getModel()?.getValueInRange(selection);
      }
      return;
    },

    getValue: () => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      return editor.getValue();
    },
  }));
  const theme = useTheme();

  return (
    <Editor
      theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
      defaultLanguage="sql"
      height="100%"
      options={{
        minimap: {
          enabled: true,
        },
      }}
      {...props}
      onMount={handleMount}
    />
  );
});

export default MonacoEditor;
