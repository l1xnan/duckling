import { msg } from '@lingui/core/macro';
import { BeforeMount, Editor, EditorProps, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
} from 'react';

import { CompleteMetaType } from '@/ast/analyze';
import { useRegister } from '@/components/editor/useRegister';
import { i18n } from '@/i18n';
import { cursorStateFromMonaco } from '@/lib/editorCursorFormat';
import { DialectType } from '@/stores/dbList';
import { useEditorCursorStore } from '@/stores/editorCursor';
import { useEditorSqlErrorStore } from '@/stores/editorSqlError';
import {
  useCodeEditorMinimap,
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
    /** When set, cursor/selection is published for the status bar. */
    editorId?: string;
  }
>(function MonacoEditor(
  { completeMeta, dialect, editorId, ...props },
  ref: ForwardedRef<EditorRef>,
) {
  const { handleEditorDidMount, editorRef, instanceId } = useRegister({
    completeMeta,
    dialect,
  });

  useEffect(() => {
    if (!editorId) {
      return;
    }
    return () => {
      useEditorCursorStore.getState().clear(editorId);
      useEditorSqlErrorStore.getState().clear(editorId);
    };
  }, [editorId]);

  // Apply / clear SQL run-error markers from backend sqlparser location.
  useEffect(() => {
    if (!editorId) {
      return;
    }
    const apply = (err: ReturnType<typeof useEditorSqlErrorStore.getState>['byEditor'][string] | undefined) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) {
        return;
      }
      const owner = 'sql-run-error';
      if (!err) {
        monaco.editor.setModelMarkers(model, owner, []);
        return;
      }
      const line = Math.min(err.line, model.getLineCount());
      const maxCol = model.getLineMaxColumn(line);
      const col = Math.min(Math.max(1, err.column), maxCol);
      monaco.editor.setModelMarkers(model, owner, [
        {
          severity: monaco.MarkerSeverity.Error,
          message: err.message,
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: maxCol,
        },
      ]);
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: col });
    };

    apply(useEditorSqlErrorStore.getState().byEditor[editorId]);
    return useEditorSqlErrorStore.subscribe((s, prev) => {
      if (s.byEditor[editorId] === prev.byEditor[editorId]) {
        return;
      }
      apply(s.byEditor[editorId]);
    });
  }, [editorId, editorRef]);

  const handleBeforeMount: BeforeMount = (_monaco) => {};

  const handleMount: OnMount = (editor, monaco) => {
    props.onMount?.(editor, monaco);
    handleEditorDidMount(editor, monaco);

    if (editorId) {
      let raf = 0;
      const publish = () => {
        const pos = editor.getPosition();
        if (!pos) {
          return;
        }
        const selection = editor.getSelection();
        const model = editor.getModel();
        const selectedText =
          selection && !selection.isEmpty() && model
            ? model.getValueInRange(selection)
            : undefined;
        useEditorCursorStore.getState().setCursor(
          editorId,
          cursorStateFromMonaco({
            lineNumber: pos.lineNumber,
            column: pos.column,
            selection,
            selectedText,
          }),
        );
      };
      const schedule = () => {
        if (raf) {
          cancelAnimationFrame(raf);
        }
        raf = requestAnimationFrame(() => {
          raf = 0;
          publish();
        });
      };
      publish();
      const d1 = editor.onDidChangeCursorPosition(schedule);
      const d2 = editor.onDidChangeCursorSelection(schedule);
      editor.onDidDispose(() => {
        if (raf) {
          cancelAnimationFrame(raf);
        }
        d1.dispose();
        d2.dispose();
        useEditorCursorStore.getState().clear(editorId);
      });
    }

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
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
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
  const codeEditorMinimap = useCodeEditorMinimap();

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontFamily: codeFontFamily,
      fontSize: codeFontSize,
      minimap: { enabled: codeEditorMinimap },
    });
  }, [codeFontFamily, codeFontSize, codeEditorMinimap, editorRef]);

  return (
    <Editor
      theme={theme}
      defaultLanguage="sql"
      language={props.language ?? 'sql'}
      height="100%"
      keepCurrentModel
      {...props}
      options={{
        minimap: {
          enabled: codeEditorMinimap,
        },
        fontFamily: codeFontFamily,
        fontSize: codeFontSize,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        ...props.options,
      }}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
    />
  );
});

export default MonacoEditor;
