import {
  BeforeMount,
  Editor,
  EditorProps,
  OnMount,
} from '@monaco-editor/react';
import {
  ForwardedRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { CompleteMetaType } from '@/ast/analyze';
import { useRegister } from '@/components/editor/useRegister';
import { useEditorTheme } from '@/stores/setting';
import { nanoid } from 'nanoid';

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}

type OnMountParams = Parameters<OnMount>;

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

  const instanceId = useMemo(() => nanoid(), []);

  const { handleEditorDidMount } = useRegister({ instanceId, completeMeta });

  const handleBeforeMount: BeforeMount = (_monaco) => {};

  const handleMount: OnMount = (editor, monaco) => {
    props.onMount?.(editor, monaco);
    handleEditorDidMount?.(editor, monaco);

    editorRef.current = editor;

    const action = editor.addAction({
      id: `${instanceId}.run}`,
      label: 'Run',
      contextMenuGroupId: 'navigation',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        props.onRun?.();
      },
    });

    return () => {
      action.dispose();
    };
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

  const theme = useEditorTheme();

  return (
    <Editor
      theme={theme}
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
