import {
  BeforeMount,
  Editor,
  EditorProps,
  OnMount,
} from '@monaco-editor/react';
import { msg } from '@lingui/core/macro';

import { ForwardedRef, forwardRef, useEffect, useImperativeHandle } from 'react';

import { CompleteMetaType } from '@/ast/analyze';
import { useRegister } from '@/components/editor/useRegister';
import { i18n } from '@/i18n';
import { DialectType } from '@/stores/dbList';
import {
  useCodeFontFamily,
  useCodeFontSize,
  useEditorTheme,
} from '@/stores/setting';

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
  formatDocument: () => Promise<void>;
  formatSelection: () => Promise<void>;
  hasSelection: () => boolean;
}

type OnMountParams = Parameters<OnMount>;

const MonacoEditor = forwardRef<
  EditorRef,
  EditorProps & {
    completeMeta?: CompleteMetaType;
    dialect?: DialectType;
    onRun: () => void;
  }
>(function MonacoEditor(
  { completeMeta, dialect, ...props },
  ref: ForwardedRef<EditorRef>,
) {
  const { handleEditorDidMount, editorRef, instanceId } = useRegister({
    completeMeta,
    dialect,
  });

  const handleBeforeMount: BeforeMount = (_monaco) => {};

  const handleMount: OnMount = (editor, monaco) => {
    props.onMount?.(editor, monaco);
    handleEditorDidMount(editor, monaco);

    editor.addAction({
      id: `${instanceId.current}.run`,
      label: i18n._(msg`Run`),
      contextMenuGroupId: 'navigation',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        props.onRun?.();
      },
    });

    editor.addAction({
      id: `${instanceId.current}.format`,
      label: i18n._(msg`Format SQL`),
      contextMenuGroupId: '1_modification',
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      ],
      run: (ed) => {
        void ed.getAction('editor.action.formatDocument')?.run();
      },
    });

    // Chord: Mod+K Mod+F — format selection (matches registry editor.formatSelection)
    editor.addAction({
      id: `${instanceId.current}.formatSelection`,
      label: i18n._(msg`Format Selection`),
      contextMenuGroupId: '1_modification',
      keybindings: [
        monaco.KeyMod.chord(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
        ),
      ],
      run: (ed) => {
        void ed.getAction('editor.action.formatSelection')?.run();
      },
    });
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
      return editorRef.current?.getValue();
    },

    hasSelection: () => {
      const editor = editorRef.current;
      const selection = editor?.getSelection();
      return !!selection && !selection.isEmpty();
    },

    formatDocument: async () => {
      await editorRef.current?.getAction('editor.action.formatDocument')?.run();
    },

    formatSelection: async () => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        return;
      }
      await editor.getAction('editor.action.formatSelection')?.run();
    },
  }));

  const theme = useEditorTheme();
  const codeFontFamily = useCodeFontFamily();
  const codeFontSize = useCodeFontSize();

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontFamily: codeFontFamily,
      fontSize: codeFontSize,
    });
  }, [codeFontFamily, codeFontSize, editorRef]);

  return (
    <Editor
      theme={theme}
      defaultLanguage="sql"
      language={props.language ?? 'sql'}
      height="100%"
      {...props}
      options={{
        minimap: {
          enabled: true,
        },
        fontFamily: codeFontFamily,
        fontSize: codeFontSize,
        ...props.options,
      }}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
    />
  );
});

export default MonacoEditor;
