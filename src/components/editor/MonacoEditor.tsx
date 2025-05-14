import Editor, {
  BeforeMount,
  EditorProps,
  OnMount,
  useMonaco,
} from '@monaco-editor/react';
import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { useRegister } from '@/components/editor/useRegister';
import { useTheme } from '@/hooks/theme-provider';
import { isDarkTheme } from '@/utils';
import { nanoid } from 'nanoid';


export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}

type OnMountParams = Parameters<OnMount>;

export type CompleteMetaType = {
  prefixCode?: string;
  tables?: Record<string, Record<string, string[]>>;
  keywords?: string[];
  functions?: string[];
  operators?: string[];
};

const MonacoEditor = forwardRef<
  EditorRef,
  EditorProps & {
    completeMeta?: CompleteMetaType;
    onRun: () => void;
  }
>(function MonacoEditor(
  { completeMeta, ...props },
  ref: ForwardedRef<EditorRef>,
) {
  const editorRef = useRef<OnMountParams[0] | null>(null);
  const monaco = useMonaco();

  const instanceId = useMemo(() => nanoid(), []);

  const { handleEditorDidMount } = useRegister({ instanceId, completeMeta });

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
