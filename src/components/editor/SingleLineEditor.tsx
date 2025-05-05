import { useTheme } from '@/hooks/theme-provider';
import { isDarkTheme } from '@/utils';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'; // 导入 monaco 类型

import {
  ForwardedRef,
  forwardRef,
  memo,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

interface SingleLineEditorProps {
  initialValue?: string;
  language?: string;
  className?: string;
  onEnterDown?: (value: string) => void; // 当 Enter 被按下时触发 (可选)
  onChange?: (value: string) => void; // 值变化时触发 (可选)
}

type OnMountParams = Parameters<OnMount>;

export interface EditorRef {
  getSelectionText: () => string | undefined;
  getValue: () => string | undefined;
  editor: () => OnMountParams[0] | null;
}
const SingleLineMonacoEditor = memo<SingleLineEditorProps>(
  forwardRef((props, ref: ForwardedRef<EditorRef>) => {
    const editorRef = useRef<any>(null);
    const [value, setValue] = useState(props.initialValue ?? '');

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

    // --- 阻止 Enter 键换行 ---
    const handleEditorDidMount: OnMount = (editor, mon) => {
      editorRef.current = editor;

      // 监听键盘事件
      editor.onKeyDown((e: monaco.IKeyboardEvent) => {
        // 检查是否是 Enter 键 (并且没有按 Shift, Alt, Ctrl, Meta)
        console.log(e);
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
        // 可选: 阻止 Tab 键的默认行为 (插入 Tab 字符或移动焦点)
        // if (e.keyCode === mon.KeyCode.Tab) {
        //   e.preventDefault();
        //   e.stopPropagation();
        //   // 你可以在这里实现自定义的 Tab 行为，比如移动到下一个控件
        // }
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

    return (
      <Editor
        theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
        language={'sql'}
        value={value}
        className={props.className}
        onMount={handleEditorDidMount}
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
          padding: { top: 3, bottom: 3 }, // 可选：调整内边距，使其更紧凑
          quickSuggestions: false, // 可选: 禁用快速建议
          suggestOnTriggerCharacters: false, // 可选: 禁用触发字符建议
          wordBasedSuggestions: 'off', // 可选: 禁用基于单词的建议
          hover: { enabled: false }, // 可选: 禁用悬停提示
          occurrencesHighlight: 'off', // 可选: 禁用相同内容高亮
          selectionHighlight: false, // 可选: 禁用选择内容高亮
        }}
      />
    );
  }),
);

export default SingleLineMonacoEditor;
