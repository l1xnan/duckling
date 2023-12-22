import Editor, { EditorProps, Monaco, OnMount } from '@monaco-editor/react';
import { useTheme } from '@mui/material';
import { ForwardedRef, forwardRef, useImperativeHandle, useRef } from 'react';

import { isDarkTheme } from '@/utils';

interface MonacoEditorProps extends EditorProps {}

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}

type OnMountParams = Parameters<OnMount>;

// https://codesandbox.io/p/sandbox/monaco-sql-sfot6x
function registerCompletion(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider('*', {
    provideCompletionItems: (model, position, context, cancelationToken) => {
      return {
        suggestions: [],
      };
    },
  });
}

const MonacoEditor = forwardRef<EditorRef, MonacoEditorProps>(
  function MonacoEditor(
    props: MonacoEditorProps,
    ref: ForwardedRef<EditorRef>,
  ) {
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

      registerCompletion(monaco);
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
  },
);

export default MonacoEditor;
