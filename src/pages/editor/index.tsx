import { OnChange } from '@monaco-editor/react';
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { nanoid } from 'nanoid';
import { useMemo, useRef, useState } from 'react';

import { schemaMapAtom } from '@/stores/dbList';
import {
  EditorContextType,
  QueryContextType,
  getDatabase,
  subTabsAtomFamily,
  useTabsStore,
} from '@/stores/tabs';

import { runsAtom } from '@/stores/app';
import { EditorToolbar } from './EditorToolbar';
import MonacoEditor, { EditorRef } from './MonacoEditor';
import { QueryTabs } from './QueryTabs';
import VerticalContainer from './VerticalContainer';

function createStore(item: Partial<QueryContextType>) {
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
  const [hasLimit, setHasLimit] = useState(true);

  const stmt = docs[id] ?? '';

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
  const getStmt = () => {
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
    return stmt;
  };

  const setRuns = useSetAtom(runsAtom);
  const handleClick = async (action?: string) => {
    const stmt = getStmt();
    const id = `${tab.id}@${nanoid()}`;
    if (action == 'new' || tab.children.length == 0) {
      const subContext: QueryContextType = createStore({
        dbId: tabContext.dbId,
        schema: tabContext.schema,
        tableId: tabContext.tableId,
        type: 'query',
        stmt,
        hasLimit,
        displayName: `Result${(tab?.children?.length ?? 0) + 1}`,
        id,
      });
      setRuns((prev) => [...(prev ?? []), subContext]);
      setSubTabs((prev) => [...(prev ?? []), subContext]);
    } else {
      setSubTabs((tabs) =>
        (tabs ?? []).map((item) => {
          if (item.id == tab.activeKey) {
            item = { ...item, stmt, id, page: 1, perPage: 500, hasLimit };
            setRuns((prev) => [...(prev ?? []), item]);
          }
          return item;
        }),
      );
    }
    setTab((item) => ({ ...item, activeKey: id }));
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <EditorToolbar
        onClick={handleClick}
        session={db?.displayName}
        onHasLimit={setHasLimit}
        hasLimit={hasLimit}
      />
      <VerticalContainer bottom={tab.children.length > 0 ? 300 : undefined}>
        <div className="h-full flex flex-col overflow-hidden border-b">
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
    </div>
  );
}
