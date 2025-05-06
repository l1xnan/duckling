import Editor, {
  BeforeMount,
  EditorProps,
  Monaco,
  OnMount,
  useMonaco,
} from '@monaco-editor/react';
import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { formatSQL } from '@/api';
import { useRegister } from '@/components/editor/useRegister';
import { useTheme } from '@/hooks/theme-provider';
import { isDarkTheme } from '@/utils';
import type monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { format } from 'sql-formatter';
import {
  monacoRegisterProvider,
  parseSqlAndFindTableNameAndAliases,
} from './completion';

interface MonacoEditorProps extends EditorProps {}

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}

type OnMountParams = Parameters<OnMount>;

// https://codesandbox.io/p/sandbox/monaco-sql-sfot6x
function registerCompletion(monaco: Monaco, tableSchema: TableSchemaType) {
  monaco.languages.registerCompletionItemProvider('*', {
    provideCompletionItems: (model, position, _context, _cancelationToken) => {
      const word = model.getWordUntilPosition(position);

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const schemaTableNames = Object.keys(tableSchema);

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
            ...tableSchema?.[table_name]?.map((column_name) => ({
              label: column_name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: column_name,
              range,
            })),
          );
        }
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

export type TableSchemaType = Record<string, string[]>;

const MonacoEditor = forwardRef<
  EditorRef,
  MonacoEditorProps & {
    tableSchema?: TableSchemaType;
    onRun: () => void;
  }
>(function MonacoEditor(props, ref: ForwardedRef<EditorRef>) {
  const editorRef = useRef<OnMountParams[0] | null>(null);
  const monaco = useMonaco();
  const { handleEditorDidMount } = useRegister({
    tableSchema: props.tableSchema,
  });
  const handleBeforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {},
    });
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    handleEditorDidMount?.(editor, monaco);
    props.onMount?.(editor, monaco);
  };

  useEffect(() => {
    const disposable1 = monaco?.editor.addEditorAction({
      id: 'editor.run',
      label: 'Run',
      contextMenuGroupId: 'navigation',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        props.onRun?.();
      },
    });

    const disposable2 = monaco?.editor.addCommand({
      id: 'editor.run',
      run: () => {
        props.onRun?.();
      },
    });

    return () => {
      disposable1?.dispose();
      disposable2?.dispose();
    };
  }, [props.onRun, monaco]);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    monacoRegisterProvider(monaco, props.tableSchema);
    // registerCompletion(monaco, props.tableSchema ?? {});
  }, [monaco, props.tableSchema]);

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
      language={props.language ?? 'sql'}
      height="100%"
      options={{
        minimap: {
          enabled: true,
        },
      }}
      {...props}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
    />
  );
});

export default MonacoEditor;
