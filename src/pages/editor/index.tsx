import { OnChange, OnMount } from '@monaco-editor/react';
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { nanoid } from 'nanoid';
import { useEffect, useMemo, useRef } from 'react';

import { schemaMapAtom } from '@/stores/dbList';
import {
  EditorContextType,
  QueryContextType,
  getDatabase,
  subTabsAtomFamily,
  useTabsStore,
} from '@/stores/tabs';

import { EditorToolbar } from './EditorToolbar';
import MonacoEditor, { EditorRef } from './MonacoEditor';
import { QueryTabs } from './QueryTabs';
import VerticalContainer from './VerticalContainer';

type OnMountParams = Parameters<OnMount>;

function createStore(item: Partial<QueryContextType>): QueryContextType {
  return {
    page: 1,
    perPage: 500,
    totalCount: 0,
    ...item,
  } as QueryContextType;
}

export default function Editor({
  context,
}: {
  context: PrimitiveAtom<EditorContextType>;
}) {
  const tabContext = useAtomValue(context);
  const setStmt = useTabsStore((state) => state.setStmt);
  const docs = useTabsStore((state) => state.docs);

  const id = tabContext.id;

  const db = getDatabase(tabContext.dbId);

  const tabAtom = subTabsAtomFamily({ id, children: [] });
  tabAtom.debugLabel = `tabAtom-${id}`;

  const [tab, setTab] = useAtom(tabAtom);

  const subTabsAtom = focusAtom(tabAtom, (o) => o.prop('children'));
  const setSubTabs = useSetAtom(subTabsAtom);

  const stmt = docs[id] ?? '';
  useEffect(() => {
    const extra = tabContext.extra;
    if (extra) {
      setStmt(id, `${stmt}\n${extra}`);
    }
  }, []);

  const schemaMap = useAtomValue(schemaMapAtom);

  const tableSchema = useMemo(
    () => schemaMap.get(tabContext.dbId) ?? [],
    [tabContext.dbId],
  );
  const ref = useRef<EditorRef | null>(null);

  const handleChange: OnChange = (value, _event) => {
    setStmt(id, value ?? '');
  };

  const setActiveKey = (key?: string) => {
    setTab((item) => ({ ...item, activeKey: key }));
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

    const id = `${tab.id}-${nanoid()}`;
    if (action == 'new' || tab.children.length == 0) {
      const subContext: QueryContextType = createStore({
        ...tabContext,
        type: 'query',
        stmt,
        displayName: `Result${(tab?.children?.length ?? 0) + 1}`,
        id,
      });

      setSubTabs((prev) => [...(prev ?? []), subContext]);
    } else {
      setSubTabs((tabs) =>
        (tabs ?? []).map((item) =>
          item.id == tab.activeKey
            ? { ...item, stmt, id, page: 1, perPage: 500 }
            : item,
        ),
      );
    }
    setTab((item) => ({ ...item, activeKey: id }));
  };

  return (
    <>
      <EditorToolbar onClick={handleClick} session={db?.displayName} />
      <VerticalContainer bottom={tab.children.length > 0 ? 300 : undefined}>
        <div className="h-full flex flex-col border-b-[1px]">
          <MonacoEditor
            ref={ref}
            value={stmt}
            onChange={handleChange}
            tableSchema={tableSchema}
          />
        </div>
        <QueryTabs
          tabsAtom={subTabsAtom}
          activeKey={tab.activeKey}
          setActiveKey={setActiveKey}
        />
      </VerticalContainer>
    </>
  );
}
