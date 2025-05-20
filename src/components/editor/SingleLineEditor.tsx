import { CompleteMetaType } from '@/ast/analyze';
import { Editor, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import { useEditorTheme } from '@/stores/setting';
import { nanoid } from 'nanoid';
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRegister } from './useRegister';

interface SingleLineEditorProps {
  initialValue?: string;
  language?: string;
  className?: string;
  completeMeta?: CompleteMetaType;
  onEnterDown?: (value: string) => void; // 当 Enter 被按下时触发 (可选)
  onChange?: (value: string) => void; // 值变化时触发 (可选)
}

type OnMountParams = Parameters<OnMount>;

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}

const SingleLineMonacoEditor = forwardRef<EditorRef, SingleLineEditorProps>(
  ({ completeMeta, initialValue, ...props }, ref) => {
    const editorRef = useRef<any>(null);
    const [value, setValue] = useState(initialValue ?? '');

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

    const instanceId = useMemo(() => nanoid(), []);
    const { handleEditorDidMount } = useRegister({
      instanceId,
      completeMeta,
    });

    // --- 阻止 Enter 键换行 ---
    const handleEditorMount: OnMount = (editor, mon) => {
      editorRef.current = editor;
      handleEditorDidMount?.(editor, mon);

      // 监听键盘事件
      editor.onKeyDown((e: monaco.IKeyboardEvent) => {
        // 检查是否是 Enter 键 (并且没有按 Shift, Alt, Ctrl, Meta)
        if (
          e.keyCode === mon.KeyCode.Enter &&
          !e.shiftKey &&
          !e.altKey &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          // 阻止默认行为 (插入新行)
          e.preventDefault();
          e.stopPropagation();

          // 如果提供了 onEnterDown 回调，则调用它
          props.onChange?.(editor.getValue());
          props.onEnterDown?.(editor.getValue());

          // 可选: 让编辑器失去焦点
          // editor.trigger('keyboard', 'type', { text: '' }); // 触发一个空输入可能导致失去焦点，或者直接操作 DOM
          // editor.getDomNode()?.blur();
        }
      });
    };

    const handleEditorChange = (
      newValue: string | undefined,
      _ev: monaco.editor.IModelContentChangedEvent,
    ) => {
      const val = newValue || '';
      // Monaco有时会在空编辑器中保留一个换行符，需要清理
      const singleLineValue = val.replace(/[\r\n]+/g, '');
      setValue(singleLineValue);
      props.onChange?.(singleLineValue);
      // 如果值被外部修改导致包含换行符，强制设置回去
      if (val !== singleLineValue && editorRef.current) {
        // 记录当前光标位置
        const currentPosition = editorRef.current.getPosition();
        editorRef.current.setValue(singleLineValue);
        // 尝试恢复光标位置
        if (currentPosition) {
          editorRef.current.setPosition(currentPosition);
        }
      }
    };

    const theme = useEditorTheme();
    return (
      <Editor
        theme={theme}
        language={'sql'}
        value={value}
        className={props.className}
        onMount={handleEditorMount}
        onChange={handleEditorChange}
        height={`${20 + 3 * 2}px`}
        options={{
          fontSize: 13,
          lineHeight: 20,
          padding: { bottom: 3, top: 3 }, // 内边距
          minimap: {
            enabled: false,
          },
          scrollbar: {
            // 禁用滚动条
            vertical: 'hidden',
            horizontal: 'hidden',
            handleMouseWheel: false, // 可选：禁用鼠标滚轮滚动
          },
          wordBasedSuggestions: 'off', // 禁用基于单词的建议
          fixedOverflowWidgets: true, // 关键选项
          lineNumbers: 'off',
          glyphMargin: false, // 关闭字形边距
          folding: false, // 关闭代码折叠
          lineDecorationsWidth: 0, // 行装饰宽度设为0
          lineNumbersMinChars: 0, // 行号最小字符数设为0
          overviewRulerLanes: 0, // 关闭概览标尺
          overviewRulerBorder: false, // 关闭概览标尺边框
          renderLineHighlight: 'none', // 不渲染当前行高亮
          hideCursorInOverviewRuler: true, // 隐藏概览标尺中的光标
          scrollBeyondLastLine: false, // 不允许滚动超过最后一行
          wordWrap: 'off', // 强制不换行
          wrappingIndent: 'none', // 关闭自动换行缩进
          contextmenu: false, // 可选：禁用右键菜单
          // quickSuggestions: false, // 可选: 禁用快速建议
          // suggestOnTriggerCharacters: false, // 可选: 禁用触发字符建议
          // wordBasedSuggestions: 'off', // 可选: 禁用基于单词的建议
          // hover: { enabled: false }, // 可选: 禁用悬停提示
          // occurrencesHighlight: 'off', // 可选: 禁用相同内容高亮
          // selectionHighlight: false, // 可选: 禁用选择内容高亮
        }}
      />
    );
  },
);
export default SingleLineMonacoEditor;
