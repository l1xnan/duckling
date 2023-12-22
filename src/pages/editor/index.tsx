import { OnChange, OnMount } from '@monaco-editor/react';
import { Box } from '@mui/material';
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

import { EditorToolbar } from './EditorToolbar';
import MonacoEditor, { EditorRef } from './MonacoEditor';
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

export default function Editor({
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
  useEffect(() => {
    if (extra) {
      setStmt(id, `${stmt}\n${extra}`);
    }
  }, []);

  const ref = useRef<EditorRef | null>(null);

  const handleChange: OnChange = (value, _event) => {
    setStmt(id, value ?? '');
  };

  const handleClick = async (action?: string) => {
    const editor = ref.current;
    if (!editor) {
      return;
    }

    let stmt = editor.getSelectionText() ?? '';

    if (stmt.length === 0) {
      stmt = editor.getValue() ?? '';
    }

    if (stmt.length === 0) {
      return;
    }

    const { children: _, ...rest } = tabContext;
    if (action == 'new') {
      const id = `${rest.id}-${nanoid()}`;
      const subContext: QueryContextType = {
        ...rest,
        stmt,
        displayName: `Result${tabContext.children.length + 1}`,
        id,
      };
      setTabs((prev) => [...prev, subContext]);
      setActiveKey(id);
    } else {
      setTabs((tabs) =>
        tabs.map((tab) =>
          tab.id == tabContext.activeKey
            ? {
                ...tab,
                stmt,
              }
            : tab,
        ),
      );
    }
  };

  return (
    <>
      <EditorToolbar onClick={handleClick} />
      <VerticalContainer
        bottom={tabContext?.children?.length > 0 ? 300 : undefined}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <MonacoEditor ref={ref} value={stmt} onChange={handleChange} />
        </Box>
        <QueryTabs
          subTabsAtom={subTabsAtom}
          activeKey={tabContext.activeKey}
          setActiveKey={setActiveKey}
        />
      </VerticalContainer>
    </>
  );
}
