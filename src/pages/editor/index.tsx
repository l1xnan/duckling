import Editor, { OnChange, OnMount } from '@monaco-editor/react';
import { Box, useTheme } from '@mui/material';
import { PrimitiveAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { nanoid } from 'nanoid';
import { useEffect, useRef } from 'react';

import { showTables } from '@/api';
import {
  EditorContextType,
  QueryContextType,
  useTabsStore,
} from '@/stores/tabs';
import { isDarkTheme } from '@/utils';

import { EditorToolbar } from './EditorToolbar';
import { QueryTabs } from './QueryTabs';
import VerticalContainer from './VerticalContainer';

type OnMountParams = Parameters<OnMount>;

async function getTables(root: string) {
  const res = await showTables(root);

  const schema: ComplationSchemaType = {};
  res?.data?.forEach(({ table_name }) => {
    schema[table_name] = [];
  });

  return schema;
}

type ComplationSchemaType = {
  [key: string]: string[];
};

export default function MonacoEditor({
  context,
}: {
  context: PrimitiveAtom<EditorContextType>;
}) {
  const tabContext = useAtomValue(context);
  const id = tabContext.id;
  const extra = tabContext.extra;
  const subTabsAtom = focusAtom(context, (o) => o.prop('children'));
  const activeKeyAtom = focusAtom(context, (o) => o.prop('activeKey'));
  const setTabs = useSetAtom(subTabsAtom);
  const setActiveKey = useSetAtom(activeKeyAtom);

  const setStmt = useTabsStore((state) => state.setStmt);
  const docs = useTabsStore((state) => state.docs);
  const stmt = docs[id] ?? '';
  const theme = useTheme();
  useEffect(() => {
    if (extra) {
      setStmt(id, `${stmt}\n${extra}`);
    }
  }, []);

  const editorRef = useRef<OnMountParams[0] | null>(null);

  const handleMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;
    _monaco.editor.defineTheme('dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {},
    });
  };
  const handleChange: OnChange = (value, _event) => {
    setStmt(id, value ?? '');
  };

  const handleClick = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    let stmt = '';
    const selection = editor.getSelection();
    if (selection) {
      stmt = editor.getModel()?.getValueInRange(selection) ?? '';
    }
    if (stmt.length === 0) {
      stmt = editor.getValue() ?? '';
    }

    if (stmt.length > 0) {
      const { children: _, ...rest } = tabContext;
      const id = `${rest.id}-${nanoid()}`;
      const subContext: QueryContextType = {
        ...rest,
        stmt,
        displayName: `Result${tabContext.children.length + 1}`,
        id,
      };
      setTabs((prev) => [...prev, subContext]);
      setActiveKey(id);
    }
  };

  return (
    <VerticalContainer
      bottom={tabContext?.children?.length > 0 ? 300 : undefined}
    >
      <Box sx={{ height: '100%' }}>
        <EditorToolbar onClick={handleClick} />
        <Editor
          onMount={handleMount}
          value={stmt}
          height={'100%'}
          defaultLanguage="sql"
          theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
          onChange={handleChange}
        />
      </Box>
      <QueryTabs
        subTabsAtom={subTabsAtom}
        activeKey={tabContext.activeKey}
        setActiveKey={setActiveKey}
      />
    </VerticalContainer>
  );
}
